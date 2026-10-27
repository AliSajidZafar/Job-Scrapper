import { getSupabaseServer } from "@/lib/supabase";
import type { ApiResult, ScrapeRun } from "@/lib/types";

// GET /api/status — the most recent scrape run, for the dashboard header badge.
export async function GET() {
  const supabase = getSupabaseServer();
  if (!supabase) {
    return Response.json({ configured: false, data: null } satisfies ApiResult<ScrapeRun | null>);
  }

  const { data, error } = await supabase
    .from("scrape_runs")
    .select("*")
    .order("ran_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return Response.json({
      configured: true,
      data: null,
      error: error.message,
    } satisfies ApiResult<ScrapeRun | null>);
  }

  return Response.json({
    configured: true,
    data: (data ?? null) as ScrapeRun | null,
  } satisfies ApiResult<ScrapeRun | null>);
}
