import { NextRequest } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";
import { fetchAllRows } from "@/lib/paginate";
import { seniorityOf, type Seniority } from "@/lib/seniority";
import { STACKS, type ApiResult, type CompanyDetail, type JobType, type Stack, type StackJob } from "@/lib/types";

// GET /api/company?name=<company> — the per-company drill-down: how many roles
// they're hiring, which stacks, applicant competition, experience split and the
// job list. Read live from Supabase, so it's as fresh as the latest scrape.
export async function GET(req: NextRequest) {
  const supabase = getSupabaseServer();
  const name = (req.nextUrl.searchParams.get("name") ?? "").trim();

  if (!name) {
    return Response.json(
      { configured: !!supabase, data: null, error: "Missing company" } satisfies ApiResult<CompanyDetail | null>,
      { status: 400 },
    );
  }
  if (!supabase) {
    return Response.json({ configured: false, data: null } satisfies ApiResult<CompanyDetail | null>);
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
    job_stacks: { stack: Stack }[];
  };

  // Exact-match the company (case-insensitively), paged so a big hirer is complete.
  let rows: Row[];
  try {
    rows = await fetchAllRows<Row>(
      (from, to) =>
        supabase
          .from("jobs")
          .select("id, linkedin_job_id, title, company, location, job_type, applicant_count, posted_at, scraped_at, job_stacks(stack)")
          .ilike("company", name)
          .order("id")
          .range(from, to) as unknown as PromiseLike<{ data: Row[] | null; error: { message: string } | null }>,
    );
  } catch (e) {
    return Response.json(
      { configured: true, data: null, error: e instanceof Error ? e.message : "Query failed" } satisfies ApiResult<CompanyDetail | null>,
    );
  }

  if (!rows.length) {
    return Response.json(
      { configured: true, data: null, error: "No tracked jobs for this company" } satisfies ApiResult<CompanyDetail | null>,
      { status: 404 },
    );
  }

  // Velocity (applicants/hour) for these jobs, when it exists.
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
    .sort((a, b) => (a.applicant_count ?? Infinity) - (b.applicant_count ?? Infinity));

  // Applicant stats over jobs that reported a count.
  const counts = jobs.map((j) => j.applicant_count).filter((n): n is number => n != null).sort((a, b) => a - b);
  const total = counts.reduce((s, n) => s + n, 0);
  const median = counts.length ? counts[Math.floor((counts.length - 1) / 2)] : null;

  // Per-stack counts (a job can span stacks), most roles first.
  const byStack = new Map<Stack, number>();
  for (const r of rows) for (const js of r.job_stacks ?? []) byStack.set(js.stack, (byStack.get(js.stack) ?? 0) + 1);
  const stacks = STACKS.filter((s) => byStack.has(s))
    .map((s) => ({ stack: s, count: byStack.get(s)! }))
    .sort((a, b) => b.count - a.count);

  // Experience-level split.
  const seniority: Record<Seniority, number> = { junior: 0, mid: 0, senior: 0 };
  for (const j of jobs) seniority[j.seniority]++;

  const detail: CompanyDetail = {
    company: rows[0].company, // canonical casing from the data
    as_of: rows.reduce<string | null>((max, r) => (max && max > r.scraped_at ? max : r.scraped_at), null),
    captured: jobs.length,
    stacks,
    applicants: {
      withCount: counts.length,
      avg: counts.length ? Math.round(total / counts.length) : null,
      median,
      max: counts.length ? counts[counts.length - 1] : null,
    },
    seniority,
    jobs,
  };

  return Response.json({ configured: true, data: detail } satisfies ApiResult<CompanyDetail | null>);
}
