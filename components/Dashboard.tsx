"use client";

import { useCallback, useEffect, useState } from "react";
import {
  STACKS,
  STACK_COLOR_VAR,
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
import { TrendChart } from "./TrendChart";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";

const TABS = ["Trend", "Opportunities", "Competition", "Company Map", "Raw Feed"] as const;
type Tab = (typeof TABS)[number];

interface Filters {
  stacks: Stack[];
  jobType: "" | "contract" | "full_time";
  location: string;
  easyApply: "" | "true" | "false";
}

const EMPTY_FILTERS: Filters = { stacks: [], jobType: "", location: "", easyApply: "" };

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
  const [loading, setLoading] = useState(false);

  const jobsQuery = useCallback(
    (sort: "recent" | "applicants") => {
      const p = new URLSearchParams();
      filters.stacks.forEach((s) => p.append("stack", s));
      if (filters.jobType) p.set("jobType", filters.jobType);
      if (filters.location) p.set("location", filters.location);
      if (filters.easyApply) p.set("easyApply", filters.easyApply);
      p.set("sort", sort);
      return `/api/jobs?${p.toString()}`;
    },
    [filters],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const sort = tab === "Competition" ? "applicants" : "recent";
      const [statusRes, summaryRes, trendRes, jobsRes, mapRes, oppsRes] = await Promise.all([
        fetchJson<ScrapeRun | null>("/api/status"),
        fetchJson<SummaryData | null>("/api/summary"),
        fetchJson<TrendPoint[]>("/api/trend"),
        fetchJson<Job[]>(jobsQuery(sort)),
        fetchJson<CompanyStackRow[]>("/api/company-map"),
        fetchJson<OpportunitiesData>("/api/opportunities"),
      ]);
      if (cancelled) return;
      setConfigured(statusRes.configured);
      setStatus(statusRes.data ?? null);
      setSummary(summaryRes.data ?? null);
      setTrend(trendRes.data ?? []);
      setJobs(jobsRes.data ?? []);
      setCompanyMap(mapRes.data ?? []);
      setOpps(oppsRes.data ?? null);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [tab, jobsQuery]);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-line bg-card">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <Logo className="h-8 w-8 text-brand" />
            <div className="leading-tight">
              <div className="text-[15px] font-semibold tracking-tight text-ink">
                Mavericks <span className="text-brand">Market Intelligence</span>
              </div>
              <div className="hidden text-xs text-muted sm:block">
                LinkedIn demand &amp; competition · SAP · Salesforce · MERN · .NET · Java
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

      <main className="mx-auto max-w-6xl space-y-8 px-4 py-8">
        {configured === false && <NotConfigured />}

        <SummarySection summary={summary} loading={loading && !summary} />

        <div>
          <FilterBar filters={filters} setFilters={setFilters} />

          <nav className="mt-6 flex gap-1 border-b border-line">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
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
            {loading && <p className="text-sm text-muted">Loading…</p>}
            {!loading && tab === "Trend" && (
              <Card>
                <SectionTitle
                  title="Demand trend"
                  hint="Open roles per stack (LinkedIn result totals, not capped by the scrape limit)."
                />
                <TrendChart points={trend} />
              </Card>
            )}
            {!loading && tab === "Opportunities" && <OpportunitiesView data={opps} filters={filters} />}
            {!loading && tab === "Competition" && <CompetitionTable jobs={jobs} />}
            {!loading && tab === "Company Map" && <CompanyMapTable rows={companyMap} />}
            {!loading && tab === "Raw Feed" && <RawFeedTable jobs={jobs} />}
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

/* ----------------------------- summary ----------------------------- */

function SummarySection({ summary, loading }: { summary: SummaryData | null; loading: boolean }) {
  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Market at a glance</h2>
        {summary && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-sub">
            <span>
              <span className="tabular-nums font-medium text-ink">
                {summary.totals.open_roles.toLocaleString()}
              </span>{" "}
              open roles
            </span>
            <span>
              <span className="tabular-nums font-medium text-ink">{summary.totals.captured}</span> tracked
            </span>
            <span>
              <span className="tabular-nums font-medium text-ink">
                {summary.totals.total_applicants.toLocaleString()}
              </span>{" "}
              total applicants
            </span>
            <span>
              <span className="tabular-nums font-medium text-ink">
                {summary.totals.avg_applicants ?? "—"}
              </span>{" "}
              avg applicants
            </span>
          </div>
        )}
      </div>
      {summary && <MoversStrip stacks={summary.stacks} />}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {loading || !summary
          ? STACKS.map((s) => <TileSkeleton key={s} />)
          : summary.stacks.map((s) => <StackTile key={s.stack} s={s} />)}
      </div>
    </section>
  );
}

const shortDate = (iso: string) =>
  new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

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

function StackTile({ s }: { s: StackSummary }) {
  return (
    <div className="rounded-xl border border-line bg-card p-4 transition-colors hover:border-brand/60">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-2 text-sm font-medium text-ink">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: `var(${STACK_COLOR_VAR[s.stack]})` }} />
          {s.stack}
        </span>
        {s.max_applicants != null && (
          <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-medium text-brand">
            max {s.max_applicants}
          </span>
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
      <div className="mt-3 flex items-center justify-between border-t border-line pt-2 text-xs text-sub">
        <span>
          <span className="tabular-nums text-ink">{s.captured}</span> tracked
        </span>
        <span>
          <span className="tabular-nums text-ink">{s.avg_applicants ?? "—"}</span> avg applicants
        </span>
      </div>
    </div>
  );
}

function TileSkeleton() {
  return <div className="h-[132px] animate-pulse rounded-xl border border-line bg-card" />;
}

/* ----------------------------- chrome ------------------------------ */

const ghostButton =
  "inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-card px-3 text-xs text-sub transition-colors hover:border-brand hover:text-ink";

function AccountControls({ user }: { user: SessionUser | null }) {
  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <a href="/login" className={ghostButton}>
          Sign in
        </a>
        <a
          href="/signup"
          className="inline-flex h-9 items-center rounded-lg bg-brand px-3 text-xs font-medium text-brand-ink transition-opacity hover:opacity-90"
        >
          Create account
        </a>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="hidden max-w-36 truncate text-xs text-sub lg:inline" title={user.name}>
        Hi, <span className="font-medium text-ink">{user.name.split(" ")[0]}</span>
      </span>
      {user.role === "admin" && (
        <a href="/admin" title="Admin" className={ghostButton}>
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="11" width="16" height="10" rx="2" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
          </svg>
          <span className="hidden sm:inline">Admin</span>
        </a>
      )}
      <form action="/api/auth/logout" method="post">
        <button type="submit" className={ghostButton}>
          Sign out
        </button>
      </form>
    </div>
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
      {new Date(status.ran_at).toLocaleDateString()}
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

  const selectClass =
    "rounded-lg border border-line bg-card px-2.5 py-1.5 text-xs text-ink outline-none focus:border-brand";

  return (
    <div className="flex flex-wrap items-center gap-2.5 rounded-xl border border-line bg-card p-3">
      <div className="flex flex-wrap gap-1.5">
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
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: on ? "currentColor" : `var(${STACK_COLOR_VAR[s]})` }}
              />
              {s}
            </button>
          );
        })}
      </div>
      <div className="ml-auto flex flex-wrap items-center gap-2.5">
        <select
          value={filters.jobType}
          onChange={(e) => setFilters({ ...filters, jobType: e.target.value as Filters["jobType"] })}
          className={selectClass}
        >
          <option value="">Any type</option>
          <option value="contract">Contract</option>
          <option value="full_time">Full-time</option>
        </select>
        <input
          placeholder="Location…"
          value={filters.location}
          onChange={(e) => setFilters({ ...filters, location: e.target.value })}
          className={`${selectClass} w-28 placeholder:text-muted`}
        />
        <select
          value={filters.easyApply}
          onChange={(e) => setFilters({ ...filters, easyApply: e.target.value as Filters["easyApply"] })}
          className={selectClass}
        >
          <option value="">Easy Apply: any</option>
          <option value="true">Easy Apply only</option>
          <option value="false">Non Easy-Apply</option>
        </select>
        {(filters.stacks.length || filters.jobType || filters.location || filters.easyApply) && (
          <button
            onClick={() => setFilters(EMPTY_FILTERS)}
            className="text-xs text-muted underline-offset-2 hover:text-ink hover:underline"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}

/* --------------------------- opportunities -------------------------- */

const THRESHOLDS = [10, 25, 50, 100] as const;
const linkedinUrl = (id: string) => `https://www.linkedin.com/jobs/view/${id}`;

// LinkedIn shows "Be among the first 25 applicants" for anything under 25, which
// the scraper stores as 25 — so 25 really means "fewer than 25".
const applicantsLabel = (n: number) => (n === 25 ? "<25" : n.toLocaleString());

function matchesFilters(j: { stacks: Stack[]; location: string | null }, f: Filters) {
  if (f.stacks.length && !j.stacks.some((s) => f.stacks.includes(s))) return false;
  if (f.location && !(j.location ?? "").toLowerCase().includes(f.location.toLowerCase())) return false;
  return true;
}

function OpportunitiesView({ data, filters }: { data: OpportunitiesData | null; filters: Filters }) {
  const [max, setMax] = useState<(typeof THRESHOLDS)[number]>(25);
  if (!data || !data.as_of) return <Empty />;

  const low = data.low.filter((j) => (j.applicant_count ?? Infinity) <= max && matchesFilters(j, filters));
  const fastest = data.fastest.filter((j) => matchesFilters(j, filters));
  const asOf = new Date(data.as_of).toLocaleString("en-GB", {
    timeZone: "Asia/Karachi",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="rounded-xl border border-line bg-card lg:col-span-2">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <h3 className="text-sm font-semibold text-ink">Low-competition jobs</h3>
            <p className="mt-0.5 text-xs text-muted">
              <span className="font-medium text-ink">{low.length}</span> of {data.scanned} jobs from the latest scrape
              ({asOf} PKT) have {max === 25 ? "fewer than 25" : `${max} or fewer`} applicants. Apply early.
            </p>
          </div>
          <div className="flex rounded-lg border border-line p-0.5" role="group" aria-label="Maximum applicants">
            {THRESHOLDS.map((t) => (
              <button
                key={t}
                onClick={() => setMax(t)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium tabular-nums transition-colors ${
                  max === t ? "bg-brand text-brand-ink" : "text-sub hover:text-ink"
                }`}
              >
                ≤{t}
              </button>
            ))}
          </div>
        </div>

        {low.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted">No jobs under this limit. Try a higher one.</p>
        ) : (
          <ul className="max-h-[560px] divide-y divide-line overflow-y-auto">
            {low.map((j) => (
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
                    {j.first_count != null ? applicantsLabel(j.first_count) : "?"} → {j.latest_count ?? "?"} applicants
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

function ApplicantBadge({ n }: { n: number }) {
  const tone = n <= 25 ? "bg-good/10 text-good" : n <= 50 ? "bg-brand-soft text-brand" : "bg-warn/10 text-warn";
  return (
    <span className={`inline-flex items-baseline gap-1 rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums ${tone}`}>
      {applicantsLabel(n)}
      <span className="font-normal opacity-80">applicants</span>
    </span>
  );
}

/* ------------------------------ tables ----------------------------- */

function CompetitionTable({ jobs }: { jobs: Job[] }) {
  if (!jobs.length) return <Empty />;
  return (
    <Table head={["Title", "Company", "Stack", "Location", "Applicants", "Applicants/hr", "Posted"]}>
      {jobs.map((j) => (
        <Row key={j.id}>
          <Td className="font-medium text-ink">{j.title}</Td>
          <Td>{j.company}</Td>
          <Td>
            <StackTags stacks={j.stacks} />
          </Td>
          <Td>{j.location}</Td>
          <Td className="tabular-nums font-medium text-ink">{j.applicant_count ?? "—"}</Td>
          <Td className="tabular-nums">{j.applicants_per_hour != null ? j.applicants_per_hour.toFixed(1) : "—"}</Td>
          <Td className="tabular-nums">{j.posted_at ?? new Date(j.scraped_at).toLocaleDateString()}</Td>
        </Row>
      ))}
    </Table>
  );
}

function RawFeedTable({ jobs }: { jobs: Job[] }) {
  if (!jobs.length) return <Empty />;
  return (
    <div>
      <div className="mb-2 flex justify-end">
        <a href="/api/export" className="text-xs font-medium text-brand hover:underline">
          Export CSV ↓
        </a>
      </div>
      <Table head={["Title", "Company", "Stack(s)", "Location", "Type", "Easy Apply", "Applicants", "Scraped"]}>
        {jobs.map((j) => (
          <Row key={j.id}>
            <Td className="font-medium text-ink">{j.title}</Td>
            <Td>{j.company}</Td>
            <Td>
              <StackTags stacks={j.stacks} />
            </Td>
            <Td>{j.location}</Td>
            <Td>{j.job_type ?? "—"}</Td>
            <Td>{j.easy_apply ? "Yes" : "No"}</Td>
            <Td className="tabular-nums">{j.applicant_count ?? "—"}</Td>
            <Td className="tabular-nums">{new Date(j.scraped_at).toLocaleDateString()}</Td>
          </Row>
        ))}
      </Table>
    </div>
  );
}

function CompanyMapTable({ rows }: { rows: CompanyStackRow[] }) {
  if (!rows.length) return <Empty />;
  return (
    <Table head={["Company", ...STACKS, "Total"]}>
      {rows.map((r) => (
        <Row key={r.company}>
          <Td className="font-medium text-ink">{r.company}</Td>
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
