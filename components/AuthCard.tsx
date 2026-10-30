import Link from "next/link";
import { getSupabaseServer } from "@/lib/supabase";
import { getSummary } from "@/lib/summary";
import { STACK_COLOR_VAR, type SummaryData } from "@/lib/types";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";

// Split-screen shell shared by the sign-in and create-account pages: a brand
// panel with live market numbers on the left (large screens), the form on the
// right. Falls back to just the form if the database isn't reachable.
export async function AuthCard({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  const market = await loadMarket();

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <BrandPanel market={market} />

      <div className="flex min-h-screen flex-col px-4 sm:px-8">
        <div className="flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-sm text-sub transition-colors hover:text-ink">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M15 18l-6-6 6-6" />
            </svg>
            Dashboard
          </Link>
          <ThemeToggle />
        </div>

        <main className="flex flex-1 items-center justify-center py-8">
          <div className="w-full max-w-sm">
            <Link href="/" className="mb-8 flex items-center gap-3 lg:hidden">
              <Logo className="h-10 w-10" />
              <span className="text-[15px] font-semibold leading-tight tracking-tight text-ink">
                Mavericks
                <span className="block text-brand">Market Intelligence</span>
              </span>
            </Link>

            <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
            <p className="mb-7 mt-1.5 text-sm text-sub">{subtitle}</p>
            {children}
            <div className="mt-6 border-t border-line pt-5 text-center text-sm text-sub">{footer}</div>
          </div>
        </main>

        <p className="pb-6 text-center text-xs text-muted">© {new Date().getFullYear()} Mavericks United</p>
      </div>
    </div>
  );
}

type Market = { summary: SummaryData; lastRun: string | null } | null;

async function loadMarket(): Promise<Market> {
  const supabase = getSupabaseServer();
  if (!supabase) return null;
  try {
    const [summary, run] = await Promise.all([
      getSummary(supabase),
      supabase.from("scrape_runs").select("ran_at").order("ran_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    return { summary, lastRun: (run.data?.ran_at as string | undefined) ?? null };
  } catch {
    return null;
  }
}

function BrandPanel({ market }: { market: Market }) {
  const stacks = market?.summary.stacks ?? [];
  const peak = Math.max(1, ...stacks.map((s) => s.open_roles ?? 0));
  const ranked = [...stacks].sort((a, b) => (b.open_roles ?? 0) - (a.open_roles ?? 0));

  return (
    <aside className="relative hidden overflow-hidden bg-[#0c3d44] text-white lg:flex lg:flex-col lg:justify-between lg:p-12">
      {/* Soft brand glow + dotted grid, purely decorative. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,#1a8d9b_0%,transparent_60%)] opacity-70" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.12]"
        style={{ backgroundImage: "radial-gradient(#ffffff 1px, transparent 1px)", backgroundSize: "22px 22px" }}
      />

      <Link href="/" className="relative flex items-center gap-3">
        <Logo className="h-10 w-10 ring-white/20" />
        <span className="text-[15px] font-semibold leading-tight tracking-tight">
          Mavericks
          <span className="block font-normal text-white/70">Market Intelligence</span>
        </span>
      </Link>

      <div className="relative max-w-md">
        <h2 className="text-3xl font-semibold leading-tight tracking-tight">
          See which tech stacks the US market is hiring for today.
        </h2>
        <p className="mt-3 text-[15px] leading-relaxed text-white/75">
          Fresh LinkedIn openings every day for SAP, Salesforce, MERN, .NET and Java, with live
          applicant counts so you know where the competition is thin.
        </p>

        {market && (
          <div className="mt-10 rounded-2xl border border-white/15 bg-white/[0.06] p-5 backdrop-blur-sm">
            <div className="grid grid-cols-3 gap-4">
              <PanelStat label="Open roles" value={market.summary.totals.open_roles} />
              <PanelStat label="Jobs tracked" value={market.summary.totals.captured} />
              <PanelStat label="Applicants" value={market.summary.totals.total_applicants} />
            </div>
            <div className="mt-5 space-y-2.5">
              {ranked.map((s) => (
                <div key={s.stack} className="grid grid-cols-[5.5rem_1fr_3.5rem] items-center gap-3 text-xs">
                  <span className="flex items-center gap-2 text-white/85">
                    <span className="h-2 w-2 rounded-full" style={{ background: `var(${STACK_COLOR_VAR[s.stack]})` }} />
                    {s.stack}
                  </span>
                  <span className="h-1.5 overflow-hidden rounded-full bg-white/10">
                    <span
                      className="block h-full rounded-full bg-white/80"
                      style={{ width: `${Math.max(3, ((s.open_roles ?? 0) / peak) * 100)}%` }}
                    />
                  </span>
                  <span className="text-right tabular-nums text-white/85">
                    {s.open_roles != null ? s.open_roles.toLocaleString() : "—"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <p className="relative flex items-center gap-2 text-xs text-white/60">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
        {market?.lastRun
          ? `Updated ${new Date(market.lastRun).toLocaleDateString("en-GB", { timeZone: "Asia/Karachi", day: "numeric", month: "short", year: "numeric" })} · refreshed daily from LinkedIn`
          : "Refreshed daily from LinkedIn"}
      </p>
    </aside>
  );
}

function PanelStat({ label, value }: { label: string; value: number | null }) {
  return (
    <div>
      <div className="text-2xl font-semibold tabular-nums tracking-tight">{value != null ? value.toLocaleString() : "—"}</div>
      <div className="mt-0.5 text-[11px] uppercase tracking-wide text-white/60">{label}</div>
    </div>
  );
}
