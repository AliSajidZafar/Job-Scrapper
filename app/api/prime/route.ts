import { getSupabaseServer } from "@/lib/supabase";
import { fetchAllRows } from "@/lib/paginate";
import { cached, CACHE_HEADERS } from "@/lib/cache";
import { PRIME_MAX_APPLICANTS, PRIME_MIN_STACK_DEMAND } from "@/lib/prime";
import type { ApiResult, PrimeData, PrimeJob, Stack } from "@/lib/types";

// GET /api/prime — the hottest roles across all 20 stacks, hottest first:
// FRESH (from the latest scrape), FEW applicants (<= 25), in a HIGH-DEMAND stack
// (open roles >= the cross-stack median). Velocity, when known, lifts a job up.
const LATEST_RUN_HOURS = 6;
const MAX_PRIME = 15;

export async function GET() {
  const supabase = getSupabaseServer();
  const empty: PrimeData = { as_of: null, jobs: [] };
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
  const empty: PrimeData = { as_of: null, jobs: [] };

  // 1. Current demand per stack = latest open-roles total, and the high-demand set.
  const { data: dem } = await supabase
    .from("stack_demand")
    .select("stack, total_results, day")
    .order("day", { ascending: false });
  const demandBy = new Map<Stack, number>();
  for (const d of (dem ?? []) as { stack: Stack; total_results: number | null }[]) {
    if (d.total_results != null && !demandBy.has(d.stack)) demandBy.set(d.stack, d.total_results);
  }

  // 2. The latest scrape run (jobs seen within LATEST_RUN_HOURS of the newest snapshot).
  const { data: newest } = await supabase
    .from("job_snapshots")
    .select("observed_at")
    .order("observed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!newest) return empty;
  const asOf = newest.observed_at as string;
  const since = new Date(Date.parse(asOf) - LATEST_RUN_HOURS * 3_600_000).toISOString();

  // 3. Fresh, low-competition jobs from that run, with their stacks.
  type Row = {
    id: string;
    linkedin_job_id: string;
    title: string;
    company: string;
    location: string | null;
    applicant_count: number | null;
    job_stacks: { stack: Stack }[];
  };
  const rows = await fetchAllRows<Row>(
    (from, to) =>
      supabase
        .from("jobs")
        .select("id, linkedin_job_id, title, company, location, applicant_count, job_stacks(stack), job_snapshots!inner(observed_at)")
        .gte("job_snapshots.observed_at", since)
        .not("applicant_count", "is", null)
        .lte("applicant_count", PRIME_MAX_APPLICANTS)
        .order("id")
        .range(from, to) as unknown as PromiseLike<{ data: Row[] | null; error: { message: string } | null }>,
  );
  if (!rows.length) return empty;

  // 4. Velocity (bonus signal) for whichever of these jobs have one.
  const velBy = new Map<string, number>();
  const ids = rows.map((r) => r.linkedin_job_id);
  for (let i = 0; i < ids.length; i += 200) {
    const { data: vel } = await supabase
      .from("job_applicant_velocity")
      .select("linkedin_job_id, applicants_per_hour")
      .in("linkedin_job_id", ids.slice(i, i + 200))
      .gt("applicants_per_hour", 0);
    for (const v of (vel ?? []) as { linkedin_job_id: string; applicants_per_hour: number | null }[]) {
      if (v.applicants_per_hour != null) velBy.set(v.linkedin_job_id, v.applicants_per_hour);
    }
  }

  // 5. Keep only jobs whose best stack is high-demand; rank hottest first.
  const dedup = new Map<string, Row>();
  for (const r of rows) if (!dedup.has(r.linkedin_job_id)) dedup.set(r.linkedin_job_id, r);

  const jobs: PrimeJob[] = [];
  for (const r of dedup.values()) {
    const openRoles = Math.max(0, ...(r.job_stacks ?? []).map((s) => demandBy.get(s.stack) ?? 0));
    if (openRoles < PRIME_MIN_STACK_DEMAND) continue;
    jobs.push({
      id: r.id,
      linkedin_job_id: r.linkedin_job_id,
      title: r.title,
      company: r.company,
      location: r.location,
      stacks: (r.job_stacks ?? []).map((s) => s.stack),
      applicant_count: r.applicant_count as number,
      open_roles: openRoles,
      applicants_per_hour: velBy.get(r.linkedin_job_id) ?? null,
    });
  }

  // Hottest first: a velocity reading wins, then market demand, then fewest applicants.
  jobs.sort((a, b) => {
    const av = a.applicants_per_hour ?? -1;
    const bv = b.applicants_per_hour ?? -1;
    if ((bv > 0) !== (av > 0)) return bv > 0 ? 1 : -1;
    if (bv !== av && (av > 0 || bv > 0)) return bv - av;
    if (b.open_roles !== a.open_roles) return b.open_roles - a.open_roles;
    return a.applicant_count - b.applicant_count;
  });

  // Spread across stacks (at most PER_STACK each) so the panel spans the market
  // rather than filling with one stack's listings.
  const PER_STACK = 2;
  const takenByStack = new Map<Stack, number>();
  const picked: PrimeJob[] = [];
  for (const j of jobs) {
    if (picked.length >= MAX_PRIME) break;
    const bucket = j.stacks.reduce((best, s) => ((demandBy.get(s) ?? 0) > (demandBy.get(best) ?? 0) ? s : best), j.stacks[0]);
    const n = takenByStack.get(bucket) ?? 0;
    if (n >= PER_STACK) continue;
    takenByStack.set(bucket, n + 1);
    picked.push(j);
  }

  return { as_of: asOf, jobs: picked };
}
