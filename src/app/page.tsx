"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { createClient } from "@/utils/supabase/client";
import {
  judgeRangeAvailability,
  rangeKey,
  type AvailableRange,
  type CalendarEvent,
  type CandidateDate,
  type RangeJudgeResult,
} from "@/domain/judgeAvailability";
import { formatRangeDate } from "@/lib/format";
import { GoogleAuthSection } from "@/components/GoogleAuthSection";
import { CandidateDateSection } from "@/components/CandidateDateSection";
import { MailSection } from "@/components/MailSection";

type Company = {
  id: string;
  name: string;
  candidateDates: CandidateDate[];
  selectedRangeKeys: string[];
};

function toIsoRange(days = 14) {
  const now = new Date();
  const end = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  return { timeMin: now.toISOString(), timeMax: end.toISOString() };
}

export default function Home() {
  const mailSectionRef = useRef<HTMLElement | null>(null);

  const [isSignedIn, setIsSignedIn] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  const [calendarEvents, setCalendarEvents] = useLocalStorage<CalendarEvent[]>("jsa:calendarEvents", []);
  const [calendarMessage, setCalendarMessage] = useLocalStorage("jsa:calendarMessage", "");
  const [isCalendarLoading, setIsCalendarLoading] = useState(false);
  const [needsReauth, setNeedsReauth] = useState(false);

  const [companies, setCompanies] = useLocalStorage<Company[]>("jsa:companies", []);
  const [activeCompanyId, setActiveCompanyId] = useLocalStorage("jsa:activeCompanyId", "");
  const [judgeResultMap, setJudgeResultMap] = useState<Record<string, RangeJudgeResult> | null>(null);
  const [isNgExpanded, setIsNgExpanded] = useState(false);

  // 企業が1件もなければデフォルト企業を作成
  useEffect(() => {
    if (companies.length === 0) {
      const id = crypto.randomUUID();
      setCompanies([{ id, name: "", candidateDates: [], selectedRangeKeys: [] }]);
      setActiveCompanyId(id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasSupabaseEnv = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
  );

  useEffect(() => {
    if (!hasSupabaseEnv) return;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setIsSignedIn(Boolean(data.user));
      setUserEmail(data.user?.email ?? "");
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsSignedIn(Boolean(session?.user));
      setUserEmail(session?.user?.email ?? "");
    });
    return () => subscription.unsubscribe();
  }, [hasSupabaseEnv]);

  // アクティブ企業のデータを導出
  const activeCompany = companies.find(c => c.id === activeCompanyId) ?? companies[0] ?? null;
  const companyName = activeCompany?.name ?? "";
  const candidateDates = activeCompany?.candidateDates ?? [];
  const selectedRangeKeys = activeCompany?.selectedRangeKeys ?? [];

  // アクティブ企業の各フィールドを更新するヘルパー
  const updateActiveCompany = (updater: (c: Company) => Company) => {
    const id = activeCompany?.id;
    if (!id) return;
    setCompanies(prev => prev.map(c => c.id === id ? updater(c) : c));
  };

  const setCompanyName = (name: string) => updateActiveCompany(c => ({ ...c, name }));

  const setCandidateDates = (updater: CandidateDate[] | ((prev: CandidateDate[]) => CandidateDate[])) => {
    const id = activeCompany?.id;
    if (!id) return;
    setCompanies(prev => prev.map(c => {
      if (c.id !== id) return c;
      return { ...c, candidateDates: typeof updater === "function" ? updater(c.candidateDates) : updater };
    }));
  };

  const setSelectedRangeKeys = (updater: string[] | ((prev: string[]) => string[])) => {
    const id = activeCompany?.id;
    if (!id) return;
    setCompanies(prev => prev.map(c => {
      if (c.id !== id) return c;
      return { ...c, selectedRangeKeys: typeof updater === "function" ? updater(c.selectedRangeKeys) : updater };
    }));
  };

  // 企業の追加・削除・切り替え
  const addCompany = () => {
    const id = crypto.randomUUID();
    setCompanies(prev => [...prev, { id, name: "", candidateDates: [], selectedRangeKeys: [] }]);
    setActiveCompanyId(id);
    setJudgeResultMap(null);
    setIsNgExpanded(false);
  };

  const removeCompany = (id: string) => {
    if (companies.length <= 1) return;
    const remaining = companies.filter(c => c.id !== id);
    setCompanies(remaining);
    if (activeCompanyId === id) {
      setActiveCompanyId(remaining[0].id);
    }
    setJudgeResultMap(null);
  };

  const switchCompany = (id: string) => {
    if (id === activeCompanyId) return;
    setActiveCompanyId(id);
    setJudgeResultMap(null);
    setIsNgExpanded(false);
  };

  const allAvailableRanges = useMemo<AvailableRange[]>(() => {
    if (!judgeResultMap) return [];
    return Object.values(judgeResultMap).flatMap((r) => r.availableRanges);
  }, [judgeResultMap]);

  const allBlockedRanges = useMemo(() => {
    if (!judgeResultMap) return [];
    return Object.values(judgeResultMap).flatMap((r) => r.blockedRanges);
  }, [judgeResultMap]);

  const recommendedRangeKey = useMemo<string | null>(() => {
    if (allAvailableRanges.length === 0) return null;
    const earliest = allAvailableRanges.reduce((min, r) =>
      new Date(r.start).getTime() < new Date(min.start).getTime() ? r : min,
    );
    return rangeKey(earliest);
  }, [allAvailableRanges]);

  const activeSelectedRangeKeys = useMemo(() => {
    const validKeys = new Set(allAvailableRanges.map(rangeKey));
    return selectedRangeKeys.filter((k) => validKeys.has(k));
  }, [allAvailableRanges, selectedRangeKeys]);

  const isCalendarSynced = calendarEvents.length > 0;

  const canGenerateEmail = companyName.trim().length > 0 && activeSelectedRangeKeys.length > 0;

  const emailBody = useMemo(() => {
    if (!canGenerateEmail) return "";
    const activeRanges = allAvailableRanges.filter((r) => activeSelectedRangeKeys.includes(rangeKey(r)));
    const rangeText = activeRanges.map((r) => `- ${formatRangeDate(r.start, r.end)}`).join("\n");
    return `${companyName} 採用ご担当者様\n\nお世話になっております。面接日程のご連絡ありがとうございます。\n以下の時間帯で参加可能です。\n\n${rangeText}\n\n何卒よろしくお願いいたします。`;
  }, [canGenerateEmail, companyName, activeSelectedRangeKeys, allAvailableRanges]);

  // 企業切り替えとカレンダー同期時に自動で判定（候補日の追加・削除には反応しない）
  useEffect(() => {
    if (!activeCompanyId || candidateDates.length === 0) {
      setJudgeResultMap(null);
      return;
    }
    const results: Record<string, RangeJudgeResult> = {};
    for (const c of candidateDates) {
      results[c.id] = judgeRangeAvailability(c.candidateDate, c.candidateEndDate, calendarEvents);
    }
    setJudgeResultMap(results);
  // candidateDates は依存に含めない（手動追加・削除後は「判定する」ボタンを使う）
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCompanyId, calendarEvents]);

  // 判定結果が変わったとき、無効になった選択を除外
  useEffect(() => {
    const validKeys = new Set(allAvailableRanges.map(rangeKey));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedRangeKeys((prev) => prev.filter((k) => validKeys.has(k)));
  }, [allAvailableRanges]);

  const addCandidateDate = (startDateTime: string, endDateTime: string) => {
    if (candidateDates.some((c) => c.candidateDate === startDateTime && c.candidateEndDate === endDateTime)) return;
    setCandidateDates((prev) => {
      const next: CandidateDate = {
        id: crypto.randomUUID(),
        candidateDate: startDateTime,
        candidateEndDate: endDateTime,
        status: "pending",
        sortOrder: prev.length,
      };
      return [...prev, next].sort((a, b) => a.candidateDate.localeCompare(b.candidateDate));
    });
    setJudgeResultMap(null);
  };

  const removeCandidateDate = (id: string) => {
    setCandidateDates((prev) => prev.filter((c) => c.id !== id));
    setJudgeResultMap(null);
  };

  const handleJudge = () => {
    const results: Record<string, RangeJudgeResult> = {};
    for (const c of candidateDates) {
      results[c.id] = judgeRangeAvailability(c.candidateDate, c.candidateEndDate, calendarEvents);
    }
    setJudgeResultMap(results);
    setIsNgExpanded(false);
  };

  const toggleRange = (key: string) => {
    setSelectedRangeKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  };

  const scrollToMailSection = () => {
    if (allAvailableRanges.length > 0 && activeSelectedRangeKeys.length === 0) {
      setSelectedRangeKeys(allAvailableRanges.map(rangeKey));
    }
    mailSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
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
        queryParams: { access_type: "offline", prompt: "consent" },
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
    } else {
      setCalendarEvents([]);
      setCalendarMessage("");
      setNeedsReauth(false);
    }
    setIsAuthLoading(false);
  };

  const reAuth = async () => {
    if (!hasSupabaseEnv) return;
    const supabase = createClient();
    await supabase.auth.signOut();
    setCalendarEvents([]);
    setCalendarMessage("");
    setNeedsReauth(false);
    await signInWithGoogle();
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
      setCalendarMessage("Googleトークンが見つかりません。");
      setNeedsReauth(true);
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
        headers: { Authorization: `Bearer ${providerToken}` },
      });

      if (response.status === 401) {
        setCalendarMessage("Googleトークンの有効期限が切れています。");
        setNeedsReauth(true);
        setIsCalendarLoading(false);
        return;
      }
      if (!response.ok) {
        setCalendarMessage("Googleカレンダーの取得に失敗しました。");
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
          return { id: item.id ?? `google-${index}`, title: item.summary ?? "予定", start, end };
        })
        .filter((event): event is CalendarEvent => event !== null);

      setCalendarEvents(events);
      setCalendarMessage(`${events.length}件の予定を同期しました`);
      setNeedsReauth(false);
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
          <p className="text-sm font-semibold text-blue-700">就活スケジュール調整アシスタント</p>
          <h1 className="mt-2 text-2xl font-bold">3ステップで面接日程を調整</h1>
          <p className="mt-2 text-sm text-slate-600">
            Googleカレンダーと連携して空き時間を自動チェック。面接の返信メールをすぐに作成できます。
          </p>
        </section>

        <GoogleAuthSection
          isSignedIn={isSignedIn}
          userEmail={userEmail}
          authMessage={authMessage}
          isAuthLoading={isAuthLoading}
          hasSupabaseEnv={hasSupabaseEnv}
          calendarMessage={calendarMessage}
          isCalendarLoading={isCalendarLoading}
          isCalendarSynced={isCalendarSynced}
          needsReauth={needsReauth}
          onSignIn={signInWithGoogle}
          onSignOut={signOut}
          onSyncCalendar={syncGoogleCalendar}
          onReAuth={reAuth}
        />

        <CandidateDateSection
          companies={companies}
          activeCompanyId={activeCompanyId}
          onSwitchCompany={switchCompany}
          onAddCompany={addCompany}
          onRemoveCompany={removeCompany}
          companyName={companyName}
          onCompanyNameChange={setCompanyName}
          candidateDates={candidateDates}
          onAddDate={addCandidateDate}
          onRemoveDate={removeCandidateDate}
          onJudge={handleJudge}
          hasJudgeResult={judgeResultMap !== null}
          isCalendarSynced={isCalendarSynced}
          availableRanges={allAvailableRanges}
          blockedRanges={allBlockedRanges}
          recommendedRangeKey={recommendedRangeKey}
          activeSelectedRangeKeys={activeSelectedRangeKeys}
          onToggleRange={toggleRange}
          isNgExpanded={isNgExpanded}
          onToggleNgExpanded={() => setIsNgExpanded((prev) => !prev)}
          onScrollToMail={scrollToMailSection}
        />

        <MailSection
          ref={mailSectionRef}
          emailBody={emailBody}
          canGenerateEmail={canGenerateEmail}
          companyName={companyName}
        />
      </div>
    </main>
  );
}
