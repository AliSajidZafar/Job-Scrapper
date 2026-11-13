import { NextRequest } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";
import { fetchAllRows } from "@/lib/paginate";
import type { ApiResult, Job, Stack } from "@/lib/types";

// "Latest" = the jobs first captured by the most recent scrape run: everything
// within this many hours of the newest job. A run takes up to ~1h and runs are
// daily, so 6h never reaches back into the previous day's run. Anchoring to the
// newest job (not the wall clock) keeps "Latest" populated between runs and
// after a missed day.
const LATEST_RUN_HOURS = 6;

type Rows = Record<string, unknown>[];
type RowsResult = PromiseLike<{ data: Rows | null; error: { message: string } | null }>;

// GET /api/jobs — the raw feed + competition table data source.
// Query params: stack (repeatable), range ("latest"), from, to (ISO dates),
// jobType, location, easyApply ("true"/"false"), sort ("recent" | "applicants"),
// limit (optional). Without `limit` every matching job is returned, so the
// count the dashboard shows is the true total for the chosen period.
export async function GET(req: NextRequest) {
  const supabase = getSupabaseServer();
  if (!supabase) {
    return Response.json({ configured: false, data: [] } satisfies ApiResult<Job[]>);
  }

  const sp = req.nextUrl.searchParams;
  const stacks = sp.getAll("stack") as Stack[];
  const sort = sp.get("sort") ?? "recent";
  const limitParam = Number(sp.get("limit"));
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 1000) : null;

  // Period start: an explicit `from`, or the start of the latest scrape run.
  let from = sp.get("from");
  if (sp.get("range") === "latest") {
    const { data: newest } = await supabase
      .from("jobs")
      .select("scraped_at")
      .order("scraped_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (newest) {
      from = new Date(Date.parse(newest.scraped_at as string) - LATEST_RUN_HOURS * 3_600_000).toISOString();
    }
  }

  // Embed stack tags; use an inner join when filtering by stack.
  const stackJoin = stacks.length ? "job_stacks!inner(stack)" : "job_stacks(stack)";
  const build = () => {
    let query = supabase.from("jobs").select(`*, ${stackJoin}`);

    if (stacks.length) query = query.in("job_stacks.stack", stacks);
    if (from) query = query.gte("scraped_at", from);
    if (sp.get("to")) query = query.lte("scraped_at", sp.get("to")!);
    if (sp.get("jobType")) query = query.eq("job_type", sp.get("jobType"));
    if (sp.get("location")) query = query.ilike("location", `%${sp.get("location")}%`);
    if (sp.get("easyApply")) query = query.eq("easy_apply", sp.get("easyApply") === "true");

    query =
      sort === "applicants"
        ? query.order("applicant_count", { ascending: false, nullsFirst: false })
        : query.order("scraped_at", { ascending: false });
    // Jobs saved in one batch share a scraped_at, so `id` breaks ties — without
    // it, paging through the result could repeat or skip rows.
    return query.order("id", { ascending: true });
  };

  // A single request is capped at 1000 rows, so page through the full result.
  let data: Rows;
  try {
    if (limit) {
      const res = await (build().limit(limit) as unknown as RowsResult);
      if (res.error) throw new Error(res.error.message);
      data = res.data ?? [];
    } else {
      data = await fetchAllRows<Rows[number]>((start, end) => build().range(start, end) as unknown as RowsResult);
    }
  } catch (e) {
    return Response.json({
      configured: true,
      data: [],
      error: e instanceof Error ? e.message : "Query failed",
    } satisfies ApiResult<Job[]>);
  }

  // Flatten embedded job_stacks into a string[] on each job.
  const jobs: Job[] = data.map((row: Record<string, unknown>) => {
    const { job_stacks, ...job } = row;
    return {
      ...(job as Omit<Job, "stacks">),
      stacks: ((job_stacks as { stack: Stack }[]) ?? []).map((s) => s.stack),
    };
  });

  // Attach applicant velocity (applicants/hour). Only jobs seen on two or more
  // runs have one, so read just those rows (paged) rather than passing thousands
  // of job ids in the request URL.
  if (jobs.length) {
    try {
      const vel = await fetchAllRows<{ linkedin_job_id: string; applicants_per_hour: number | null }>(
        (start, end) =>
          supabase
            .from("job_applicant_velocity")
            .select("linkedin_job_id, applicants_per_hour")
            .not("applicants_per_hour", "is", null)
            .order("linkedin_job_id", { ascending: true })
            .range(start, end),
      );
      const byId = new Map(vel.map((v) => [v.linkedin_job_id, v.applicants_per_hour]));
      for (const job of jobs) {
        if (byId.has(job.linkedin_job_id)) job.applicants_per_hour = byId.get(job.linkedin_job_id);
      }
    } catch {
      // Velocity is optional — the feed still works without it.
    }
  }

  return Response.json({ configured: true, data: jobs } satisfies ApiResult<Job[]>);
}
