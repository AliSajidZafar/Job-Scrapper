import { NextRequest } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";
import { seniorityOf, type Seniority } from "@/lib/seniority";
import { STACKS, type ApiResult, type JobType, type StackDetail, type StackJob, type Stack } from "@/lib/types";

// GET /api/stack?stack=<name> — the per-stack drill-down: demand history,
// applicant competition, experience-level split, top hirers and the job list.
// Everything is read live from Supabase, so it's as fresh as the latest scrape.
// The full tracked set is returned (not a slice), so the drawer's list length
// always equals the "tracked" count shown on the tile and in the header.
const COMPANY_LIMIT = 8;

export async function GET(req: NextRequest) {
  const supabase = getSupabaseServer();
  const stack = req.nextUrl.searchParams.get("stack") as Stack | null;

  if (!stack || !STACKS.includes(stack)) {
    return Response.json({ configured: !!supabase, data: null, error: "Unknown stack" } satisfies ApiResult<StackDetail | null>, {
      status: 400,
    });
  }
  if (!supabase) {
    return Response.json({ configured: false, data: null } satisfies ApiResult<StackDetail | null>);
  }

  const [demandRes, jobsRes, lastRes] = await Promise.all([
    supabase.from("stack_demand").select("day, total_results, scraped_count").eq("stack", stack).order("day", { ascending: true }),
    supabase
      .from("jobs")
      .select("id, linkedin_job_id, title, company, location, job_type, applicant_count, posted_at, scraped_at, job_stacks!inner(stack)")
      .eq("job_stacks.stack", stack)
      .limit(1000),
    supabase.from("search_snapshots").select("searched_at").eq("stack", stack).order("searched_at", { ascending: false }).limit(1).maybeSingle(),
  ]);

  if (jobsRes.error) {
    return Response.json({ configured: true, data: null, error: jobsRes.error.message } satisfies ApiResult<StackDetail | null>);
  }

  type Row = {
    id: string;
    linkedin_job_id: string;
    title: string;
    company: string;
    location: string | null;
    job_type: JobType | null;
    applicant_count: number | null;
    posted_at: string | null;
    scraped_at: string;
  };
  const rows = (jobsRes.data ?? []) as unknown as Row[];

  // Applicant velocity (applicants/hour) for these jobs, when it exists.
  const ids = rows.map((r) => r.linkedin_job_id);
  const velBy = new Map<string, number | null>();
  if (ids.length) {
    const { data: vel } = await supabase
      .from("job_applicant_velocity")
      .select("linkedin_job_id, applicants_per_hour")
      .in("linkedin_job_id", ids);
    for (const v of (vel ?? []) as { linkedin_job_id: string; applicants_per_hour: number | null }[]) {
      velBy.set(v.linkedin_job_id, v.applicants_per_hour);
    }
  }

  // Per-job shape + experience level.
  const jobs: StackJob[] = rows
    .map((r) => ({
      id: r.id,
      linkedin_job_id: r.linkedin_job_id,
      title: r.title,
      company: r.company,
      location: r.location,
      job_type: r.job_type,
      applicant_count: r.applicant_count,
      posted_at: r.posted_at,
      seniority: seniorityOf(r.title),
      applicants_per_hour: velBy.get(r.linkedin_job_id) ?? null,
    }))
    // Fewest applicants first (the opportunities read), unknowns last.
    .sort((a, b) => (a.applicant_count ?? Infinity) - (b.applicant_count ?? Infinity));

  // Applicant stats over jobs that reported a count.
  const counts = jobs.map((j) => j.applicant_count).filter((n): n is number => n != null).sort((a, b) => a - b);
  const total = counts.reduce((s, n) => s + n, 0);
  const median = counts.length ? counts[Math.floor((counts.length - 1) / 2)] : null;

  // Experience-level split.
  const seniority: Record<Seniority, number> = { junior: 0, mid: 0, senior: 0 };
  for (const j of jobs) seniority[j.seniority]++;

  // Top hirers for this stack.
  const byCompany = new Map<string, { count: number; sum: number; n: number }>();
  for (const j of jobs) {
    const c = byCompany.get(j.company) ?? { count: 0, sum: 0, n: 0 };
    c.count++;
    if (j.applicant_count != null) {
      c.sum += j.applicant_count;
      c.n++;
    }
    byCompany.set(j.company, c);
  }
  const companies = [...byCompany.entries()]
    .map(([company, c]) => ({ company, count: c.count, avg_applicants: c.n ? Math.round(c.sum / c.n) : null }))
    .sort((a, b) => b.count - a.count || (b.avg_applicants ?? 0) - (a.avg_applicants ?? 0))
    .slice(0, COMPANY_LIMIT);

  // Demand history (oldest → newest) + open-roles headline/change.
  const demand = (demandRes.data ?? []) as { day: string; total_results: number | null; scraped_count: number | null }[];
  const trend = demand.map((d) => ({ day: d.day, open_roles: d.total_results, captured: d.scraped_count ?? 0 }));
  const latest = demand[demand.length - 1];
  const prev = demand[demand.length - 2];
  const open_roles = latest?.total_results ?? null;
  const prev_open_roles = prev?.total_results ?? null;
  const change_pct =
    open_roles != null && prev_open_roles != null && prev_open_roles !== 0
      ? Math.round(((open_roles - prev_open_roles) / prev_open_roles) * 100)
      : null;

  const detail: StackDetail = {
    stack,
    as_of: (lastRes.data?.searched_at as string | undefined) ?? (rows[0]?.scraped_at ?? null),
    open_roles,
    prev_open_roles,
    change_pct,
    captured: jobs.length,
    applicants: {
      withCount: counts.length,
      avg: counts.length ? Math.round(total / counts.length) : null,
      median,
      max: counts.length ? counts[counts.length - 1] : null,
      total,
    },
    seniority,
    trend,
    companies,
    jobs, // every tracked posting, so the list matches `captured` exactly
  };

  return Response.json({ configured: true, data: detail } satisfies ApiResult<StackDetail | null>);
}
