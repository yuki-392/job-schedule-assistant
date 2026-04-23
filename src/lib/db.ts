import { createClient } from "@/utils/supabase/client";
import type { CandidateDate } from "@/domain/judgeAvailability";

export type DbCompany = {
  id: string;
  name: string;
  candidateDates: CandidateDate[];
};

type CandidateRow = {
  id: string;
  candidate_date: string;
  candidate_end_date: string;
  status: string;
  sort_order: number;
};

type InterviewRow = {
  id: string;
  company_name: string;
  interview_candidates: CandidateRow[];
};

export async function fetchCompaniesFromDb(): Promise<DbCompany[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("interviews")
    .select("id, company_name, interview_candidates(id, candidate_date, candidate_end_date, status, sort_order)")
    .order("created_at", { ascending: true });

  if (error || !data) return [];

  return (data as InterviewRow[]).map((row) => ({
    id: row.id,
    name: row.company_name,
    candidateDates: (row.interview_candidates ?? [])
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((c) => ({
        id: c.id,
        candidateDate: c.candidate_date,
        candidateEndDate: c.candidate_end_date,
        status: c.status as "pending" | "rejected",
        sortOrder: c.sort_order,
      })),
  }));
}

export async function saveCompaniesToDb(companies: DbCompany[]): Promise<void> {
  if (companies.length === 0) return;

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  // 企業をupsert（IDが一致すれば更新、なければ挿入）
  const { error } = await supabase
    .from("interviews")
    .upsert(
      companies.map((c) => ({ id: c.id, user_id: user.id, company_name: c.name })),
      { onConflict: "id" },
    );
  if (error) return;

  // 現在のリストにない企業をDBから削除
  const companyIds = new Set(companies.map((c) => c.id));
  const { data: existing } = await supabase
    .from("interviews")
    .select("id")
    .eq("user_id", user.id);

  for (const row of existing ?? []) {
    if (!companyIds.has(row.id as string)) {
      await supabase.from("interviews").delete().eq("id", row.id);
    }
  }

  // 各企業の候補日を差し替え（削除→挿入）
  for (const company of companies) {
    await supabase
      .from("interview_candidates")
      .delete()
      .eq("interview_id", company.id);

    if (company.candidateDates.length > 0) {
      await supabase.from("interview_candidates").insert(
        company.candidateDates.map((c) => ({
          id: c.id,
          interview_id: company.id,
          candidate_date: c.candidateDate,
          candidate_end_date: c.candidateEndDate,
          status: c.status,
          sort_order: c.sortOrder,
        })),
      );
    }
  }
}
