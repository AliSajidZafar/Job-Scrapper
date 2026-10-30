import type { SupabaseClient } from "@supabase/supabase-js";
import { STACKS, type Stack, type StackSummary, type SummaryData } from "@/lib/types";

// Per-stack headline numbers: open roles on LinkedIn (demand) + applicants
// (avg/max over the captured sample). Shared by /api/summary, the auth pages'
// brand panel and the admin page.
export async function getSummary(supabase: SupabaseClient): Promise<SummaryData> {
  // Latest demand total per stack (stack_demand is ordered by day).
  const { data: demand } = await supabase
    .from("stack_demand")
    .select("day, stack, total_results")
    .order("day", { ascending: false });

  const openRoles = new Map<Stack, number>();
  for (const r of (demand ?? []) as { stack: Stack; total_results: number | null }[]) {
    if (!openRoles.has(r.stack) && r.total_results != null) openRoles.set(r.stack, r.total_results);
  }

  // Applicant stats over the captured jobs, aggregated per stack.
  const { data: jobs } = await supabase
    .from("jobs")
    .select("applicant_count, job_stacks(stack)")
    .limit(5000);

  const agg = new Map<Stack, { captured: number; sum: number; n: number; max: number }>();
  for (const s of STACKS) agg.set(s, { captured: 0, sum: 0, n: 0, max: 0 });

  let totalCaptured = 0;
  let allSum = 0;
  let allN = 0;
  for (const row of (jobs ?? []) as { applicant_count: number | null; job_stacks: { stack: Stack }[] }[]) {
    totalCaptured++;
    if (row.applicant_count != null) {
      allSum += row.applicant_count;
      allN++;
    }
    for (const js of row.job_stacks ?? []) {
      const a = agg.get(js.stack);
      if (!a) continue;
      a.captured++;
      if (row.applicant_count != null) {
        a.sum += row.applicant_count;
        a.n++;
        a.max = Math.max(a.max, row.applicant_count);
      }
    }
  }

  const stacks: StackSummary[] = STACKS.map((s) => {
    const a = agg.get(s)!;
    return {
      stack: s,
      open_roles: openRoles.get(s) ?? null,
      captured: a.captured,
      avg_applicants: a.n ? Math.round(a.sum / a.n) : null,
      max_applicants: a.n ? a.max : null,
    };
  });

  return {
    totals: {
      open_roles: stacks.reduce((n, s) => n + (s.open_roles ?? 0), 0),
      captured: totalCaptured,
      total_applicants: allSum,
      avg_applicants: allN ? Math.round(allSum / allN) : null,
    },
    stacks,
  };
}
