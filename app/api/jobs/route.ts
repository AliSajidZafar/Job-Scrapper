import { NextRequest } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";
import type { ApiResult, Job, Stack } from "@/lib/types";

// GET /api/jobs — the raw feed + competition table data source.
// Query params: stack (repeatable), from, to (ISO dates), jobType, location,
// easyApply ("true"/"false"), sort ("recent" | "applicants"), limit.
export async function GET(req: NextRequest) {
  const supabase = getSupabaseServer();
  if (!supabase) {
    return Response.json({ configured: false, data: [] } satisfies ApiResult<Job[]>);
  }

  const sp = req.nextUrl.searchParams;
  const stacks = sp.getAll("stack") as Stack[];
  const sort = sp.get("sort") ?? "recent";
  const limit = Math.min(Number(sp.get("limit") ?? 500), 1000);

  // Embed stack tags; use an inner join when filtering by stack.
  const stackJoin = stacks.length ? "job_stacks!inner(stack)" : "job_stacks(stack)";
  let query = supabase.from("jobs").select(`*, ${stackJoin}`).limit(limit);

  if (stacks.length) query = query.in("job_stacks.stack", stacks);
  if (sp.get("from")) query = query.gte("scraped_at", sp.get("from")!);
  if (sp.get("to")) query = query.lte("scraped_at", sp.get("to")!);
  if (sp.get("jobType")) query = query.eq("job_type", sp.get("jobType"));
  if (sp.get("location")) query = query.ilike("location", `%${sp.get("location")}%`);
  if (sp.get("easyApply")) query = query.eq("easy_apply", sp.get("easyApply") === "true");

  query =
    sort === "applicants"
      ? query.order("applicant_count", { ascending: false, nullsFirst: false })
      : query.order("scraped_at", { ascending: false });

  const { data, error } = await query;
  if (error) {
    return Response.json({ configured: true, data: [], error: error.message } satisfies ApiResult<Job[]>);
  }

  // Flatten embedded job_stacks into a string[] on each job.
  const jobs: Job[] = (data ?? []).map((row: Record<string, unknown>) => {
    const { job_stacks, ...job } = row;
    return {
      ...(job as Omit<Job, "stacks">),
      stacks: ((job_stacks as { stack: Stack }[]) ?? []).map((s) => s.stack),
    };
  });

  // Attach applicant velocity (applicants/hour) for these jobs, once two or more
  // runs have produced snapshots (suggestion #3). Skipped silently if the view
  // or data isn't there yet, so the feed still works before velocity exists.
  const ids = jobs.map((j) => j.linkedin_job_id);
  if (ids.length) {
    const { data: vel } = await supabase
      .from("job_applicant_velocity")
      .select("linkedin_job_id, applicants_per_hour")
      .in("linkedin_job_id", ids);
    if (vel) {
      const byId = new Map(
        (vel as { linkedin_job_id: string; applicants_per_hour: number | null }[]).map((v) => [
          v.linkedin_job_id,
          v.applicants_per_hour,
        ]),
      );
      for (const job of jobs) {
        if (byId.has(job.linkedin_job_id)) job.applicants_per_hour = byId.get(job.linkedin_job_id);
      }
    }
  }

  return Response.json({ configured: true, data: jobs } satisfies ApiResult<Job[]>);
}
