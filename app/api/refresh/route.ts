import { NextRequest } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";
import { fetchLiveApplicants, delay } from "@/lib/linkedin";
import { clearCache } from "@/lib/cache";
import type { ApiResult, RefreshResult } from "@/lib/types";

export const dynamic = "force-dynamic";

// GET /api/refresh?id=<linkedin_job_id> — fetch this one job's CURRENT applicant
// count from LinkedIn (its exact wording), on demand. Works for any job shown on
// the site: the tracked drill-downs and the Prime live drawer (whose roles come
// straight from LinkedIn search and usually aren't tracked). When the job IS one
// we track, we also sync the stored count so the tiles/lists stay in step; a
// live-only job just returns its count without writing anything.
export async function GET(req: NextRequest) {
  const id = (req.nextUrl.searchParams.get("id") ?? "").trim();
  if (!/^\d{5,}$/.test(id)) {
    return Response.json(
      { configured: true, data: null, error: "Invalid job id" } satisfies ApiResult<RefreshResult | null>,
      { status: 400 },
    );
  }

  // Read the live count, retrying on a transient failure (LinkedIn rate-limits
  // the data-center IP with a 429 when several refreshes land close together).
  // Two spaced attempts with a short per-attempt timeout recover most of those
  // misses while keeping the whole request well under the tunnel's timeout (so
  // it always returns our JSON, never a gateway error page).
  let live: { count: number | null; text: string | null } | null = null;
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      live = await fetchLiveApplicants(id, 7_000);
      lastErr = null;
      break;
    } catch (e) {
      lastErr = e;
      if (attempt < 1) await delay(700 + Math.random() * 400);
    }
  }
  if (!live) {
    return Response.json(
      {
        configured: true,
        data: null,
        error: lastErr instanceof Error ? lastErr.message : "Couldn't reach LinkedIn",
      } satisfies ApiResult<RefreshResult | null>,
      { status: 502 },
    );
  }

  // If this job is tracked, keep the stored count in sync so the tiles/lists
  // reflect it too. Only overwrite when we actually read a number — a missing
  // count shouldn't wipe a good stored value. (No job_snapshots row: that would
  // shift the "latest scrape" window the Opportunities tab relies on.)
  const supabase = getSupabaseServer();
  if (supabase && live.count != null) {
    const { data: job } = await supabase
      .from("jobs")
      .select("id")
      .eq("linkedin_job_id", id)
      .maybeSingle();
    if (job) {
      await supabase.from("jobs").update({ applicant_count: live.count }).eq("id", job.id);
      clearCache(); // the cached tiles/lists must reflect the new count on next load
    }
  }

  return Response.json({
    configured: true,
    data: {
      linkedin_job_id: id,
      applicant_count: live.count,
      applicant_text: live.text,
      checked_at: new Date().toISOString(),
    },
  } satisfies ApiResult<RefreshResult | null>);
}
