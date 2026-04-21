# 状態設計（軽量版 / MVP）

対象状態:
- `candidateDates`（候補オブジェクト配列）
- `availableDates`
- `selectedDate`

---

## 1. 結論（MVP）

- **初期実装は `useState` で持つ**
- 判定はクライアントで即時計算（体験重視）
- **`availableDates` は導出値として100%統一する（保存しない）**
- 永続化や共有が必要になったら `Server Actions` に切り出す

---

## 2. 状態の責務

## `candidateDates: CandidateDate[]`
- **保持内容**: 候補日時 + 最小メタ情報
- **更新契機**:
  - 候補追加
  - 候補削除
  - 候補並び替え（必要なら）
- **注意**:
  - `candidateDate` 重複は追加しない
  - 空配列時は判定ボタン無効

```ts
type CandidateStatus = "pending" | "rejected";

type CandidateDate = {
  id: string;              // UUID or client-generated id
  candidateDate: string;   // ISO datetime
  status: CandidateStatus; // 初期値 pending（selectedは持たない）
  sortOrder: number;       // 並び順
};
```

## `availableDates: string[]`
- **保持内容**: 判定結果として「空き」となった候補日時
- **更新契機**:
  - `candidateDates` または `calendarEvents` 変更時に再計算
- **MVP方針（固定）**:
  - `useMemo` で導出し、`useState` では持たない
  - APIレスポンスを直接 `availableDates` として保存しない
  - 将来API化する場合も「API結果 -> 正規化 -> 導出」に寄せる

## `selectedDate: string | null`
- **保持内容**: 判定結果画面で最終選択した1件
- **更新契機**:
  - 空き候補を選択
  - 選択解除
  - 選択候補が削除されたときは自動クリア
- **整合性ガード（必須）**:
  - `selectedDate` は常に `availableDates` に含まれる値のみ許可
  - `availableDates` 再計算後、未包含なら `null` に戻す
  - メール生成は `selectedDate !== null` のときのみ許可

---

## 3. 画面遷移と状態遷移

1. ホーム画面
   - `candidateDates` を編集（追加/削除/並び替え）
2. 判定実行
   - `availableDates` を導出（再計算）
3. 判定結果画面
   - `selectedDate` を確定（唯一の選択状態）
4. メール生成画面
   - `selectedDate` と企業名から本文生成

---

## 4. `useState` と `Server Actions` の切り分け

## `useState` で持つもの（今すぐ）
- フォーム入力中の値
- 画面内の一時状態
- `candidateDates` / `selectedDate` など入力と選択状態

## `Server Actions` に上げるもの（次フェーズ）
- `interviews` / `interview_candidates` への保存
- 候補確定（`selectedDate`）の永続化
- 複数デバイス/再訪時の復元
- （必要時）カレンダー予定取得APIの実行

---

## 5. 実装イメージ（最小）

```ts
const [candidateDates, setCandidateDates] = useState<CandidateDate[]>([]);
const [selectedDate, setSelectedDate] = useState<string | null>(null);

const availableDates = useMemo(
  () =>
    judgeAvailability(
      candidateDates.map((c) => c.candidateDate),
      calendarEvents,
    ),
  [candidateDates, calendarEvents],
);
```

---

## 6. 将来拡張時の追加状態

- `unavailableDates: { date: string; reason: string }[]`
- `candidateStatuses: Record<candidateId, "pending" | "rejected" | "selected">`
- `isJudging` / `judgeError`（API化した際のローディング・エラー）

## API化時の移行ルール
- NG: `setAvailableDates(apiResult.availableDates)`
- OK: `setCalendarEvents(apiResult.events)` し、`availableDates` は導出を維持

---

## 7. `selectedDate` 整合性ルール（明文化）

## 不変条件（Invariant）
- `selectedDate === null` または `availableDates.includes(selectedDate)` を常に満たす
- 選択状態は `selectedDate` のみで表現し、`candidateDates[].status` に `selected` を持たせない

## ガードが必要なタイミング
- 候補日時の追加/削除直後
- カレンダー同期後（判定結果が変わるタイミング）
- 判定ロジック変更後（再判定実行時）

## 推奨実装
```ts
useEffect(() => {
  if (!selectedDate) return;
  if (!availableDates.includes(selectedDate)) {
    setSelectedDate(null);
  }
}, [availableDates, selectedDate]);
```

## UIガード
- 「メール生成へ進む」ボタン: `selectedDate` がない場合は disabled
- 画面表示文言: `selectedDate` が消えたときは「候補を再選択してください」を表示

---

## 8. なぜ `string[]` から拡張するか

- 候補単位の更新（削除・却下・選択）がしやすい
- DB設計（`interview_candidates`）と1対1対応し、変換コストが低い
- 並び順やステータスの実装を後付けしやすい
- それでもMVPの複雑さは最小限（フィールド4つ）

---

## 9. 二重管理を避ける原則（重要）

- **Single Source of Truth**: 選択状態の正は `selectedDate` のみ
- `CandidateDate.status` は「候補として有効か」を表す補助情報（`pending/rejected`）のみ
- `selectedDate` と `status` の同期処理は実装しない（同期ロジック自体がバグ源になるため）
- 選択済み候補を表示する際は、`candidateDate.candidateDate === selectedDate` で判定する

