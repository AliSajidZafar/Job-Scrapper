"use client";

import { useCallback, useEffect, useState } from "react";
import {
  STACKS,
  type ApiResult,
  type CompanyStackRow,
  type Job,
  type ScrapeRun,
  type Stack,
  type TrendPoint,
} from "@/lib/types";
import { TrendChart } from "./TrendChart";

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
      const [statusRes, trendRes, jobsRes, mapRes] = await Promise.all([
        fetchJson<ScrapeRun | null>("/api/status"),
        fetchJson<TrendPoint[]>("/api/trend"),
        fetchJson<Job[]>(jobsQuery(sort)),
        fetchJson<CompanyStackRow[]>("/api/company-map"),
      ]);
      if (cancelled) return;
      setConfigured(statusRes.configured);
      setStatus(statusRes.data ?? null);
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
    <div className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Job Market Intelligence</h1>
          <p className="text-sm text-zinc-500">
            SAP · Salesforce · MERN · .NET · Java — US demand &amp; competition
          </p>
        </div>
        <StatusBadge configured={configured} status={status} />
      </header>

      {configured === false && <NotConfigured />}

      <FilterBar filters={filters} setFilters={setFilters} />

      <nav className="mt-6 flex gap-1 border-b border-zinc-200 dark:border-zinc-800">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              tab === t
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
            }`}
          >
            {t}
          </button>
        ))}
      </nav>

      <section className="mt-6">
        {loading && <p className="text-sm text-zinc-400">Loading…</p>}
        {!loading && tab === "Trend" && (
          <div>
            <p className="mb-3 text-xs text-zinc-500">
              Open roles per stack (LinkedIn result totals, not capped by the scrape limit).
            </p>
            <TrendChart points={trend} />
          </div>
        )}
        {!loading && tab === "Competition" && <CompetitionTable jobs={jobs} />}
        {!loading && tab === "Company Map" && <CompanyMapTable rows={companyMap} />}
        {!loading && tab === "Raw Feed" && <RawFeedTable jobs={jobs} />}
      </section>
    </div>
  );
}

async function fetchJson<T>(url: string): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url);
    return (await res.json()) as ApiResult<T>;
  } catch {
    return { configured: false, data: [] as unknown as T };
  }
}

function StatusBadge({
  configured,
  status,
}: {
  configured: boolean | null;
  status: ScrapeRun | null;
}) {
  if (configured === false) {
    return <span className="rounded-full bg-amber-100 px-3 py-1 text-xs text-amber-800">Not connected</span>;
  }
  if (!status) {
    return <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">No runs yet</span>;
  }
  const color =
    status.status === "success"
      ? "bg-green-100 text-green-800"
      : status.status === "partial"
        ? "bg-amber-100 text-amber-800"
        : "bg-red-100 text-red-800";
  return (
    <span className={`rounded-full px-3 py-1 text-xs ${color}`}>
      Last run {status.status} · {status.jobs_found} jobs · {new Date(status.ran_at).toLocaleDateString()}
    </span>
  );
}

function NotConfigured() {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
      Supabase isn&apos;t configured yet. Copy <code>.env.example</code> to <code>.env.local</code>, fill in your
      Supabase URL and keys, run <code>supabase/schema.sql</code>, then scrape with <code>npm run scrape</code>.
    </div>
  );
}

function FilterBar({
  filters,
  setFilters,
}: {
  filters: Filters;
  setFilters: (f: Filters) => void;
}) {
  const toggleStack = (s: Stack) =>
    setFilters({
      ...filters,
      stacks: filters.stacks.includes(s)
        ? filters.stacks.filter((x) => x !== s)
        : [...filters.stacks, s],
    });

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-wrap gap-1.5">
        {STACKS.map((s) => (
          <button
            key={s}
            onClick={() => toggleStack(s)}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${
              filters.stacks.includes(s)
                ? "border-blue-600 bg-blue-600 text-white"
                : "border-zinc-300 text-zinc-600 dark:border-zinc-700 dark:text-zinc-300"
            }`}
          >
            {s}
          </button>
        ))}
      </div>
      <select
        value={filters.jobType}
        onChange={(e) => setFilters({ ...filters, jobType: e.target.value as Filters["jobType"] })}
        className="rounded border border-zinc-300 bg-transparent px-2 py-1 text-xs dark:border-zinc-700"
      >
        <option value="">Any type</option>
        <option value="contract">Contract</option>
        <option value="full_time">Full-time</option>
      </select>
      <input
        placeholder="Location…"
        value={filters.location}
        onChange={(e) => setFilters({ ...filters, location: e.target.value })}
        className="rounded border border-zinc-300 bg-transparent px-2 py-1 text-xs dark:border-zinc-700"
      />
      <select
        value={filters.easyApply}
        onChange={(e) => setFilters({ ...filters, easyApply: e.target.value as Filters["easyApply"] })}
        className="rounded border border-zinc-300 bg-transparent px-2 py-1 text-xs dark:border-zinc-700"
      >
        <option value="">Easy Apply: any</option>
        <option value="true">Easy Apply only</option>
        <option value="false">Non Easy-Apply</option>
      </select>
      {(filters.stacks.length || filters.jobType || filters.location || filters.easyApply) && (
        <button
          onClick={() => setFilters(EMPTY_FILTERS)}
          className="text-xs text-zinc-500 underline hover:text-zinc-800 dark:hover:text-zinc-200"
        >
          Clear
        </button>
      )}
    </div>
  );
}

function CompetitionTable({ jobs }: { jobs: Job[] }) {
  if (!jobs.length) return <Empty />;
  return (
    <Table head={["Title", "Company", "Stack", "Location", "Applicants", "Applicants/hr", "Posted"]}>
      {jobs.map((j) => (
        <tr key={j.id} className="border-t border-zinc-100 dark:border-zinc-800">
          <Td>{j.title}</Td>
          <Td>{j.company}</Td>
          <Td>{j.stacks.join(", ")}</Td>
          <Td>{j.location}</Td>
          <Td className="font-medium">{j.applicant_count ?? "—"}</Td>
          <Td>{j.applicants_per_hour != null ? j.applicants_per_hour.toFixed(1) : "—"}</Td>
          <Td>{j.posted_at ?? new Date(j.scraped_at).toLocaleDateString()}</Td>
        </tr>
      ))}
    </Table>
  );
}

function RawFeedTable({ jobs }: { jobs: Job[] }) {
  if (!jobs.length) return <Empty />;
  return (
    <div>
      <div className="mb-2 flex justify-end">
        <a href="/api/export" className="text-xs text-blue-600 underline">
          Export CSV
        </a>
      </div>
      <Table head={["Title", "Company", "Stack(s)", "Location", "Type", "Easy Apply", "Applicants", "Scraped"]}>
        {jobs.map((j) => (
          <tr key={j.id} className="border-t border-zinc-100 dark:border-zinc-800">
            <Td>{j.title}</Td>
            <Td>{j.company}</Td>
            <Td>{j.stacks.join(", ")}</Td>
            <Td>{j.location}</Td>
            <Td>{j.job_type ?? "—"}</Td>
            <Td>{j.easy_apply ? "Yes" : "No"}</Td>
            <Td>{j.applicant_count ?? "—"}</Td>
            <Td>{new Date(j.scraped_at).toLocaleDateString()}</Td>
          </tr>
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
        <tr key={r.company} className="border-t border-zinc-100 dark:border-zinc-800">
          <Td className="font-medium">{r.company}</Td>
          {STACKS.map((s) => (
            <Td key={s} className="text-center">
              {r.counts[s] ?? ""}
            </Td>
          ))}
          <Td className="text-center font-medium">{r.total}</Td>
        </tr>
      ))}
    </Table>
  );
}

function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
      <table className="w-full text-left text-sm">
        <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900">
          <tr>
            {head.map((h) => (
              <th key={h} className="px-3 py-2 font-medium">
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

function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2 ${className}`}>{children}</td>;
}

function Empty() {
  return <p className="text-sm text-zinc-500">No jobs match these filters yet.</p>;
}
