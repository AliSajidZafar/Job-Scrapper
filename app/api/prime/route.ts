import { getSupabaseServer } from "@/lib/supabase";
import { getSummary } from "@/lib/summary";
import { fetchAllRows } from "@/lib/paginate";
import { cached, CACHE_HEADERS } from "@/lib/cache";
import { PRIME_MAX_APPLICANTS, rankPrimeStacks } from "@/lib/prime";
import type { ApiResult, PrimeData, Stack } from "@/lib/types";

// GET /api/prime: the Prime Opportunities panel. The top 10 of the tracked
// stacks ranked by opportunity score (open roles ÷ avg applicants, see
// lib/prime.ts), plus the ids of the fresh, <= 25-applicant jobs in those
// stacks so every job list can badge them as Prime.
const LATEST_RUN_HOURS = 6;

export async function GET() {
  const supabase = getSupabaseServer();
  const empty: PrimeData = { as_of: null, stacks: [], job_ids: [] };
  if (!supabase) {
    return Response.json({ configured: false, data: empty } satisfies ApiResult<PrimeData>);
  }

  try {
    const data = await cached<PrimeData>("prime", 300_000, () => compute(supabase));
    return Response.json({ configured: true, data } satisfies ApiResult<PrimeData>, { headers: CACHE_HEADERS });
  } catch (e) {
    return Response.json({
      configured: true,
      data: empty,
      error: e instanceof Error ? e.message : "Query failed",
    } satisfies ApiResult<PrimeData>);
  }
}

async function compute(supabase: NonNullable<ReturnType<typeof getSupabaseServer>>): Promise<PrimeData> {
  // 1. Rank the stacks from the same numbers the "Demand by stack" tiles show
  //    (the shared "summary" cache entry), so the panel and the tiles agree.
  const summary = await cached("summary", 300_000, () => getSummary(supabase));
  const stacks = rankPrimeStacks(summary.stacks);
  if (!stacks.length) return { as_of: null, stacks, job_ids: [] };
  const top = new Set<Stack>(stacks.map((s) => s.stack));

  // 2. The latest scrape run (jobs seen within LATEST_RUN_HOURS of the newest snapshot).
  const { data: newest } = await supabase
    .from("job_snapshots")
    .select("observed_at")
    .order("observed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!newest) return { as_of: null, stacks, job_ids: [] };
  const asOf = newest.observed_at as string;
  const since = new Date(Date.parse(asOf) - LATEST_RUN_HOURS * 3_600_000).toISOString();

  // 3. Fresh, low-competition jobs from that run that belong to a Prime stack.
  type Row = { id: string; linkedin_job_id: string; job_stacks: { stack: Stack }[] };
  const rows = await fetchAllRows<Row>(
    (from, to) =>
      supabase
        .from("jobs")
        .select("id, linkedin_job_id, job_stacks(stack), job_snapshots!inner(observed_at)")
        .gte("job_snapshots.observed_at", since)
        .not("applicant_count", "is", null)
        .lte("applicant_count", PRIME_MAX_APPLICANTS)
        .order("id")
        .range(from, to) as unknown as PromiseLike<{ data: Row[] | null; error: { message: string } | null }>,
  );
  const ids = new Set<string>();
  for (const r of rows) {
    if ((r.job_stacks ?? []).some((s) => top.has(s.stack))) ids.add(r.linkedin_job_id);
  }

  return { as_of: asOf, stacks, job_ids: [...ids] };
}
