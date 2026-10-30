import { getSupabaseServer } from "@/lib/supabase";
import { getSummary } from "@/lib/summary";
import type { ApiResult, SummaryData } from "@/lib/types";

// GET /api/summary — per-stack headline numbers for the main screen:
// open roles on LinkedIn (demand) + applicants (avg/max over the captured sample).
export async function GET() {
  const supabase = getSupabaseServer();
  if (!supabase) {
    return Response.json({ configured: false, data: null } satisfies ApiResult<SummaryData | null>);
  }

  const data = await getSummary(supabase);
  return Response.json({ configured: true, data } satisfies ApiResult<SummaryData | null>);
}
