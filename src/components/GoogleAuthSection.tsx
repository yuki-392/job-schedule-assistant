"use client";

type Props = {
  isSignedIn: boolean;
  userEmail: string;
  authMessage: string;
  isAuthLoading: boolean;
  hasSupabaseEnv: boolean;
  calendarMessage: string;
  isCalendarLoading: boolean;
  onSignIn: () => void;
  onSignOut: () => void;
  onSyncCalendar: () => void;
};

export function GoogleAuthSection({
  isSignedIn,
  userEmail,
  authMessage,
  isAuthLoading,
  hasSupabaseEnv,
  calendarMessage,
  isCalendarLoading,
  onSignIn,
  onSignOut,
  onSyncCalendar,
}: Props) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold">1. Googleログイン</h2>
      <p className="mt-1 text-sm text-slate-600">Supabase Auth + Google OAuthで認証します。</p>
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
        <div className="mt-3">
          <button
            type="button"
            onClick={onSyncCalendar}
            disabled={isCalendarLoading}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100"
          >
            {isCalendarLoading ? "同期中..." : "Googleカレンダーを同期"}
          </button>
          <p className="mt-2 text-sm text-slate-600">{calendarMessage}</p>
        </div>
      )}
    </section>
  );
}
