"use client";

import { useCallback, useEffect, useState } from "react";
import {
  STACKS,
  STACK_COLOR_VAR,
  type ApiResult,
  type CompanyStackRow,
  type Job,
  type ScrapeRun,
  type Stack,
  type StackSummary,
  type SummaryData,
  type TrendPoint,
} from "@/lib/types";
import { TrendChart } from "./TrendChart";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";

const TABS = ["Trend", "Competition", "Company Map", "Raw Feed"] as const;
type Tab = (typeof TABS)[number];

interface Filters {
  stacks: Stack[];
  jobType: "" | "contract" | "full_time";
  location: string;
  easyApply: "" | "true" | "false";
}

const EMPTY_FILTERS: Filters = { stacks: [], jobType: "", location: "", easyApply: "" };

export function Dashboard() {
  const [tab, setTab] = useState<Tab>("Trend");
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);

  const [configured, setConfigured] = useState<boolean | null>(null);
  const [status, setStatus] = useState<ScrapeRun | null>(null);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [companyMap, setCompanyMap] = useState<CompanyStackRow[]>([]);
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
      const [statusRes, summaryRes, trendRes, jobsRes, mapRes] = await Promise.all([
        fetchJson<ScrapeRun | null>("/api/status"),
        fetchJson<SummaryData | null>("/api/summary"),
        fetchJson<TrendPoint[]>("/api/trend"),
        fetchJson<Job[]>(jobsQuery(sort)),
        fetchJson<CompanyStackRow[]>("/api/company-map"),
      ]);
      if (cancelled) return;
      setConfigured(statusRes.configured);
      setStatus(statusRes.data ?? null);
      setSummary(summaryRes.data ?? null);
      setTrend(trendRes.data ?? []);
      setJobs(jobsRes.data ?? []);
      setCompanyMap(mapRes.data ?? []);
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
            <StatusBadge configured={configured} status={status} />
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
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {loading || !summary
          ? STACKS.map((s) => <TileSkeleton key={s} />)
          : summary.stacks.map((s) => <StackTile key={s.stack} s={s} />)}
      </div>
    </section>
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
      <div className="mt-3 text-2xl font-semibold tabular-nums text-ink">
        {s.open_roles != null ? s.open_roles.toLocaleString() : "—"}
      </div>
      <div className="text-xs text-muted">open roles on LinkedIn</div>
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
