import { NextRequest } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";
import { fetchLiveApplicantCount } from "@/lib/linkedin";
import type { ApiResult, RefreshResult } from "@/lib/types";

export const dynamic = "force-dynamic";

// GET /api/refresh?id=<linkedin_job_id> — fetch this one job's current applicant
// count from LinkedIn and store it. Only jobs we already track can be refreshed,
// so this can't be used as an open LinkedIn proxy.
export async function GET(req: NextRequest) {
  const supabase = getSupabaseServer();
  if (!supabase) {
    return Response.json({ configured: false, data: null } satisfies ApiResult<RefreshResult | null>);
  }

  const id = (req.nextUrl.searchParams.get("id") ?? "").trim();
  if (!/^\d{5,}$/.test(id)) {
    return Response.json(
      { configured: true, data: null, error: "Invalid job id" } satisfies ApiResult<RefreshResult | null>,
      { status: 400 },
    );
  }

  const { data: job, error: jobErr } = await supabase
    .from("jobs")
    .select("id, linkedin_job_id")
    .eq("linkedin_job_id", id)
    .maybeSingle();
  if (jobErr) {
    return Response.json(
      { configured: true, data: null, error: jobErr.message } satisfies ApiResult<RefreshResult | null>,
    );
  }
  if (!job) {
    return Response.json(
      { configured: true, data: null, error: "This job isn't tracked" } satisfies ApiResult<RefreshResult | null>,
      { status: 404 },
    );
  }

  let applicant_count: number | null;
  try {
    applicant_count = await fetchLiveApplicantCount(id);
  } catch (e) {
    return Response.json(
      {
        configured: true,
        data: null,
        error: e instanceof Error ? e.message : "Couldn't reach LinkedIn",
      } satisfies ApiResult<RefreshResult | null>,
      { status: 502 },
    );
  }

  const checked_at = new Date().toISOString();
  // Only overwrite when we actually read a number; a missing count shouldn't wipe
  // a good stored value. (No job_snapshots row — that would shift the
  // "latest scrape" window the Opportunities tab relies on.)
  if (applicant_count != null) {
    await supabase.from("jobs").update({ applicant_count }).eq("id", job.id);
  }

  return Response.json({
    configured: true,
    data: { linkedin_job_id: id, applicant_count, checked_at },
  } satisfies ApiResult<RefreshResult | null>);
}
