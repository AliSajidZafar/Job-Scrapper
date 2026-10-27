import { getSupabaseServer } from "@/lib/supabase";
import type { ApiResult, CompanyStackRow, Stack } from "@/lib/types";

// GET /api/company-map — company x stack pivot, from the company_stack_map view.
// Feeds the Company Stack Map (Tab 3).
export async function GET() {
  const supabase = getSupabaseServer();
  if (!supabase) {
    return Response.json({ configured: false, data: [] } satisfies ApiResult<CompanyStackRow[]>);
  }

  const { data, error } = await supabase
    .from("company_stack_map")
    .select("company, stack, open_roles")
    .order("company", { ascending: true });

  if (error) {
    return Response.json({
      configured: true,
      data: [],
      error: error.message,
    } satisfies ApiResult<CompanyStackRow[]>);
  }

  // Pivot the long rows (company, stack, count) into one row per company.
  const byCompany = new Map<string, CompanyStackRow>();
  for (const row of (data ?? []) as { company: string; stack: Stack; open_roles: number }[]) {
    const existing = byCompany.get(row.company) ?? { company: row.company, counts: {}, total: 0 };
    existing.counts[row.stack] = row.open_roles;
    existing.total += row.open_roles;
    byCompany.set(row.company, existing);
  }

  const rows = [...byCompany.values()].sort((a, b) => b.total - a.total);
  return Response.json({ configured: true, data: rows } satisfies ApiResult<CompanyStackRow[]>);
}
