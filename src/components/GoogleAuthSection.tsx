"use client";

type Props = {
  isSignedIn: boolean;
  userEmail: string;
  authMessage: string;
  isAuthLoading: boolean;
  hasSupabaseEnv: boolean;
  calendarMessage: string;
  isCalendarLoading: boolean;
  isCalendarSynced: boolean;
  needsReauth: boolean;
  onSignIn: () => void;
  onSignOut: () => void;
  onSyncCalendar: () => void;
  onReAuth: () => void;
};

export function GoogleAuthSection({
  isSignedIn,
  userEmail,
  authMessage,
  isAuthLoading,
  hasSupabaseEnv,
  calendarMessage,
  isCalendarLoading,
  isCalendarSynced,
  needsReauth,
  onSignIn,
  onSignOut,
  onSyncCalendar,
  onReAuth,
}: Props) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold">1. Googleカレンダーと連携（任意）</h2>
      <p className="mt-1 text-sm text-slate-600">
        連携すると予定との重複を自動チェックできます。スキップしても候補日からメールを作成できます。
      </p>
      {!hasSupabaseEnv && (
        <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          `NEXT_PUBLIC_SUPABASE_URL` と
          `NEXT_PUBLIC_SUPABASE_ANON_KEY`（または`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`）が未設定です。
        </p>
      )}
      <button
        type="button"
        onClick={isSignedIn ? onSignOut : onSignIn}
        disabled={isAuthLoading || !hasSupabaseEnv}
        className="mt-4 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
      >
        {isSignedIn ? "ログアウト" : "Googleでログイン"}
      </button>
      <p className="mt-2 text-sm">
        {isSignedIn
          ? `連携状態: 接続済み (${userEmail || "メール未取得"})`
          : "連携状態: 未接続"}
      </p>
      {authMessage && <p className="mt-2 text-sm text-red-600">{authMessage}</p>}
      {isSignedIn && (
        <div className="mt-3 space-y-3">
          {needsReauth && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
              <p className="text-sm font-semibold text-amber-800">
                Googleトークンの有効期限が切れています
              </p>
              <p className="mt-1 text-sm text-amber-700">
                カレンダーの同期を続けるには再度ログインしてください。
              </p>
              <button
                type="button"
                onClick={onReAuth}
                disabled={isAuthLoading}
                className="mt-2 rounded-md bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                Googleで再ログイン
              </button>
            </div>
          )}
          <div>
            <button
              type="button"
              onClick={onSyncCalendar}
              disabled={isCalendarLoading || needsReauth}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
            >
              {isCalendarLoading ? "同期中..." : "Googleカレンダーを同期"}
            </button>
            {calendarMessage && (
              <p className="mt-2 text-sm text-slate-600">{calendarMessage}</p>
            )}
            {!isCalendarSynced && !isCalendarLoading && !needsReauth && (
              <p className="mt-2 text-sm text-amber-700">カレンダーをまだ同期していません。同期すると予定との重複チェックが有効になります。</p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
