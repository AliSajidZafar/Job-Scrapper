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

  // Per-stack demand history, newest day first.
  const history = new Map<Stack, { day: string; total: number }[]>();
  for (const r of (demand ?? []) as { day: string; stack: Stack; total_results: number | null }[]) {
    if (r.total_results == null) continue;
    if (!history.has(r.stack)) history.set(r.stack, []);
    history.get(r.stack)!.push({ day: r.day, total: r.total_results });
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
    const h = history.get(s) ?? [];
    const latest = h[0];
    const prev = h[1];
    const weekAgo = latest && h.find((x) => daysBetween(x.day, latest.day) >= 7);
    return {
      stack: s,
      open_roles: latest?.total ?? null,
      captured: a.captured,
      avg_applicants: a.n ? Math.round(a.sum / a.n) : null,
      max_applicants: a.n ? a.max : null,
      prev_day: prev?.day ?? null,
      prev_open_roles: prev?.total ?? null,
      change_pct: latest && prev ? pctChange(prev.total, latest.total) : null,
      change_week_pct: latest && weekAgo ? pctChange(weekAgo.total, latest.total) : null,
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

const daysBetween = (older: string, newer: string) =>
  Math.round((Date.parse(newer) - Date.parse(older)) / 86_400_000);

const pctChange = (from: number, to: number) => (from ? Math.round(((to - from) / from) * 100) : null);
