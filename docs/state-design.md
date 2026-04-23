# 状態設計（軽量版 / MVP）

対象状態:
- `candidateDates`（候補オブジェクト配列）
- `judgeResultMap`（判定結果マップ）
- `selectedRangeKeys`（選択済み空き時間帯キー）

---

## 1. 結論（MVP）

- **初期実装は `useState` で持つ**
- 判定はクライアントで即時計算（体験重視）
- **`availableRanges` は導出値として100%統一する（保存しない）**
- 永続化や共有が必要になったら `Server Actions` に切り出す

---

## 2. 状態の責務

## `candidateDates: CandidateDate[]`
- **保持内容**: 候補日時範囲 + 最小メタ情報
- **更新契機**:
  - 候補追加
  - 候補削除
  - 候補並び替え（必要なら）
- **注意**:
  - `candidateDate` + `candidateEndDate` の組が重複する場合は追加しない
  - 空配列時は判定ボタン無効

```ts
type CandidateStatus = "pending" | "rejected";

type CandidateDate = {
  id: string;              // UUID or client-generated id
  candidateDate: string;   // 開始 ISO datetime
  candidateEndDate: string; // 終了 ISO datetime（範囲指定に必須）
  status: CandidateStatus; // 初期値 pending（selectedは持たない）
  sortOrder: number;       // 並び順
};
```

## `judgeResultMap: Record<string, RangeJudgeResult> | null`
- **保持内容**: `CandidateDate.id` をキーとした判定結果マップ
- **更新契機**: 「判定する」ボタン押下時
- **MVP方針**: `useState` で保持し、候補変更時は `null` にリセット

```ts
type AvailableRange = {
  start: string;  // ISO datetime
  end: string;    // ISO datetime
};

type BlockedRange = {
  start: string;
  end: string;
  conflictEventIds: string[];
};

type RangeJudgeResult = {
  availableRanges: AvailableRange[];
  blockedRanges: BlockedRange[];
};
```

## `availableRanges: AvailableRange[]`（導出値）
- **保持内容**: 全候補の空き時間帯をフラットに展開したリスト
- **更新契機**: `judgeResultMap` 変更時に再計算
- **MVP方針（固定）**:
  - `useMemo` で導出し、`useState` では持たない
  - カレンダー予定の前後 `bufferMinutes`（デフォルト60分）を自動除外

## `selectedRangeKeys: string[]`
- **保持内容**: 選択済み空き時間帯のキー（`${start}__${end}`）
- **更新契機**:
  - 空き時間帯を選択/解除（トグル）
  - `availableRanges` 再計算後、無効なキーを自動除外
  - メール生成は `selectedRangeKeys.length > 0` のときのみ許可
- **整合性ガード（必須）**:
  - `selectedRangeKeys` の各要素は常に `availableRanges.map(rangeKey)` に含まれる値のみ許可
  - `availableRanges` 再計算後、未包含のキーは配列から除外

---

## 3. 画面遷移と状態遷移

1. ホーム画面
   - `candidateDates` を編集（追加/削除）
2. 判定実行
   - `judgeResultMap` を更新（`judgeRangeAvailability` を各候補に適用）
   - `availableRanges` を導出（カレンダー予定±バッファを除外）
3. 判定結果画面
   - `selectedRangeKeys` を更新（複数選択）
4. メール生成画面
   - `selectedRangeKeys` と企業名から本文生成

---

## 4. `useState` と `Server Actions` の切り分け

## `useState` で持つもの（今すぐ）
- フォーム入力中の値
- 画面内の一時状態
- `candidateDates` / `selectedRangeKeys` など入力と選択状態

## `Server Actions` に上げるもの（次フェーズ）
- `interviews` / `interview_candidates` への保存
- 候補確定（`selectedRangeKeys`）の永続化
- 複数デバイス/再訪時の復元

---

## 5. 実装イメージ（最小）

```ts
const [candidateDates, setCandidateDates] = useState<CandidateDate[]>([]);
const [judgeResultMap, setJudgeResultMap] = useState<Record<string, RangeJudgeResult> | null>(null);
const [selectedRangeKeys, setSelectedRangeKeys] = useState<string[]>([]);

const allAvailableRanges = useMemo(
  () => Object.values(judgeResultMap ?? {}).flatMap((r) => r.availableRanges),
  [judgeResultMap],
);

// 判定実行
const handleJudge = () => {
  const results: Record<string, RangeJudgeResult> = {};
  for (const c of candidateDates) {
    results[c.id] = judgeRangeAvailability(c.candidateDate, c.candidateEndDate, calendarEvents);
  }
  setJudgeResultMap(results);
};
```

---

## 6. 整合性ガード（selectedRangeKeys）

## 不変条件（Invariant）
- `selectedRangeKeys.every((k) => allAvailableRanges.map(rangeKey).includes(k))` を常に満たす

## ガードが必要なタイミング
- 候補日時の追加/削除直後
- カレンダー同期後（判定結果が変わるタイミング）
- 判定再実行時

## 推奨実装
```ts
useEffect(() => {
  const validKeys = new Set(allAvailableRanges.map(rangeKey));
  setSelectedRangeKeys((prev) => prev.filter((k) => validKeys.has(k)));
}, [allAvailableRanges]);
```

---

## 7. 除外バッファの仕様

- カレンダー予定がある場合、**予定開始 − bufferMinutes** 〜 **予定終了 + bufferMinutes** を除外
- デフォルト `bufferMinutes = 60`（前後1時間）
- 複数予定の除外区間が重なる場合はマージして1区間として扱う
- 除外区間は候補範囲の境界にクランプされる（範囲外には広がらない）

---

## 8. 二重管理を避ける原則（重要）

- **Single Source of Truth**: 選択状態の正は `selectedRangeKeys` のみ
- `CandidateDate.status` は「候補として有効か」を表す補助情報（`pending/rejected`）のみ
- `selectedRangeKeys` と `status` の同期処理は実装しない（同期ロジック自体がバグ源になるため）
