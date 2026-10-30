import { NextRequest } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";
import type { ApiResult, FastJob, Job, OpportunitiesData, Stack } from "@/lib/types";

// Jobs seen within this many hours of the newest snapshot count as "the latest
// scrape". A run takes up to ~1h; runs are daily, so 6h never reaches the
// previous day's run.
const WINDOW_HOURS = 6;

// GET /api/opportunities — where competition is thin right now.
// low: jobs from the latest scrape with <= maxApplicants (default 100), fewest
// first. fastest: jobs gaining applicants quickest across runs (applicants/hr).
export async function GET(req: NextRequest) {
  const supabase = getSupabaseServer();
  const empty: OpportunitiesData = { as_of: null, scanned: 0, max_applicants: 0, low: [], fastest: [] };
  if (!supabase) {
    return Response.json({ configured: false, data: empty } satisfies ApiResult<OpportunitiesData>);
  }

  const maxApplicants = Math.min(Math.max(Number(req.nextUrl.searchParams.get("maxApplicants") ?? 100), 1), 1000);

  // jobs.scraped_at is only set on first insert, so "latest scrape" comes from
  // job_snapshots, which gets a row for every job on every run.
  const { data: newest } = await supabase
    .from("job_snapshots")
    .select("observed_at")
    .order("observed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!newest) {
    return Response.json({ configured: true, data: empty } satisfies ApiResult<OpportunitiesData>);
  }
  const since = new Date(Date.parse(newest.observed_at as string) - WINDOW_HOURS * 3_600_000).toISOString();

  const [lowRes, scannedRes, velRes] = await Promise.all([
    supabase
      .from("jobs")
      .select("*, job_stacks(stack), job_snapshots!inner(observed_at)")
      .gte("job_snapshots.observed_at", since)
      .not("applicant_count", "is", null)
      .lte("applicant_count", maxApplicants)
      .order("applicant_count", { ascending: true })
      .order("posted_at", { ascending: false, nullsFirst: false })
      .limit(200),
    supabase
      .from("jobs")
      .select("id, job_snapshots!inner(observed_at)", { count: "exact", head: true })
      .gte("job_snapshots.observed_at", since),
    supabase
      .from("job_applicant_velocity")
      .select("id, linkedin_job_id, title, company, first_count, latest_count, hours_tracked, applicants_per_hour")
      .gt("applicants_per_hour", 0)
      .order("applicants_per_hour", { ascending: false })
      .limit(15),
  ]);

  if (lowRes.error) {
    return Response.json({ configured: true, data: empty, error: lowRes.error.message } satisfies ApiResult<OpportunitiesData>);
  }

  const low: Job[] = (lowRes.data ?? []).map((row: Record<string, unknown>) => {
    const { job_stacks, job_snapshots: _snapshots, ...job } = row;
    return {
      ...(job as Omit<Job, "stacks">),
      stacks: ((job_stacks as { stack: Stack }[]) ?? []).map((s) => s.stack),
    };
  });

  // Stack tags + location for the fast-filling jobs (the view doesn't carry them).
  const vel = (velRes.data ?? []) as Omit<FastJob, "stacks" | "location">[];
  const extra = new Map<string, { location: string | null; stacks: Stack[] }>();
  if (vel.length) {
    const { data } = await supabase
      .from("jobs")
      .select("id, location, job_stacks(stack)")
      .in(
        "id",
        vel.map((v) => v.id),
      );
    for (const r of (data ?? []) as { id: string; location: string | null; job_stacks: { stack: Stack }[] }[]) {
      extra.set(r.id, { location: r.location, stacks: (r.job_stacks ?? []).map((s) => s.stack) });
    }
  }
  const fastest: FastJob[] = vel.map((v) => ({
    ...v,
    location: extra.get(v.id)?.location ?? null,
    stacks: extra.get(v.id)?.stacks ?? [],
  }));

  return Response.json({
    configured: true,
    data: {
      as_of: newest.observed_at as string,
      scanned: scannedRes.count ?? 0,
      max_applicants: maxApplicants,
      low,
      fastest,
    },
  } satisfies ApiResult<OpportunitiesData>);
}
