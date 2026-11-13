"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  STACKS,
  STACK_COLOR_VAR,
  STACK_SHORT,
  type ApiResult,
  type CompanyStackRow,
  type FastJob,
  type Job,
  type OpportunitiesData,
  type ScrapeRun,
  type SessionUser,
  type Stack,
  type StackSummary,
  type SummaryData,
  type TrendPoint,
} from "@/lib/types";
import { BANDS, BAND_BADGE, BAND_DOT, bandDef, bandOf, applicantLabel, type Band } from "@/lib/applicants";
import { TrendChart } from "./TrendChart";
import { Sparkline } from "./Sparkline";
import { StackDetail } from "./StackDetail";
import { CompanyDetail } from "./CompanyDetail";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";

const TABS = ["Trend", "Opportunities", "Competition", "Company Map", "Raw Feed"] as const;
type Tab = (typeof TABS)[number];

// Period filter options, applied to when each job was first captured
// (scraped_at). "" = no limit. "latest" = the most recent scrape run, resolved
// on the server from the newest job — not the wall clock — so it stays filled
// between runs. The day options count back from now.
type DateRange = "" | "latest" | "7d" | "30d" | "90d";
const DATE_RANGE_DAYS: Record<Exclude<DateRange, "" | "latest">, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};
const DATE_RANGE_LABEL: Record<Exclude<DateRange, "">, string> = {
  latest: "Latest scrape",
  "7d": "Past 7 days",
  "30d": "Past 30 days",
  "90d": "Past 90 days",
};
// The tabs whose data the Period filter changes (the jobs feed).
const PERIOD_TABS: readonly string[] = ["Competition", "Raw Feed"];
// Rows shown per page in the job tables and phone card lists.
const PAGE_SIZE = 50;

interface Filters {
  stacks: Stack[];
  jobType: "" | "contract" | "full_time";
  location: string;
  easyApply: "" | "true" | "false";
  dateRange: DateRange;
}

const EMPTY_FILTERS: Filters = { stacks: [], jobType: "", location: "", easyApply: "", dateRange: "" };

// Build the /api/jobs URL for a set of filters. Module-scoped and called from the
// fetch effect (not during render), so reading the clock here stays pure-safe.
function buildJobsUrl(f: Filters): string {
  const p = new URLSearchParams();
  f.stacks.forEach((s) => p.append("stack", s));
  if (f.dateRange === "latest") {
    p.set("range", "latest");
  } else if (f.dateRange) {
    const days = DATE_RANGE_DAYS[f.dateRange];
    p.set("from", new Date(Date.now() - days * 86_400_000).toISOString());
  }
  if (f.jobType) p.set("jobType", f.jobType);
  if (f.location) p.set("location", f.location);
  if (f.easyApply) p.set("easyApply", f.easyApply);
  p.set("sort", "recent");
  return `/api/jobs?${p.toString()}`;
}

export function Dashboard({ user }: { user: SessionUser | null }) {
  const [tab, setTab] = useState<Tab>("Trend");
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);

  const [configured, setConfigured] = useState<boolean | null>(null);
  const [status, setStatus] = useState<ScrapeRun | null>(null);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [companyMap, setCompanyMap] = useState<CompanyStackRow[]>([]);
  const [opps, setOpps] = useState<OpportunitiesData | null>(null);
  // Two loading tracks: `bootLoading` for the filter-independent data fetched
  // once on mount, `jobsLoading` for the filter-dependent jobs feed.
  const [bootLoading, setBootLoading] = useState(true);
  const [jobsLoading, setJobsLoading] = useState(true);

  // Filter-independent data (status, summary, trend, company map, opportunities)
  // doesn't change with filters or tabs, so fetch it once and reuse it — switching
  // tabs no longer refetches anything.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [statusRes, summaryRes, trendRes, mapRes, oppsRes] = await Promise.all([
        fetchJson<ScrapeRun | null>("/api/status"),
        fetchJson<SummaryData | null>("/api/summary"),
        fetchJson<TrendPoint[]>("/api/trend"),
        fetchJson<CompanyStackRow[]>("/api/company-map"),
        fetchJson<OpportunitiesData>("/api/opportunities"),
      ]);
      if (cancelled) return;
      setConfigured(statusRes.configured);
      setStatus(statusRes.data ?? null);
      setSummary(summaryRes.data ?? null);
      setTrend(trendRes.data ?? []);
      setCompanyMap(mapRes.data ?? []);
      setOpps(oppsRes.data ?? null);
      setBootLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // The jobs feed (Competition + Raw Feed) is the only filter-dependent data, so
  // it refetches when a filter changes — not on every tab switch. Sorting is done
  // client-side (sortable columns), so the request order is always "recent".
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setJobsLoading(true);
      const res = await fetchJson<Job[]>(buildJobsUrl(filters));
      if (cancelled) return;
      setJobs(res.data ?? []);
      setJobsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [filters]);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-line bg-card/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <Logo className="h-9 w-9 text-brand" />
            <div className="leading-tight">
              <div className="text-[15px] font-semibold tracking-tight text-ink">
                Mavericks <span className="text-brand">Market Intelligence</span>
              </div>
              <div className="hidden text-xs text-muted sm:block">
                US remote IT hiring demand &amp; competition · {STACKS.length} tech stacks
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden md:inline-flex">
              <StatusBadge configured={configured} status={status} />
            </span>
            <AccountControls user={user} />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-8 overflow-x-clip px-4 py-8 sm:py-8">
        {configured === false && <NotConfigured />}

        <SummarySection summary={summary} trend={trend} loading={bootLoading && !summary} />

        <div>
          <FilterBar filters={filters} setFilters={setFilters} />

          {/* Tabs scroll horizontally on narrow screens so every tab is reachable. */}
          <nav className="no-scrollbar mt-6 flex gap-1 overflow-x-auto border-b border-line">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`-mb-px shrink-0 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                  tab === t
                    ? "border-brand text-brand"
                    : "border-transparent text-muted hover:text-ink"
                }`}
              >
                {t}
              </button>
            ))}
          </nav>

          <section className="mt-6">
            {/* The Period filter only changes the jobs feed — say so on the other
                tabs, so picking a period there doesn't look like it did nothing. */}
            {filters.dateRange && !PERIOD_TABS.includes(tab) && (
              <p className="mb-3 rounded-lg border border-line bg-plane/40 px-3 py-2 text-xs text-muted">
                <span className="font-medium text-ink">Period: {DATE_RANGE_LABEL[filters.dateRange]}</span> applies to the{" "}
                <button type="button" onClick={() => setTab("Competition")} className="font-medium text-brand hover:underline">
                  Competition
                </button>{" "}
                and{" "}
                <button type="button" onClick={() => setTab("Raw Feed")} className="font-medium text-brand hover:underline">
                  Raw Feed
                </button>{" "}
                tabs.{" "}
                {tab === "Trend"
                  ? "The trend chart always shows the full history."
                  : tab === "Opportunities"
                    ? "Opportunities always come from the latest scrape."
                    : "The company map always covers every tracked job."}
              </p>
            )}
            {tab === "Trend" &&
              (bootLoading && trend.length === 0 ? (
                <ChartSkeleton />
              ) : (
                <Card>
                  <SectionTitle
                    title="Demand trend"
                    hint="Open roles per stack (LinkedIn result totals). Use the stack filter above to focus on a few."
                  />
                  <TrendChart points={trend} visible={filters.stacks} />
                </Card>
              ))}
            {tab === "Opportunities" &&
              (bootLoading && !opps ? <TableSkeleton rows={6} /> : <OpportunitiesView data={opps} filters={filters} />)}
            {tab === "Competition" &&
              (jobsLoading ? <TableSkeleton rows={8} /> : <CompetitionTable jobs={jobs} filters={filters} />)}
            {tab === "Company Map" &&
              (bootLoading && companyMap.length === 0 ? <TableSkeleton rows={8} /> : <CompanyMapTable rows={companyMap} />)}
            {tab === "Raw Feed" &&
              (jobsLoading ? <TableSkeleton rows={8} /> : <RawFeedTable jobs={jobs} filters={filters} />)}
          </section>
        </div>
      </main>
    </div>
  );
}

async function fetchJson<T>(url: string): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url);
    return (await res.json()) as ApiResult<T>;
  } catch {
    return { configured: false, data: null as unknown as T };
  }
}

/* ---------------------------- skeletons ---------------------------- */

// Shimmer placeholder for a table while its data loads — matches the real
// table's card shell so switching tabs doesn't flash bare "Loading…" text.
function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-card" aria-hidden>
      <div className="h-10 border-b border-line bg-plane/50" />
      <div className="divide-y divide-line">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3.5">
            <div className="h-4 flex-1 animate-pulse rounded bg-line/60" />
            <div className="hidden h-4 w-28 animate-pulse rounded bg-line/60 sm:block" />
            <div className="h-4 w-16 animate-pulse rounded bg-line/60" />
          </div>
        ))}
      </div>
    </div>
  );
}

// Shimmer placeholder for the trend chart.
function ChartSkeleton() {
  return (
    <Card>
      <div className="mb-4 h-4 w-40 animate-pulse rounded bg-line/60" />
      <div className="h-64 w-full animate-pulse rounded-lg bg-line/40" />
    </Card>
  );
}

/* ----------------------------- summary ----------------------------- */

function SummarySection({
  summary,
  trend,
  loading,
}: {
  summary: SummaryData | null;
  trend: TrendPoint[];
  loading: boolean;
}) {
  // Per-stack open-roles history (oldest → newest) for the tile sparklines,
  // plus a whole-market total per day for the headline sparkline.
  const { byStack, totalByDay } = buildHistories(trend);
  // The stack whose drill-down drawer is open.
  const [selected, setSelected] = useState<Stack | null>(null);

  return (
    <section className="space-y-6">
      <KpiBand summary={summary} totalByDay={totalByDay} loading={loading} />

      <div>
        <div className="mb-3">
          {/* desktop: the total-open-roles caption sits above, right-aligned */}
          <div className="mb-1 hidden text-right text-xs text-muted sm:block">
            Total open roles on LinkedIn · last {totalByDay.length || "—"} days
          </div>
          <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Demand by stack</h2>
            <span className="hidden text-xs text-muted sm:inline">Select a stack for the full breakdown</span>
            {/* mobile: one compact caption under the heading */}
            <span className="text-xs text-muted sm:hidden">
              Total open roles · last {totalByDay.length || "—"} days · open a tile for details
            </span>
          </div>
        </div>
        {summary && <MoversStrip stacks={summary.stacks} />}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {loading || !summary
            ? STACKS.map((s) => <TileSkeleton key={s} />)
            : summary.stacks.map((s) => (
                <StackTile key={s.stack} s={s} history={byStack.get(s.stack) ?? []} onSelect={setSelected} />
              ))}
        </div>
      </div>

      <StackDetail stack={selected} onClose={() => setSelected(null)} />
    </section>
  );
}

// Flatten trend points into per-stack series and a market total per day, both
// ordered oldest → newest so sparklines read left-to-right like the big chart.
function buildHistories(trend: TrendPoint[]) {
  const days = [...new Set(trend.map((p) => p.day))].sort();
  const lookup = new Map<string, number>();
  for (const p of trend) lookup.set(`${p.day}|${p.stack}`, p.job_count);

  const byStack = new Map<Stack, number[]>();
  for (const s of STACKS) {
    const series = days.map((d) => lookup.get(`${d}|${s}`) ?? 0);
    // Drop leading zeros (days before a stack existed) so new stacks don't
    // show a misleading flat run at the bottom.
    const firstReal = series.findIndex((v) => v > 0);
    byStack.set(s, firstReal === -1 ? [] : series.slice(firstReal));
  }

  const totalByDay = days.map((d) =>
    STACKS.reduce((sum, s) => sum + (lookup.get(`${d}|${s}`) ?? 0), 0),
  );
  return { byStack, totalByDay };
}

/* ------------------------------ KPI band ---------------------------- */

// Executive headline band: the four numbers that frame the whole dashboard,
// promoted from the old inline strip into proper stat tiles. The first carries
// a market-wide sparkline and a day-over-day delta; the rest stay clean.
function KpiBand({
  summary,
  totalByDay,
  loading,
}: {
  summary: SummaryData | null;
  totalByDay: number[];
  loading: boolean;
}) {
  if (loading || !summary) {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-[112px] animate-pulse rounded-2xl border border-line bg-card" />
        ))}
      </div>
    );
  }

  const t = summary.totals;
  const openDelta =
    totalByDay.length >= 2
      ? pctChangeLocal(totalByDay[totalByDay.length - 2], totalByDay[totalByDay.length - 1])
      : null;

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Kpi
        label="Open roles"
        value={t.open_roles.toLocaleString()}
        hint={`across ${STACKS.length} tech stacks`}
        delta={openDelta}
        spark={totalByDay}
        accent="var(--brand)"
        icon={
          <path d="M3 17l5-5 3 3 7-7M14 8h5v5" />
        }
      />
      <Kpi
        label="Jobs tracked"
        value={t.captured.toLocaleString()}
        hint="pulled in detail & re-checked"
        icon={
          <>
            <path d="M4 7h16M4 12h16M4 17h10" />
          </>
        }
      />
      <Kpi
        label="Total applicants"
        value={t.total_applicants.toLocaleString()}
        hint="across tracked jobs"
        icon={
          <>
            <circle cx="9" cy="8" r="3" />
            <path d="M15 11a3 3 0 1 0-1.5-5.6M4 20a5 5 0 0 1 10 0M14 20a5 5 0 0 1 6-4.6" />
          </>
        }
      />
      <Kpi
        label="Avg applicants"
        value={t.avg_applicants != null ? String(t.avg_applicants) : "—"}
        hint="per tracked job · competition"
        icon={
          <>
            <path d="M3 20h18" />
            <rect x="5" y="11" width="3.5" height="7" rx="1" />
            <rect x="10.25" y="7" width="3.5" height="11" rx="1" />
            <rect x="15.5" y="13" width="3.5" height="5" rx="1" />
          </>
        }
      />
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
  delta = null,
  spark,
  accent = "var(--brand)",
  icon,
}: {
  label: string;
  value: string;
  hint: string;
  delta?: number | null;
  spark?: number[];
  accent?: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-line bg-card p-4 transition-colors hover:border-brand/50">
      {/* hairline accent rule along the top edge */}
      <span className="absolute inset-x-0 top-0 h-[3px]" style={{ background: accent, opacity: 0.85 }} />
      <div className="flex items-start justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</span>
        <span className="text-muted/70 transition-colors group-hover:text-brand">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            {icon}
          </svg>
        </span>
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-[28px] font-semibold leading-none tracking-tight tabular-nums text-ink">{value}</span>
        {delta != null && <Delta pct={delta} />}
      </div>
      <div className="mt-1 text-xs text-muted">{hint}</div>
      {spark && spark.length >= 2 && (
        <Sparkline values={spark} color={accent} className="mt-2.5 h-7 w-full" />
      )}
    </div>
  );
}

const pctChangeLocal = (from: number, to: number) =>
  from ? Math.round(((to - from) / from) * 100) : null;

const shortDate = (iso: string) =>
  new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

// The date a job was posted (falls back to when we scraped it). The YYYY-MM-DD
// slice sorts chronologically as a plain string and renders in one consistent
// format, so the Competition "Posted" column reads in order.
const postedKey = (j: { posted_at: string | null; scraped_at: string }) =>
  (j.posted_at ?? j.scraped_at).slice(0, 10);

// Biggest riser / faller in open roles since the previous scrape day.
function MoversStrip({ stacks }: { stacks: StackSummary[] }) {
  const moving = stacks.filter((s) => s.change_pct != null);
  if (!moving.length) return null;
  const sorted = [...moving].sort((a, b) => b.change_pct! - a.change_pct!);
  const up = sorted[0].change_pct! > 0 ? sorted[0] : null;
  const down = sorted[sorted.length - 1].change_pct! < 0 ? sorted[sorted.length - 1] : null;
  const since = moving[0].prev_day;

  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-line bg-card px-4 py-2.5 text-sm">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted">Movers</span>
      <Mover s={up} label="Rising most" none="no stack rose" />
      <Mover s={down} label="Falling most" none="no stack fell" />
      {since && (
        <span
          className="ml-auto text-xs text-muted"
          title="LinkedIn rounds large totals (e.g. 1,000+), so big stacks move in steps."
        >
          vs {shortDate(since)}
        </span>
      )}
    </div>
  );
}

function Mover({ s, label, none }: { s: StackSummary | null; label: string; none: string }) {
  if (!s) {
    return (
      <span className="inline-flex items-center gap-2">
        <span className="text-sub">{label}:</span>
        <span className="text-muted">None, {none}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-2">
      <span className="text-sub">{label}:</span>
      <span className="inline-flex items-center gap-1.5 font-medium text-ink">
        <span className="h-2 w-2 rounded-full" style={{ background: `var(${STACK_COLOR_VAR[s.stack]})` }} />
        {s.stack}
      </span>
      <Delta pct={s.change_pct} />
    </span>
  );
}

// Signed % change chip: green up, red down, muted flat.
function Delta({ pct, suffix }: { pct: number | null; suffix?: string }) {
  if (pct == null) return null;
  const tone = pct > 0 ? "bg-good/10 text-good" : pct < 0 ? "bg-crit/10 text-crit" : "bg-line/60 text-muted";
  const arrow = pct > 0 ? "▲" : pct < 0 ? "▼" : "•";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${tone}`}>
      {arrow} {Math.abs(pct)}%{suffix ? <span className="font-normal opacity-80">{suffix}</span> : null}
    </span>
  );
}

function StackTile({ s, history, onSelect }: { s: StackSummary; history: number[]; onSelect: (stack: Stack) => void }) {
  const noData = s.open_roles == null && s.captured === 0;
  const color = `var(${STACK_COLOR_VAR[s.stack]})`;
  return (
    <button
      type="button"
      onClick={() => onSelect(s.stack)}
      aria-label={`View ${s.stack} details`}
      className="group relative w-full overflow-hidden rounded-xl border border-line bg-card p-3 text-left transition-all hover:-translate-y-0.5 hover:border-brand/60 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 sm:p-4"
    >
      <div className="flex items-center justify-between gap-1.5">
        <span className="inline-flex min-w-0 items-center gap-1.5 text-sm font-medium text-ink">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: `var(${STACK_COLOR_VAR[s.stack]})` }} />
          <span className="truncate">
            <span className="sm:hidden">{STACK_SHORT[s.stack]}</span>
            <span className="hidden sm:inline">{s.stack}</span>
          </span>
          <svg viewBox="0 0 24 24" className="hidden h-3.5 w-3.5 shrink-0 text-muted opacity-0 transition-opacity group-hover:opacity-100 sm:block" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="m9 18 6-6-6-6" />
          </svg>
        </span>
        {noData ? (
          <span className="shrink-0 rounded-full border border-dashed border-line px-2 py-0.5 text-[11px] font-medium text-muted">
            Soon
          </span>
        ) : (
          s.max_applicants != null && (
            <span className="hidden shrink-0 rounded-full bg-brand-soft px-1.5 py-0.5 text-[10px] font-medium text-brand sm:inline-block sm:px-2 sm:text-[11px]">
              max {s.max_applicants}
            </span>
          )
        )}
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-2xl font-semibold tabular-nums text-ink">
          {s.open_roles != null ? s.open_roles.toLocaleString() : "—"}
        </span>
        <span title={s.prev_day ? `vs ${shortDate(s.prev_day)} (${s.prev_open_roles?.toLocaleString()})` : undefined}>
          <Delta pct={s.change_pct} />
        </span>
      </div>
      <div className="text-xs text-muted">
        open roles on LinkedIn
        {s.change_week_pct != null && (
          <span className="ml-1">
            · <Delta pct={s.change_week_pct} suffix=" 7d" />
          </span>
        )}
      </div>
      {history.length >= 2 ? (
        <Sparkline values={history} color={color} className="mt-2.5 h-7 w-full" />
      ) : (
        // No multi-day history yet (new stacks) — a faint baseline keeps the
        // tiles aligned and hints that the trend line is still being collected.
        <div className="mt-2.5 flex h-7 items-center" aria-hidden title="Trend builds over the next few scrapes">
          <div className="w-full border-t border-dashed border-line" />
        </div>
      )}
      <div className="mt-2.5 flex items-center justify-between border-t border-line pt-2 text-xs text-sub">
        <span>
          <span className="tabular-nums text-ink">{s.captured}</span> tracked
        </span>
        <span>
          <span className="tabular-nums text-ink">{s.avg_applicants ?? "—"}</span> avg applicants
        </span>
      </div>
    </button>
  );
}

function TileSkeleton() {
  return <div className="h-[184px] animate-pulse rounded-xl border border-line bg-card" />;
}

/* ----------------------------- chrome ------------------------------ */


// Professional account control: a single trigger in the header that opens a
// dropdown panel — a proper account section rather than loose buttons. Signed
// out it presents sign-in / create-account; signed in, an avatar menu.
function AccountControls({ user }: { user: SessionUser | null }) {
  // Signed out: visible, discoverable sign-in / create-account buttons.
  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <a
          href="/login"
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-card px-3 text-xs font-medium text-ink transition-colors hover:border-brand"
        >
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3" />
          </svg>
          Sign in
        </a>
        <a
          href="/signup"
          className="hidden h-9 items-center rounded-lg bg-brand px-3 text-xs font-semibold text-brand-ink transition-opacity hover:opacity-90 sm:inline-flex"
        >
          Create account
        </a>
      </div>
    );
  }

  // Signed in: a proper avatar dropdown menu.
  return <AccountMenu user={user} />;
}

function AccountMenu({ user }: { user: SessionUser }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex h-9 items-center gap-2 rounded-lg border border-line bg-card py-1 pl-1 pr-2.5 text-xs font-medium text-ink transition-colors hover:border-brand"
      >
        <Avatar name={user.name} className="h-7 w-7 text-[11px]" />
        <span className="hidden max-w-28 truncate sm:inline">{user.name.split(" ")[0]}</span>
        <svg viewBox="0 0 24 24" className={`h-3.5 w-3.5 text-muted transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-40 mt-2 w-60 origin-top-right overflow-hidden rounded-xl border border-line bg-card shadow-lg shadow-black/5"
        >
          <div className="flex items-center gap-3 border-b border-line px-4 py-3">
            <Avatar name={user.name} className="h-9 w-9 text-xs" />
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-ink">{user.name}</div>
              <div className="truncate text-xs text-muted">{user.role === "admin" ? "Administrator" : "User"}</div>
            </div>
          </div>
          <div className="p-1.5">
            {user.role === "admin" && (
              <MenuLink href="/admin">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="4" y="11" width="16" height="10" rx="2" />
                  <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                </svg>
                Admin dashboard
              </MenuLink>
            )}
            <form action="/api/auth/logout" method="post">
              <button
                type="submit"
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-sub transition-colors hover:bg-plane hover:text-crit"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
                </svg>
                Sign out
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function MenuLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-sub transition-colors hover:bg-plane hover:text-ink"
    >
      {children}
    </a>
  );
}

function Avatar({ name, className = "" }: { name: string; className?: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
  return (
    <span className={`grid shrink-0 place-items-center rounded-md bg-brand-soft font-semibold text-brand ${className}`}>
      {initials || "?"}
    </span>
  );
}

function StatusBadge({ configured, status }: { configured: boolean | null; status: ScrapeRun | null }) {
  if (configured === false) {
    return <Pill tone="warn">Not connected</Pill>;
  }
  if (!status) return <Pill tone="muted">No runs yet</Pill>;
  const tone = status.status === "success" ? "good" : status.status === "partial" ? "warn" : "crit";
  return (
    <Pill tone={tone}>
      <span className="hidden sm:inline">{status.jobs_found} jobs · </span>
      {shortDate(status.ran_at)}
    </Pill>
  );
}

function Pill({ tone, children }: { tone: "good" | "warn" | "crit" | "muted"; children: React.ReactNode }) {
  const dot =
    tone === "good" ? "bg-good" : tone === "warn" ? "bg-warn" : tone === "crit" ? "bg-crit" : "bg-muted";
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-card px-2.5 py-1 text-xs text-sub">
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {children}
    </span>
  );
}

function NotConfigured() {
  return (
    <div className="rounded-xl border border-line bg-brand-soft p-4 text-sm text-ink">
      Supabase isn&apos;t configured. Copy <code className="font-mono text-xs">.env.example</code> to{" "}
      <code className="font-mono text-xs">.env.local</code>, run <code className="font-mono text-xs">supabase/schema.sql</code>,
      then scrape with <code className="font-mono text-xs">npm run scrape</code>.
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-line bg-card p-5">{children}</div>;
}

function SectionTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mb-4">
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}

function FilterBar({ filters, setFilters }: { filters: Filters; setFilters: (f: Filters) => void }) {
  const toggleStack = (s: Stack) =>
    setFilters({
      ...filters,
      stacks: filters.stacks.includes(s) ? filters.stacks.filter((x) => x !== s) : [...filters.stacks, s],
    });

  const active =
    filters.stacks.length || filters.jobType || filters.location || filters.easyApply || filters.dateRange;

  return (
    <div className="space-y-3 rounded-xl border border-line bg-card p-3">
      {/* stacks — exactly 10 per row (fewer on small screens), left-aligned pills */}
      <div className="grid grid-cols-3 justify-items-start gap-1.5 min-[480px]:grid-cols-5 sm:grid-cols-10">
        {STACKS.map((s) => {
          const on = filters.stacks.includes(s);
          return (
            <button
              key={s}
              onClick={() => toggleStack(s)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                on ? "border-brand bg-brand text-brand-ink" : "border-line text-sub hover:text-ink"
              }`}
            >
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: on ? "currentColor" : `var(${STACK_COLOR_VAR[s]})` }} />
              {STACK_SHORT[s]}
            </button>
          );
        })}
      </div>

      {/* date range + job type + how-to-apply + location */}
      <div className="flex flex-wrap items-end gap-x-5 gap-y-3 border-t border-line pt-3">
        <FilterGroup label="Period">
          <Segmented
            value={filters.dateRange}
            onChange={(v) => setFilters({ ...filters, dateRange: v as Filters["dateRange"] })}
            options={[
              { value: "", label: "All" },
              { value: "latest", label: "Latest" },
              { value: "7d", label: "7 days" },
              { value: "30d", label: "30 days" },
              { value: "90d", label: "90 days" },
            ]}
          />
        </FilterGroup>

        <FilterGroup label="Job type">
          <Segmented
            value={filters.jobType}
            onChange={(v) => setFilters({ ...filters, jobType: v as Filters["jobType"] })}
            options={[
              { value: "", label: "All" },
              { value: "contract", label: "Contract" },
              { value: "full_time", label: "Full-time" },
            ]}
          />
        </FilterGroup>

        <FilterGroup label="How to apply">
          <Segmented
            value={filters.easyApply}
            onChange={(v) => setFilters({ ...filters, easyApply: v as Filters["easyApply"] })}
            options={[
              { value: "", label: "All" },
              { value: "true", label: "Easy Apply" },
              { value: "false", label: "External" },
            ]}
          />
        </FilterGroup>

        <FilterGroup label="Location">
          <input
            placeholder="City, state…"
            value={filters.location}
            onChange={(e) => setFilters({ ...filters, location: e.target.value })}
            className="w-36 rounded-lg border border-line bg-plane px-2.5 py-1.5 text-xs text-ink outline-none placeholder:text-muted focus:border-brand"
          />
        </FilterGroup>

        {active ? (
          <button
            onClick={() => setFilters(EMPTY_FILTERS)}
            className="ml-auto self-end text-xs font-medium text-muted underline-offset-2 hover:text-ink hover:underline"
          >
            Clear all
          </button>
        ) : null}
      </div>
    </div>
  );
}

// Labelled filter control.
function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-1">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</span>
      </div>
      {children}
    </div>
  );
}

// Segmented button group — a clearer, one-tap alternative to a dropdown.
function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="inline-flex rounded-lg border border-line bg-plane p-0.5" role="group">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
            value === o.value ? "bg-brand text-brand-ink shadow-sm" : "text-sub hover:text-ink"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* --------------------------- opportunities -------------------------- */

const linkedinUrl = (id: string) => `https://www.linkedin.com/jobs/view/${id}`;

// All Opportunities filters applied to a job (stack, location, type, how-to-apply).
// FastJob rows don't carry job_type/easy_apply, so those two checks skip for them.
function matchesFilters(
  j: { stacks: Stack[]; location: string | null; job_type?: string | null; easy_apply?: boolean | null },
  f: Filters,
) {
  if (f.stacks.length && !j.stacks.some((s) => f.stacks.includes(s))) return false;
  if (f.location && !(j.location ?? "").toLowerCase().includes(f.location.toLowerCase())) return false;
  if (f.jobType && j.job_type !== undefined && j.job_type !== f.jobType) return false;
  if (f.easyApply && j.easy_apply !== undefined && j.easy_apply !== (f.easyApply === "true")) return false;
  return true;
}

// The fetched opportunity pool is capped at ≤100 applicants, so three bands:
// Fresh (<25) / Low (25–50) / Busy (50–100). They never overlap.
const OPP_BANDS = BANDS.slice(0, 3);

function OpportunitiesView({ data, filters }: { data: OpportunitiesData | null; filters: Filters }) {
  const [band, setBand] = useState<Band>("fresh");
  if (!data || !data.as_of) return <Empty />;

  const pool = data.low.filter((j) => j.applicant_count != null && matchesFilters(j, filters));
  const inBand = (b: Band) => pool.filter((j) => bandOf(j.applicant_count!) === b);
  const counts: Record<Band, number> = {
    fresh: inBand("fresh").length,
    low: inBand("low").length,
    busy: inBand("busy").length,
    crowded: 0,
  };
  const shown = inBand(band);
  const def = bandDef(band);
  const filtered = !!(filters.stacks.length || filters.jobType || filters.location || filters.easyApply);
  const fastest = data.fastest.filter((j) => matchesFilters(j, filters));
  const asOf = new Date(data.as_of).toLocaleString("en-GB", {
    timeZone: "Asia/Karachi",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="min-w-0 rounded-xl border border-line bg-card lg:col-span-2">
        <div className="border-b border-line px-5 py-4">
          <h3 className="text-sm font-semibold text-ink">Jobs by competition</h3>
          <p className="mt-0.5 text-xs text-muted">
            <span className="font-medium text-ink tabular-nums">{pool.length}</span> low-competition jobs (≤100 applicants)
            from the latest scrape ({asOf} PKT){filtered ? ", matching your filters" : ""}, grouped into separate applicant bands.
          </p>

          {/* mutually exclusive applicant bands — pick one */}
          <div className="mt-3 grid grid-cols-3 gap-2" role="group" aria-label="Applicant band">
            {OPP_BANDS.map((b) => {
              const on = band === b.key;
              return (
                <button
                  key={b.key}
                  onClick={() => setBand(b.key)}
                  title={b.blurb}
                  aria-pressed={on}
                  className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                    on ? "border-brand bg-brand-soft" : "border-line hover:border-brand/50"
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <span className={`h-2 w-2 rounded-full ${BAND_DOT[b.key]}`} />
                    <span className="text-xs font-semibold text-ink">{b.range}</span>
                  </span>
                  <span className="mt-0.5 block text-[11px] text-muted">
                    <span className="font-medium tabular-nums text-ink">{counts[b.key]}</span> jobs · {b.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {shown.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted">
            No jobs with {def.range} applicants{filtered ? " under these filters" : ""}. Try another band.
          </p>
        ) : (
          <ul className="max-h-[560px] divide-y divide-line overflow-y-auto">
            {shown.map((j) => (
              <li key={j.id} className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-brand-soft/40">
                <div className="min-w-0 flex-1">
                  <a
                    href={linkedinUrl(j.linkedin_job_id)}
                    target="_blank"
                    rel="noreferrer"
                    className="line-clamp-1 font-medium text-ink hover:text-brand hover:underline"
                  >
                    {j.title}
                  </a>
                  <div className="mt-0.5 truncate text-xs text-sub">
                    {j.company}
                    {j.location ? ` · ${j.location}` : ""}
                    {j.posted_at ? ` · posted ${shortDate(j.posted_at)}` : ""}
                  </div>
                  <div className="mt-1.5">
                    <StackTags stacks={j.stacks} />
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <ApplicantBadge n={j.applicant_count!} />
                  <a
                    href={linkedinUrl(j.linkedin_job_id)}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1.5 block text-xs font-medium text-brand hover:underline"
                  >
                    View on LinkedIn ↗
                  </a>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-xl border border-line bg-card">
        <div className="border-b border-line px-5 py-4">
          <h3 className="text-sm font-semibold text-ink">Filling fastest</h3>
          <p className="mt-0.5 text-xs text-muted">Applicants gained per hour between scrapes. Skip these, or apply now.</p>
        </div>
        {fastest.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted">Needs a job to be seen in two scrapes. Check back after the next run.</p>
        ) : (
          <ol className="divide-y divide-line">
            {fastest.slice(0, 10).map((j: FastJob, i) => (
              <li key={j.id} className="flex items-start gap-3 px-5 py-3">
                <span className="mt-0.5 w-4 text-xs font-semibold tabular-nums text-muted">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <a
                    href={linkedinUrl(j.linkedin_job_id)}
                    target="_blank"
                    rel="noreferrer"
                    className="line-clamp-1 text-sm font-medium text-ink hover:text-brand hover:underline"
                  >
                    {j.title}
                  </a>
                  <div className="truncate text-xs text-sub">{j.company}</div>
                  <div className="mt-1 text-[11px] tabular-nums text-muted">
                    {j.first_count != null ? applicantLabel(j.first_count) : "?"} → {j.latest_count ?? "?"} applicants
                    {j.hours_tracked ? ` in ${Math.round(j.hours_tracked)}h` : ""}
                  </div>
                </div>
                <span className="shrink-0 rounded-full bg-warn/10 px-2 py-0.5 text-xs font-semibold tabular-nums text-warn">
                  +{j.applicants_per_hour.toFixed(1)}/h
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

// Applicant count coloured by its competition band (consistent app-wide).
function ApplicantBadge({ n }: { n: number }) {
  const band = bandOf(n);
  return (
    <span className={`inline-flex items-baseline gap-1 rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums ${BAND_BADGE[band]}`}>
      {applicantLabel(n)}
      <span className="font-normal opacity-80">applicants</span>
    </span>
  );
}

// Small word-chip naming the competition band (Fresh / Low / Busy / Crowded).
function BandChip({ n }: { n: number }) {
  const band = bandOf(n);
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${BAND_BADGE[band]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${BAND_DOT[band]}`} />
      {bandDef(band).name}
    </span>
  );
}

/* ------------------------------ tables ----------------------------- */

// A visible read-out of the active filters + how many jobs match, so changing a
// filter has an obvious effect on the data below.
function JobsResultBar({ count, filters }: { count: number; filters: Filters }) {
  const chips: string[] = [];
  filters.stacks.forEach((s) => chips.push(STACK_SHORT[s]));
  if (filters.dateRange) chips.push(DATE_RANGE_LABEL[filters.dateRange]);
  if (filters.jobType) chips.push(filters.jobType === "contract" ? "Contract" : "Full-time");
  if (filters.easyApply) chips.push(filters.easyApply === "true" ? "Easy Apply" : "External");
  if (filters.location) chips.push(`“${filters.location}”`);
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="tabular-nums font-semibold text-ink">{count.toLocaleString()}</span>
      <span className="text-muted">
        job{count === 1 ? "" : "s"}
        {chips.length ? " matching" : " · no filters applied"}
      </span>
      {chips.map((c, i) => (
        <span key={i} className="rounded-full border border-line bg-plane px-2 py-0.5 text-[11px] font-medium text-sub">
          {c}
        </span>
      ))}
    </div>
  );
}

const jobTypeLabel = (t: Job["job_type"]) => (t === "full_time" ? "Full-time" : t === "contract" ? "Contract" : "—");

// A metadata line (label/value pairs) used on the mobile job cards.
function CardMeta({ children }: { children: React.ReactNode }) {
  return <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted">{children}</div>;
}

function CompetitionTable({ jobs, filters }: { jobs: Job[]; filters: Filters }) {
  // Show in posted-date order (newest first) so the Posted column reads in order.
  const sorted = useMemo(() => [...jobs].sort((a, b) => postedKey(b).localeCompare(postedKey(a))), [jobs]);
  const cards = usePaged(sorted);
  return (
    <div>
      <div className="mb-3 space-y-2">
        <JobsResultBar count={sorted.length} filters={filters} />
        <BandLegend />
      </div>
      {sorted.length === 0 ? (
        <Empty />
      ) : (
        <>
          {/* phone: cards */}
          <ul className="space-y-2 sm:hidden">
            {cards.pageRows.map((j) => (
              <li key={j.id} className="rounded-xl border border-line bg-card p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <p className="line-clamp-2 text-sm font-medium text-ink">{j.title}</p>
                  {j.applicant_count != null && <BandChip n={j.applicant_count} />}
                </div>
                <p className="mt-0.5 truncate text-xs text-sub">
                  {j.company}
                  {j.location ? ` · ${j.location}` : ""}
                </p>
                <div className="mt-2">
                  <StackTags stacks={j.stacks} />
                </div>
                <CardMeta>
                  <span>
                    <span className="tabular-nums font-medium text-ink">
                      {j.applicant_count != null ? applicantLabel(j.applicant_count) : "—"}
                    </span>{" "}
                    applicants
                  </span>
                  {j.applicants_per_hour != null && (
                    <span className="tabular-nums">{j.applicants_per_hour.toFixed(1)}/hr</span>
                  )}
                  <span className="ml-auto">{shortDate(postedKey(j))}</span>
                </CardMeta>
              </li>
            ))}
          </ul>
          <div className="sm:hidden">
            <Pager {...cards} />
          </div>
          {/* tablet+ : sortable table (click a header to reorder) */}
          <div className="hidden sm:block">
            <DataTable<Job>
              rows={jobs}
              initial={{ key: "posted", dir: "desc" }}
              columns={[
                { key: "title", label: "Title", cellClass: "font-medium text-ink", sort: { type: "text", value: (j) => j.title.toLowerCase() }, render: (j) => j.title },
                { key: "company", label: "Company", sort: { type: "text", value: (j) => j.company.toLowerCase() }, render: (j) => j.company },
                { key: "stack", label: "Stack", render: (j) => <StackTags stacks={j.stacks} /> },
                { key: "location", label: "Location", sort: { type: "text", value: (j) => (j.location ?? "").toLowerCase() }, render: (j) => j.location },
                { key: "applicants", label: "Applicants", cellClass: "tabular-nums font-medium text-ink", sort: { type: "number", value: (j) => j.applicant_count }, render: (j) => (j.applicant_count != null ? applicantLabel(j.applicant_count) : "—") },
                { key: "competition", label: "Competition", render: (j) => (j.applicant_count != null ? <BandChip n={j.applicant_count} /> : <span className="text-muted">—</span>) },
                { key: "perhr", label: "Applicants/hr", cellClass: "tabular-nums", sort: { type: "number", value: (j) => j.applicants_per_hour ?? null }, render: (j) => (j.applicants_per_hour != null ? j.applicants_per_hour.toFixed(1) : "—") },
                { key: "posted", label: "Posted", cellClass: "tabular-nums", sort: { type: "text", value: (j) => postedKey(j) }, render: (j) => shortDate(postedKey(j)) },
              ]}
            />
          </div>
        </>
      )}
    </div>
  );
}

const applyLabel = (e: boolean | null) => (e === true ? "Easy Apply" : e === false ? "External" : "—");

function RawFeedTable({ jobs, filters }: { jobs: Job[]; filters: Filters }) {
  const cards = usePaged(jobs);
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <JobsResultBar count={jobs.length} filters={filters} />
        <a href="/api/export" className="shrink-0 text-xs font-medium text-brand hover:underline">
          Export CSV ↓
        </a>
      </div>
      {jobs.length === 0 ? (
        <Empty />
      ) : (
        <>
          {/* phone: cards */}
          <ul className="space-y-2 sm:hidden">
            {cards.pageRows.map((j) => (
              <li key={j.id} className="rounded-xl border border-line bg-card p-3.5">
                <p className="line-clamp-2 text-sm font-medium text-ink">{j.title}</p>
                <p className="mt-0.5 truncate text-xs text-sub">
                  {j.company}
                  {j.location ? ` · ${j.location}` : ""}
                </p>
                <div className="mt-2">
                  <StackTags stacks={j.stacks} />
                </div>
                <CardMeta>
                  <span>{jobTypeLabel(j.job_type)}</span>
                  <span>· {applyLabel(j.easy_apply)}</span>
                  <span>
                    · <span className="tabular-nums font-medium text-ink">{j.applicant_count != null ? applicantLabel(j.applicant_count) : "—"}</span> appl.
                  </span>
                  <span className="ml-auto">{shortDate(j.scraped_at)}</span>
                </CardMeta>
              </li>
            ))}
          </ul>
          <div className="sm:hidden">
            <Pager {...cards} />
          </div>
          {/* tablet+ : sortable table (click a header to reorder) */}
          <div className="hidden sm:block">
            <DataTable<Job>
              rows={jobs}
              initial={{ key: "scraped", dir: "desc" }}
              columns={[
                { key: "title", label: "Title", cellClass: "font-medium text-ink", sort: { type: "text", value: (j) => j.title.toLowerCase() }, render: (j) => j.title },
                { key: "company", label: "Company", sort: { type: "text", value: (j) => j.company.toLowerCase() }, render: (j) => j.company },
                { key: "stacks", label: "Stack(s)", render: (j) => <StackTags stacks={j.stacks} /> },
                { key: "location", label: "Location", sort: { type: "text", value: (j) => (j.location ?? "").toLowerCase() }, render: (j) => j.location },
                { key: "type", label: "Type", sort: { type: "text", value: (j) => jobTypeLabel(j.job_type) }, render: (j) => jobTypeLabel(j.job_type) },
                { key: "apply", label: "Apply", sort: { type: "text", value: (j) => applyLabel(j.easy_apply) }, render: (j) => applyLabel(j.easy_apply) },
                { key: "applicants", label: "Applicants", cellClass: "tabular-nums", sort: { type: "number", value: (j) => j.applicant_count }, render: (j) => (j.applicant_count != null ? applicantLabel(j.applicant_count) : "—") },
                { key: "scraped", label: "Scraped", cellClass: "tabular-nums", sort: { type: "text", value: (j) => j.scraped_at.slice(0, 10) }, render: (j) => shortDate(j.scraped_at) },
              ]}
            />
          </div>
        </>
      )}
    </div>
  );
}

function CompanyMapTable({ rows }: { rows: CompanyStackRow[] }) {
  const [company, setCompany] = useState<string | null>(null);
  if (!rows.length) return <Empty />;
  return (
    <>
      <p className="mb-3 text-xs text-muted">Select a company for its full hiring breakdown.</p>
      {/* phone: one card per company with its stack counts */}
      <ul className="space-y-2 sm:hidden">
        {rows.map((r) => (
          <li key={r.company} className="rounded-xl border border-line bg-card p-3.5">
            <div className="flex items-center justify-between gap-3">
              <button
                onClick={() => setCompany(r.company)}
                className="truncate text-left text-sm font-medium text-ink hover:text-brand hover:underline"
              >
                {r.company}
              </button>
              <span className="shrink-0 rounded-full bg-brand-soft px-2 py-0.5 text-xs font-semibold tabular-nums text-brand">
                {r.total} total
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {STACKS.filter((s) => r.counts[s]).map((s) => (
                <span key={s} className="inline-flex items-center gap-1 rounded-full border border-line px-1.5 py-0.5 text-[11px] text-sub">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: `var(${STACK_COLOR_VAR[s]})` }} />
                  {STACK_SHORT[s]} <span className="font-semibold tabular-nums text-ink">{r.counts[s]}</span>
                </span>
              ))}
            </div>
          </li>
        ))}
      </ul>
      {/* tablet+ : the full matrix */}
      <div className="hidden sm:block">
        <Table head={["Company", ...STACKS.map((s) => STACK_SHORT[s]), "Total"]}>
          {rows.map((r) => (
            <Row key={r.company}>
              <Td className="font-medium text-ink">
                <button onClick={() => setCompany(r.company)} className="text-left hover:text-brand hover:underline">
                  {r.company}
                </button>
              </Td>
              {STACKS.map((s) => (
                <Td key={s} className="text-center tabular-nums">
                  {r.counts[s] ? (
                    <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-md bg-brand-soft px-1.5 text-xs font-medium text-brand">
                      {r.counts[s]}
                    </span>
                  ) : (
                    <span className="text-muted">·</span>
                  )}
                </Td>
              ))}
              <Td className="text-center tabular-nums font-semibold text-ink">{r.total}</Td>
            </Row>
          ))}
        </Table>
      </div>
      <CompanyDetail company={company} onClose={() => setCompany(null)} />
    </>
  );
}

function StackTags({ stacks }: { stacks: Stack[] }) {
  return (
    <span className="flex flex-wrap gap-1">
      {stacks.map((s) => (
        <span
          key={s}
          className="inline-flex items-center gap-1 rounded-full border border-line px-1.5 py-0.5 text-[11px] text-sub"
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: `var(${STACK_COLOR_VAR[s]})` }} />
          {s}
        </span>
      ))}
    </span>
  );
}

// Competition-band legend (Fresh / Low / Busy / Crowded) — a small on-screen key
// for the applicant-count colours, so the bands are self-explanatory.
function BandLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-lg border border-line bg-plane/40 px-3 py-2 text-[11px] text-muted">
      <span className="font-semibold uppercase tracking-wide">Competition</span>
      {BANDS.map((b) => (
        <span key={b.key} className="inline-flex items-center gap-1.5" title={b.blurb}>
          <span className={`h-2 w-2 rounded-full ${BAND_DOT[b.key]}`} />
          <span className="font-medium text-ink">{b.name}</span>
          <span className="tabular-nums">{b.range}</span>
        </span>
      ))}
    </div>
  );
}

/* --------------------------- sortable table ------------------------- */

type SortDir = "asc" | "desc";

interface Column<T> {
  key: string;
  label: string;
  align?: "left" | "right" | "center";
  cellClass?: string;
  render: (row: T) => React.ReactNode;
  // Present => the column is sortable; `value` returns the comparable key.
  sort?: { type: "text" | "number"; value: (row: T) => string | number | null };
}

const alignClass = (a?: "left" | "right" | "center") =>
  a === "right" ? "text-right" : a === "center" ? "text-center" : "text-left";

// A table whose sortable columns can be reordered by clicking their header.
// Sorting is client-side; nulls always sort last regardless of direction.
function DataTable<T extends { id: string }>({
  columns,
  rows,
  initial,
}: {
  columns: Column<T>[];
  rows: T[];
  initial: { key: string; dir: SortDir };
}) {
  const [sort, setSort] = useState(initial);

  const sorted = useMemo(() => {
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sort) return rows;
    const { value, type } = col.sort;
    return [...rows].sort((a, b) => {
      const av = value(a);
      const bv = value(b);
      if (av == null && bv == null) return 0;
      if (av == null) return 1; // nulls last
      if (bv == null) return -1;
      const base = type === "number" ? (av as number) - (bv as number) : String(av).localeCompare(String(bv));
      return sort.dir === "asc" ? base : -base;
    });
  }, [rows, columns, sort]);

  const paged = usePaged(sorted);
  const { setPage } = paged;

  const toggle = (key: string) => {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
    setPage(0); // a new sort order starts again from the first page
  };

  return (
    <>
    <div className="overflow-x-auto rounded-xl border border-line bg-card">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-line text-xs uppercase tracking-wide text-muted">
          <tr>
            {columns.map((c) => {
              const on = sort.key === c.key && !!c.sort;
              return (
                <th key={c.key} className={`px-3 py-2.5 font-medium ${alignClass(c.align)}`}>
                  {c.sort ? (
                    <button
                      type="button"
                      onClick={() => toggle(c.key)}
                      aria-label={`Sort by ${c.label}`}
                      className={`inline-flex items-center gap-1 uppercase transition-colors hover:text-ink ${
                        on ? "text-ink" : ""
                      } ${c.align === "right" ? "flex-row-reverse" : ""}`}
                    >
                      {c.label}
                      <span className={`text-[9px] leading-none ${on ? "opacity-100" : "opacity-30"}`}>
                        {on ? (sort.dir === "asc" ? "▲" : "▼") : "▲"}
                      </span>
                    </button>
                  ) : (
                    c.label
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {paged.pageRows.map((row) => (
            <Row key={row.id}>
              {columns.map((c) => (
                <Td key={c.key} className={`${alignClass(c.align)} ${c.cellClass ?? ""}`}>
                  {c.render(row)}
                </Td>
              ))}
            </Row>
          ))}
        </tbody>
      </table>
    </div>
    <Pager {...paged} />
    </>
  );
}

// Splits rows into pages of PAGE_SIZE. The page is clamped, so a list that
// gets shorter never leaves the view stranded on an empty page.
function usePaged<T>(rows: T[]) {
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, pageCount - 1);
  const pageRows = useMemo(
    () => rows.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE),
    [rows, current],
  );
  return { pageRows, page: current, pageCount, total: rows.length, setPage };
}

// "Showing 1–50 of 2,405" + Previous / Next. Hidden when everything fits on one page.
function Pager({
  page,
  pageCount,
  total,
  setPage,
}: {
  page: number;
  pageCount: number;
  total: number;
  setPage: (p: number) => void;
}) {
  if (total <= PAGE_SIZE) return null;
  const first = page * PAGE_SIZE + 1;
  const last = Math.min(total, (page + 1) * PAGE_SIZE);
  const btn =
    "rounded-md border border-line px-2.5 py-1 font-medium text-sub transition-colors hover:text-ink disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-sub";
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-1 pt-3 text-xs text-muted">
      <span className="tabular-nums">
        Showing {first.toLocaleString()}–{last.toLocaleString()} of {total.toLocaleString()}
      </span>
      <div className="flex items-center gap-2">
        <button type="button" className={btn} disabled={page === 0} onClick={() => setPage(page - 1)}>
          Previous
        </button>
        <span className="tabular-nums">
          Page {page + 1} of {pageCount.toLocaleString()}
        </span>
        <button type="button" className={btn} disabled={page >= pageCount - 1} onClick={() => setPage(page + 1)}>
          Next
        </button>
      </div>
    </div>
  );
}

function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-card">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-line text-xs uppercase tracking-wide text-muted">
          <tr>
            {head.map((h) => (
              <th key={h} className="px-3 py-2.5 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <tr className="border-t border-line text-sub first:border-t-0 hover:bg-brand-soft/40">{children}</tr>;
}

function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2.5 ${className}`}>{children}</td>;
}

function Empty() {
  return (
    <div className="rounded-xl border border-dashed border-line bg-card p-8 text-center text-sm text-muted">
      No jobs match these filters yet.
    </div>
  );
}
