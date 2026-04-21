# API設計（MVP）

## 1. 前提

- フロント: Next.js App Router
- 認証: Supabase Auth + Google OAuth
- API提供: Next.js Route Handler (`src/app/api/**/route.ts`)
- 目的:  
  1) Googleカレンダー予定取得  
  2) 面接候補日の空き判定  
  3) メール文生成

---

## 2. 認証・認可方針

- すべてのMVP APIは「ログイン済みユーザーのみ」利用可能
- セッション判定は `supabase.auth.getUser()` で実施
- 未認証時は `401 Unauthorized` を返す
- ユーザーIDは Supabase の `auth.users.id` を利用

---

## 3. API一覧（MVP）

## `GET /api/calendar/events`

### 目的
指定期間のGoogleカレンダー予定を取得する

### Query
- `from` (required, ISO8601)
- `to` (required, ISO8601)
- `calendarId` (optional, default: `primary`)

### 成功レスポンス `200`
```json
{
  "events": [
    {
      "id": "evt_123",
      "title": "ゼミ",
      "start": "2026-04-23T10:00:00+09:00",
      "end": "2026-04-23T11:30:00+09:00"
    }
  ]
}
```

### エラー
- `400`: `from/to` が不正
- `401`: 未認証
- `429`: Google API制限
- `502`: Google API障害

---

## `POST /api/interviews/judge`

### 目的
候補日時と予定の重複判定を行い、空き候補を返す

### Request Body
```json
{
  "companyName": "株式会社サンプル",
  "candidateDates": [
    "2026-04-23T10:00:00+09:00",
    "2026-04-24T19:00:00+09:00"
  ],
  "interviewDurationMinutes": 60,
  "calendarRange": {
    "from": "2026-04-20T00:00:00+09:00",
    "to": "2026-04-30T23:59:59+09:00"
  }
}
```

### 成功レスポンス `200`
```json
{
  "companyName": "株式会社サンプル",
  "availableDates": [
    "2026-04-24T19:00:00+09:00"
  ],
  "unavailableDates": [
    {
      "date": "2026-04-23T10:00:00+09:00",
      "reason": "calendar_conflict",
      "conflictEventId": "evt_123"
    }
  ]
}
```

### エラー
- `400`: 必須項目不足 / 日時フォーマット不正
- `401`: 未認証
- `422`: `candidateDates` が空
- `502`: カレンダー取得失敗

---

## `POST /api/mail/generate`

### 目的
選択済み候補日を使って返信メール本文を生成する（テンプレートベース）

### Request Body
```json
{
  "companyName": "株式会社サンプル",
  "selectedDate": "2026-04-24T19:00:00+09:00",
  "userName": "山田 太郎"
}
```

### 成功レスポンス `200`
```json
{
  "subject": "面接日程のご返信（山田 太郎）",
  "body": "株式会社サンプル 採用ご担当者様\n\nお世話になっております。..."
}
```

### エラー
- `400`: `companyName` / `selectedDate` 欠落
- `401`: 未認証

---

## 4. 共通エラーフォーマット

すべてのAPIで共通化:

```json
{
  "error": {
    "code": "INVALID_INPUT",
    "message": "from/to must be valid ISO datetime"
  }
}
```

### エラーコード例
- `INVALID_INPUT`
- `UNAUTHORIZED`
- `CALENDAR_RATE_LIMITED`
- `UPSTREAM_ERROR`
- `INTERNAL_ERROR`

---

## 5. データモデル（Supabase）

## `profiles`
- `id` uuid PK (`auth.users.id` と同一)
- `email` text
- `created_at` timestamptz

## `interviews`
- `id` uuid PK
- `user_id` uuid FK -> `profiles.id`
- `company_name` text
- `selected_date` timestamptz null
- `created_at` timestamptz

## `interview_candidates`
- `id` uuid PK
- `interview_id` uuid FK -> `interviews.id` (on delete cascade)
- `candidate_date` timestamptz
- `status` text (`pending` / `rejected` / `selected`)
- `sort_order` int
- `created_at` timestamptz
- `updated_at` timestamptz

### 補足（JSONではなく分割する理由）
- 特定候補のみ更新しやすい（行単位UPDATE）
- 並び替えを `sort_order` で扱える
- 候補ごとの状態管理（候補/却下/選択）が可能
- 分析SQLが書きやすい（日時別、企業別、選択率など）

> MVPではGoogleアクセストークンを独自テーブルに保存しない。  
> Supabase Auth セッション経由で扱い、長期保存を避ける。

---

## 6. 処理フロー（MVP）

1. ログイン後、`GET /api/calendar/events` で期間予定取得
2. 候補日入力後、`POST /api/interviews/judge` で空き判定
3. 空き候補選択後、`POST /api/mail/generate` で文面生成
4. フロントでコピー or Gmail compose URLへ遷移

---

## 7. 実装順（推奨）

1. `GET /api/calendar/events`（Google API接続確認）
2. `POST /api/interviews/judge`（重複判定）
3. `POST /api/mail/generate`（テンプレ生成）
4. `interviews` + `interview_candidates` 保存（履歴保持）

