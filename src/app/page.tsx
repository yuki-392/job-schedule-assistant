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
import { fetchCompaniesFromDb, saveCompaniesToDb } from "@/lib/db";
import { GoogleAuthSection } from "@/components/GoogleAuthSection";
import { CandidateDateSection } from "@/components/CandidateDateSection";
import { MailSection } from "@/components/MailSection";

type Company = {
  id: string;
  name: string;
  candidateDates: CandidateDate[];
  selectedRangeKeys: string[];
};

function toIsoRange(days = 21) {
  const now = new Date();
  const end = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  return { from: now.toISOString(), to: end.toISOString() };
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

  const [companies, setCompanies, isCompaniesHydrated] = useLocalStorage<Company[]>("jsa:companies", []);
  const [activeCompanyId, setActiveCompanyId] = useLocalStorage("jsa:activeCompanyId", "");
  const [judgeResultMap, setJudgeResultMap] = useState<Record<string, RangeJudgeResult> | null>(null);
  const [isJudgeLoading, setIsJudgeLoading] = useState(false);
  const [isNgExpanded, setIsNgExpanded] = useState(false);

  // ハイドレーション完了後にのみ実行（リロード時に保存済みデータを上書きしないため）
  useEffect(() => {
    if (!isCompaniesHydrated) return;
    if (companies.length === 0) {
      const id = crypto.randomUUID();
      setCompanies([{ id, name: "", candidateDates: [], selectedRangeKeys: [] }]);
      setActiveCompanyId(id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCompaniesHydrated]);

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

  // 非同期コールバック内で常に最新のcompaniesを参照するためのref
  const companiesRef = useRef(companies);
  companiesRef.current = companies;

  // ログイン直後: DBにデータがあればロード、なければlocalStorageのデータをDBへ初回同期
  useEffect(() => {
    if (!isSignedIn || !isCompaniesHydrated) return;
    fetchCompaniesFromDb().then((dbCompanies) => {
      if (dbCompanies.length > 0) {
        const loaded: Company[] = dbCompanies.map((c) => ({ ...c, selectedRangeKeys: [] }));
        setCompanies(loaded);
        setActiveCompanyId(loaded[0].id);
      } else {
        void saveCompaniesToDb(
          companiesRef.current.map(({ id, name, candidateDates }) => ({ id, name, candidateDates })),
        );
      }
    });
  // isSignedIn / isCompaniesHydrated の変化時のみ実行（companiesは ref 経由で参照）
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn, isCompaniesHydrated]);

  // ログイン中の変更を1.5秒デバウンスでDBへ同期
  useEffect(() => {
    if (!isSignedIn || !isCompaniesHydrated) return;
    const timer = setTimeout(() => {
      void saveCompaniesToDb(
        companies.map(({ id, name, candidateDates }) => ({ id, name, candidateDates })),
      );
    }, 1500);
    return () => clearTimeout(timer);
  }, [isSignedIn, isCompaniesHydrated, companies]);

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

  const [emailBody, setEmailBody] = useState("");

  useEffect(() => {
    if (!canGenerateEmail) {
      setEmailBody("");
      return;
    }
    const activeRanges = allAvailableRanges.filter((r) => activeSelectedRangeKeys.includes(rangeKey(r)));
    fetch("/api/mail/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyName, selectedRanges: activeRanges }),
    })
      .then((res) => res.json() as Promise<{ body?: string }>)
      .then((json) => { if (json.body) setEmailBody(json.body); })
      .catch(() => {
        const rangeText = activeRanges.map((r) => `- ${formatRangeDate(r.start, r.end)}`).join("\n");
        setEmailBody(`${companyName} 採用ご担当者様\n\nお世話になっております。面接日程のご連絡ありがとうございます。\n以下の時間帯で参加可能です。\n\n${rangeText}\n\n何卒よろしくお願いいたします。`);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canGenerateEmail, companyName, activeSelectedRangeKeys.join(","), allAvailableRanges]);

  // 企業切り替えとカレンダー同期時に自動で判定（候補日の追加・削除には反応しない）
  useEffect(() => {
    if (!activeCompanyId || candidateDates.length === 0) {
      setJudgeResultMap(null);
      return;
    }
    fetch("/api/interviews/judge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        candidateRanges: candidateDates.map((c) => ({ id: c.id, start: c.candidateDate, end: c.candidateEndDate })),
        calendarEvents,
      }),
    })
      .then((res) => res.json() as Promise<{ results?: Record<string, RangeJudgeResult> }>)
      .then((json) => { if (json.results) setJudgeResultMap(json.results); })
      .catch(() => {
        const results: Record<string, RangeJudgeResult> = {};
        for (const c of candidateDates) {
          results[c.id] = judgeRangeAvailability(c.candidateDate, c.candidateEndDate, calendarEvents);
        }
        setJudgeResultMap(results);
      });
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

  const handleJudge = async () => {
    setIsNgExpanded(false);
    setIsJudgeLoading(true);
    try {
      const response = await fetch("/api/interviews/judge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidateRanges: candidateDates.map((c) => ({ id: c.id, start: c.candidateDate, end: c.candidateEndDate })),
          calendarEvents,
        }),
      });
      const json = await response.json() as { results?: Record<string, RangeJudgeResult>; error?: { code: string; message: string } };
      if (response.ok && json.results) {
        setJudgeResultMap(json.results);
      }
    } catch {
      const results: Record<string, RangeJudgeResult> = {};
      for (const c of candidateDates) {
        results[c.id] = judgeRangeAvailability(c.candidateDate, c.candidateEndDate, calendarEvents);
      }
      setJudgeResultMap(results);
    } finally {
      setIsJudgeLoading(false);
    }
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
    setIsCalendarLoading(true);
    setCalendarMessage("");

    const { from, to } = toIsoRange(21);
    const url = new URL("/api/calendar/events", window.location.origin);
    url.searchParams.set("from", from);
    url.searchParams.set("to", to);

    try {
      const response = await fetch(url.toString());
      const json = await response.json() as { events?: CalendarEvent[]; error?: { code: string; message: string } };

      if (response.status === 401) {
        setCalendarMessage("Googleトークンの有効期限が切れています。");
        setNeedsReauth(true);
        return;
      }
      if (!response.ok) {
        setCalendarMessage(json.error?.message ?? "Googleカレンダーの取得に失敗しました。");
        return;
      }

      const events = json.events ?? [];
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
          isJudgeLoading={isJudgeLoading}
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
