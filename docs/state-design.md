# 状態設計（MVP）

対象状態:
- `companies`（企業リスト。各社が candidateDates・selectedRangeKeys を保持）
- `activeCompanyId`（選択中の企業ID）
- `judgeResultMap`（判定結果マップ。企業切り替え・カレンダー同期で自動再計算）
- `calendarEvents`（Googleカレンダー同期結果）

---

## 1. 結論（MVP）

- **`companies` / `activeCompanyId` / `calendarEvents` は `useLocalStorage` で永続化**（リロード後も復元）
- **`judgeResultMap` は `useState`**（揮発性・企業切り替え・カレンダー同期で自動再計算）
- **`availableRanges` は導出値として100%統一する（保存しない）**
- 判定ロジックは `/api/interviews/judge` Route Handler で実行（サーバーサイド）

---

## 2. 状態の責務

## `Company` 型
```ts
type Company = {
  id: string;
  name: string;
  candidateDates: CandidateDate[];
  selectedRangeKeys: string[];
};
```
- `companies: Company[]` と `activeCompanyId: string` を `useLocalStorage` で保持
- アクティブ企業のデータは `companies.find(c => c.id === activeCompanyId)` で導出

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

## 4. 永続化の方針

## `useLocalStorage` で永続化するもの

| キー | 型 | 内容 |
|---|---|---|
| `jsa:companies` | `Company[]` | 企業リスト（候補日・選択済みキーを含む）|
| `jsa:activeCompanyId` | `string` | 選択中企業のID |
| `jsa:calendarEvents` | `CalendarEvent[]` | 同期済みカレンダーイベント |
| `jsa:calendarMessage` | `string` | 同期メッセージ |

### ハイドレーション設計（重要）

`useLocalStorage` は `isHydrated` フラグを返す。

```ts
const [value, setValue, isHydrated] = useLocalStorage(key, initialValue);
```

- **マウント直後**: `isHydrated = false`。書き込みエフェクトはスキップされるため、`initialValue` でlocalStorageを上書きしない
- **読み込み完了後**: `isHydrated = true` になり、書き込みが有効になる
- **注意**: localStorageからの復元に依存する初期化処理（デフォルト企業作成など）は `isHydrated` を確認してから実行する

```ts
// NG: isHydrated を待たずに実行すると、保存済みデータを上書きしてしまう
useEffect(() => {
  if (companies.length === 0) createDefaultCompany();
}, []);

// OK: ハイドレーション後に実行
useEffect(() => {
  if (!isCompaniesHydrated) return;
  if (companies.length === 0) createDefaultCompany();
}, [isCompaniesHydrated]);
```

## `useState`（揮発性）で持つもの
- `judgeResultMap`（起動時・企業切り替え時に自動再計算）
- `isAuthLoading` / `isCalendarLoading` などのUI状態
- `needsReauth` / `isNgExpanded` などのセッション内フラグ

## 将来（Supabase DB）に移行するもの
- `interviews` / `interview_candidates` テーブルへの永続化
- 複数デバイス/再訪時のクロス同期

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
