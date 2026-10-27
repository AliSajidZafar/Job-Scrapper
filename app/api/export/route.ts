import { getSupabaseServer } from "@/lib/supabase";
import type { Stack } from "@/lib/types";

// GET /api/export — download the current job feed as CSV (Raw Feed tab).
export async function GET() {
  const supabase = getSupabaseServer();
  if (!supabase) {
    return new Response("Supabase not configured", { status: 503 });
  }

  const { data, error } = await supabase
    .from("jobs")
    .select("*, job_stacks(stack)")
    .order("scraped_at", { ascending: false })
    .limit(5000);

  if (error) return new Response(error.message, { status: 500 });

  const header = [
    "linkedin_job_id",
    "title",
    "company",
    "stacks",
    "location",
    "job_type",
    "easy_apply",
    "applicant_count",
    "posted_at",
    "scraped_at",
  ];

  const rows = (data ?? []).map((row: Record<string, unknown>) => {
    const stacks = ((row.job_stacks as { stack: Stack }[]) ?? []).map((s) => s.stack).join("|");
    return [
      row.linkedin_job_id,
      row.title,
      row.company,
      stacks,
      row.location,
      row.job_type,
      row.easy_apply,
      row.applicant_count,
      row.posted_at,
      row.scraped_at,
    ]
      .map(csvCell)
      .join(",");
  });

  const csv = [header.join(","), ...rows].join("\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="jobs-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
