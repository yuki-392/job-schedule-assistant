"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import {
  judgeAvailability,
  type CalendarEvent,
  type JudgeAvailabilityResult,
  type UnavailableDate,
} from "@/domain/judgeAvailability";

const MOCK_CALENDAR_EVENTS: CalendarEvent[] = [
  {
    id: "1",
    title: "ゼミ",
    start: "2026-04-23T10:00",
    end: "2026-04-23T11:30",
  },
  {
    id: "2",
    title: "アルバイト",
    start: "2026-04-24T14:00",
    end: "2026-04-24T18:00",
  },
  {
    id: "3",
    title: "別社面接",
    start: "2026-04-25T13:00",
    end: "2026-04-25T14:30",
  },
];

function toReadable(dateTime: string) {
  return new Date(dateTime).toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getUnavailableReasonText(reason: UnavailableDate["reason"]) {
  if (reason === "calendar_conflict") return "既に予定あり";
  return "日時フォーマット不正";
}

function toIsoRange(days = 14) {
  const now = new Date();
  const end = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  return {
    timeMin: now.toISOString(),
    timeMax: end.toISOString(),
  };
}

export default function Home() {
  const mailSectionRef = useRef<HTMLElement | null>(null);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [candidateDates, setCandidateDates] = useState<string[]>([]);
  const [candidateInput, setCandidateInput] = useState("");
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [copyStatus, setCopyStatus] = useState("");
  const [judgeResult, setJudgeResult] = useState<JudgeAvailabilityResult | null>(null);
  const [isNgExpanded, setIsNgExpanded] = useState(false);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>(MOCK_CALENDAR_EVENTS);
  const [calendarMessage, setCalendarMessage] = useState("未同期（現在はモック予定を使用）");
  const [isCalendarLoading, setIsCalendarLoading] = useState(false);
  const hasSupabaseEnv = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
  );

  useEffect(() => {
    if (!hasSupabaseEnv) return;

    const supabase = createClient();

    supabase.auth.getUser().then(({ data }) => {
      const email = data.user?.email ?? "";
      setIsSignedIn(Boolean(data.user));
      setUserEmail(email);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const email = session?.user?.email ?? "";
      setIsSignedIn(Boolean(session?.user));
      setUserEmail(email);
    });

    return () => subscription.unsubscribe();
  }, [hasSupabaseEnv]);

  const availableDates = useMemo(() => judgeResult?.availableDates ?? [], [judgeResult]);
  const unavailableDates = useMemo(() => judgeResult?.unavailableDates ?? [], [judgeResult]);

  const activeSelectedDates = useMemo(
    () => selectedDates.filter((date) => availableDates.includes(date)),
    [availableDates, selectedDates],
  );
  const canGenerateEmail = companyName.trim().length > 0 && activeSelectedDates.length > 0;

  const emailBody = useMemo(() => {
    if (!companyName || activeSelectedDates.length === 0) {
      return "";
    }

    const selectedDateText = activeSelectedDates.map((date) => `- ${toReadable(date)}`).join("\n");

    return `${companyName} 採用ご担当者様

お世話になっております。面接日程のご連絡ありがとうございます。
以下の日程で参加可能です。

${selectedDateText}

何卒よろしくお願いいたします。`;
  }, [companyName, activeSelectedDates]);

  const addCandidateDate = () => {
    if (!candidateInput) return;
    if (candidateDates.includes(candidateInput)) return;
    setCandidateDates((prev) => [...prev, candidateInput].sort());
    setCandidateInput("");
    setCopyStatus("");
    setJudgeResult(null);
  };

  const removeCandidateDate = (target: string) => {
    setCandidateDates((prev) => prev.filter((date) => date !== target));
    setSelectedDates((prev) => prev.filter((date) => date !== target));
    setJudgeResult(null);
  };

  const handleJudge = () => {
    const result = judgeAvailability(candidateDates, calendarEvents);
    setJudgeResult(result);
    setIsNgExpanded(false);
    setSelectedDates((prev) => prev.filter((date) => result.availableDates.includes(date)));
  };
  const toggleSelectedDate = (date: string) => {
    setSelectedDates((prev) => {
      if (prev.includes(date)) return prev.filter((item) => item !== date);
      return [...prev, date];
    });
    setCopyStatus("");
  };


  const scrollToMailSection = () => {
    if (availableDates.length > 0 && activeSelectedDates.length === 0) {
      setSelectedDates(availableDates);
    }
    mailSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const copyEmail = async () => {
    if (!emailBody) return;
    await navigator.clipboard.writeText(emailBody);
    setCopyStatus("メール文をコピーしました。");
  };

  const signInWithGoogle = async () => {
    if (!hasSupabaseEnv) return;

    const supabase = createClient();
    setIsAuthLoading(true);
    setAuthMessage("");

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: "openid email profile https://www.googleapis.com/auth/calendar.readonly",
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
      },
    });

    if (error) {
      setAuthMessage("Googleログインに失敗しました。設定を確認してください。");
      setIsAuthLoading(false);
    }
  };

  const signOut = async () => {
    if (!hasSupabaseEnv) return;

    const supabase = createClient();
    setIsAuthLoading(true);
    setAuthMessage("");

    const { error } = await supabase.auth.signOut();
    if (error) {
      setAuthMessage("ログアウトに失敗しました。再度お試しください。");
    }

    setIsAuthLoading(false);
  };

  const syncGoogleCalendar = async () => {
    if (!hasSupabaseEnv) return;

    const supabase = createClient();
    setIsCalendarLoading(true);
    setCalendarMessage("");

    const { data, error } = await supabase.auth.getSession();
    if (error) {
      setCalendarMessage("セッション取得に失敗しました。再ログインしてください。");
      setIsCalendarLoading(false);
      return;
    }

    const providerToken = (data.session as { provider_token?: string } | null)?.provider_token;
    if (!providerToken) {
      setCalendarMessage("Googleトークンが見つかりません。再ログインして権限を許可してください。");
      setIsCalendarLoading(false);
      return;
    }

    const { timeMin, timeMax } = toIsoRange(21);
    const url = new URL("https://www.googleapis.com/calendar/v3/calendars/primary/events");
    url.searchParams.set("singleEvents", "true");
    url.searchParams.set("orderBy", "startTime");
    url.searchParams.set("timeMin", timeMin);
    url.searchParams.set("timeMax", timeMax);
    url.searchParams.set("maxResults", "100");

    try {
      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${providerToken}`,
        },
      });

      if (!response.ok) {
        setCalendarMessage("Googleカレンダー取得に失敗しました。権限設定を確認してください。");
        setIsCalendarLoading(false);
        return;
      }

      type GoogleEventsResponse = {
        items?: Array<{
          id?: string;
          summary?: string;
          start?: { dateTime?: string; date?: string };
          end?: { dateTime?: string; date?: string };
        }>;
      };

      const json = (await response.json()) as GoogleEventsResponse;
      const events: CalendarEvent[] = (json.items ?? [])
        .map((item, index) => {
          const start = item.start?.dateTime ?? item.start?.date;
          const end = item.end?.dateTime ?? item.end?.date;
          if (!start || !end) return null;

          return {
            id: item.id ?? `google-${index}`,
            title: item.summary ?? "予定",
            start,
            end,
          };
        })
        .filter((event): event is CalendarEvent => event !== null);

      setCalendarEvents(events);
      setCalendarMessage(`${events.length}件の予定を同期しました`);
    } catch {
      setCalendarMessage("Googleカレンダー取得中にエラーが発生しました。");
    } finally {
      setIsCalendarLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 p-6 text-slate-900 md:p-10">
      <div className="mx-auto max-w-4xl space-y-6">
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold text-blue-700">就活スケジュール自動調整アプリ（MVP）</p>
          <h1 className="mt-2 text-2xl font-bold">3ステップで面接日程を調整</h1>
          <p className="mt-2 text-sm text-slate-600">
            Google連携、候補日判定、返信文生成の最小フローを実装しています。
          </p>
        </section>

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
            onClick={isSignedIn ? signOut : signInWithGoogle}
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
                onClick={syncGoogleCalendar}
                disabled={isCalendarLoading}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100"
              >
                {isCalendarLoading ? "同期中..." : "Googleカレンダーを同期"}
              </button>
              <p className="mt-2 text-sm text-slate-600">{calendarMessage}</p>
            </div>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">2. 候補日を入力して空き時間を判定</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-[1fr_160px]">
            <input
              type="text"
              value={companyName}
              onChange={(event) => setCompanyName(event.target.value)}
              placeholder="企業名（例: 株式会社サンプル）"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <div />
            <input
              type="datetime-local"
              value={candidateInput}
              onChange={(event) => setCandidateInput(event.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={addCandidateDate}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-50"
            >
              候補日を追加
            </button>
          </div>

          <div className="mt-5">
            <h3 className="text-sm font-semibold text-slate-700">入力済み候補日</h3>
            {candidateDates.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">まだ候補日がありません。</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {candidateDates.map((date) => (
                  <li
                    key={date}
                    className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-sm"
                  >
                    <span>{toReadable(date)}</span>
                    <button
                      type="button"
                      onClick={() => removeCandidateDate(date)}
                      className="text-red-600 hover:underline"
                    >
                      削除
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-5">
            <button
              type="button"
              onClick={handleJudge}
              disabled={candidateDates.length === 0}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              判定する
            </button>
          </div>

          <div className="mt-5">
            <h3 className="text-base font-semibold text-slate-900">✅ 空き候補</h3>
            {!judgeResult ? (
              <p className="mt-2 text-sm text-slate-500">「判定する」を押すと結果が表示されます。</p>
            ) : availableDates.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">空き候補はありません。</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {availableDates.map((date) => (
                  <li
                    key={date}
                    className="rounded-lg border border-emerald-300 bg-emerald-50 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <span className="text-base font-semibold text-emerald-900">{toReadable(date)}</span>
                      <button
                        type="button"
                        onClick={() => toggleSelectedDate(date)}
                        className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                      >
                        {activeSelectedDates.includes(date) ? "選択中" : "この日時を選択"}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {judgeResult && availableDates.length > 0 && (
              <button
                type="button"
                onClick={scrollToMailSection}
                className="mt-4 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                メール作成へ進む
              </button>
            )}
            {activeSelectedDates.length > 0 && (
              <p className="mt-2 text-sm text-emerald-800">
                {activeSelectedDates.length}件の日程を選択中です。
              </p>
            )}
          </div>

          <div className="mt-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-700">❌ NG候補（理由付き）</h3>
              <button
                type="button"
                onClick={() => setIsNgExpanded((prev) => !prev)}
                className="text-xs font-semibold text-slate-600 underline"
                disabled={!judgeResult}
              >
                {isNgExpanded ? "閉じる" : "表示する"}
              </button>
            </div>
            {!judgeResult ? (
              <p className="mt-2 text-sm text-slate-500">まだ判定結果がありません。</p>
            ) : unavailableDates.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">NG候補はありません。</p>
            ) : !isNgExpanded ? (
              <p className="mt-2 text-sm text-slate-500">
                {unavailableDates.length}件あります（「表示する」で確認）
              </p>
            ) : (
              <ul className="mt-2 space-y-2">
                {unavailableDates.map((item) => (
                  <li
                    key={`${item.date}-${item.reason}`}
                    className="rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm"
                  >
                    <p>{toReadable(item.date)}</p>
                    <p className="text-slate-700">理由: {getUnavailableReasonText(item.reason)}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section
          ref={mailSectionRef}
          className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <h2 className="text-lg font-semibold">3. メール文を生成してコピー</h2>
          {!emailBody ? (
            <p className="mt-2 text-sm text-slate-600">
              企業名と候補日（複数可）を選択すると、テンプレートメールを生成します。
            </p>
          ) : (
            <textarea
              readOnly
              value={emailBody}
              className="mt-3 h-52 w-full rounded-md border border-slate-300 p-3 text-sm"
            />
          )}
          <div className="mt-3 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={copyEmail}
              disabled={!canGenerateEmail}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              メール文をコピー
            </button>
            {canGenerateEmail && (
              <a
                href={`https://mail.google.com/mail/?view=cm&fs=1&to=&su=${encodeURIComponent(
                  `${companyName} 面接日程のご返信`,
                )}&body=${encodeURIComponent(emailBody)}`}
                target="_blank"
                rel="noreferrer"
                className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-50"
              >
                Gmail作成画面を開く
              </a>
            )}
          </div>
          {!canGenerateEmail && (
            <p className="mt-2 text-sm text-slate-500">
              企業名を入力し、空き候補を1件以上選択するとメール作成できます。
            </p>
          )}
          {copyStatus && <p className="mt-2 text-sm text-emerald-700">{copyStatus}</p>}
        </section>
      </div>
    </main>
  );
}
