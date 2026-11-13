import { getSupabaseServer } from "@/lib/supabase";
import { cached, CACHE_HEADERS } from "@/lib/cache";
import type { ApiResult, Stack, TrendPoint } from "@/lib/types";

// GET /api/trend — daily demand per stack, from the stack_demand view.
// Plots LinkedIn's reported result total (true demand, unaffected by the
// per-stack scrape cap — suggestion #2), falling back to the captured count.
// Feeds the Tech Stack Trend chart (Tab 1).
export async function GET() {
  const supabase = getSupabaseServer();
  if (!supabase) {
    return Response.json({ configured: false, data: [] } satisfies ApiResult<TrendPoint[]>);
  }

  try {
    const points = await cached<TrendPoint[]>("trend", 300_000, async () => {
      const { data, error } = await supabase
        .from("stack_demand")
        .select("day, stack, total_results, scraped_count")
        .order("day", { ascending: true });
      if (error) throw new Error(error.message);
      return (
        (data ?? []) as {
          day: string;
          stack: Stack;
          total_results: number | null;
          scraped_count: number | null;
        }[]
      ).map((r) => ({
        day: r.day,
        stack: r.stack,
        job_count: r.total_results ?? r.scraped_count ?? 0,
        scraped_count: r.scraped_count ?? undefined,
      }));
    });
    return Response.json({ configured: true, data: points } satisfies ApiResult<TrendPoint[]>, { headers: CACHE_HEADERS });
  } catch (e) {
    return Response.json({
      configured: true,
      data: [],
      error: e instanceof Error ? e.message : "Query failed",
    } satisfies ApiResult<TrendPoint[]>);
  }
}
