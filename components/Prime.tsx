"use client";

import { createContext, useContext } from "react";
import { STACK_COLOR_VAR, STACK_SHORT, type PrimeData, type PrimeJob } from "@/lib/types";
import { applicantLabel } from "@/lib/applicants";

// One source of truth: the set of LinkedIn job ids that are Prime right now
// (from /api/prime). Any job shown anywhere is badged by membership here, so the
// inline badge and the dashboard panel never disagree.
const PrimeIdsContext = createContext<Set<string>>(new Set());

export function PrimeProvider({ ids, children }: { ids: Set<string>; children: React.ReactNode }) {
  return <PrimeIdsContext.Provider value={ids}>{children}</PrimeIdsContext.Provider>;
}

export function usePrimeIds(): Set<string> {
  return useContext(PrimeIdsContext);
}

// A small "Prime" flame. Shared wherever a hot job is marked.
function Flame({ className = "h-3 w-3" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M12 2c.6 3.1-1.2 4.9-2.6 6.3C8 9.7 7 10.9 7 13a5 5 0 0 0 10 .3c.1-2.2-1-3.9-1.8-5.1-.3 1-1 1.8-1.9 2 .6-1.9.2-4.4-1.3-8.2Z" />
    </svg>
  );
}

// The badge placed on an individual job that qualifies as Prime.
export function PrimeBadge({ compact = false }: { compact?: boolean }) {
  return (
    <span
      title="Prime: a fresh role with few applicants in a high-demand stack — apply early"
      className="inline-flex items-center gap-1 rounded-full border border-prime/40 bg-prime-soft px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-prime"
    >
      <Flame className="h-2.5 w-2.5" />
      {!compact && "Prime"}
    </span>
  );
}

// The highlighted panel on the main dashboard: the hottest roles across all
// stacks, hottest first. Renders nothing when there are none right now.
export function PrimePanel({ data, loading }: { data: PrimeData | null; loading: boolean }) {
  if (loading && !data) {
    return <div className="h-40 animate-pulse rounded-2xl border border-line bg-card" />;
  }
  if (!data || data.jobs.length === 0) return null;

  return (
    <section className="overflow-hidden rounded-2xl border border-prime/30 bg-gradient-to-br from-prime-soft/70 to-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-prime/20 px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-prime text-prime-ink">
            <Flame className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-ink">Prime Opportunities</h2>
            <p className="text-xs text-muted">Fresh roles, few applicants, high-demand stacks — move early, before the window closes.</p>
          </div>
        </div>
        <span className="rounded-full border border-prime/40 bg-prime-soft px-2 py-0.5 text-xs font-semibold tabular-nums text-prime">
          {data.jobs.length} hot {data.jobs.length === 1 ? "role" : "roles"}
        </span>
      </div>

      <ul className="grid grid-cols-1 gap-px bg-line/60 sm:grid-cols-2">
        {data.jobs.map((j) => (
          <PrimeRow key={j.id} job={j} />
        ))}
      </ul>
    </section>
  );
}

function PrimeRow({ job }: { job: PrimeJob }) {
  const url = `https://www.linkedin.com/jobs/view/${job.linkedin_job_id}`;
  return (
    <li className="flex items-start gap-3 bg-card px-4 py-3">
      <span className="mt-0.5 shrink-0 text-prime">
        <Flame className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="line-clamp-1 text-sm font-medium text-ink hover:text-brand hover:underline"
        >
          {job.title}
        </a>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-sub">
          <span className="truncate">{job.company}</span>
          {job.location && <span className="hidden text-muted sm:inline">· {job.location}</span>}
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {job.stacks.slice(0, 2).map((s) => (
            <span key={s} className="inline-flex items-center gap-1 rounded-full border border-line px-1.5 py-px text-[10px] text-sub">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: `var(${STACK_COLOR_VAR[s]})` }} />
              {STACK_SHORT[s]}
            </span>
          ))}
          <span className="inline-flex items-center gap-1 rounded-full bg-plane px-1.5 py-px text-[10px] font-medium tabular-nums text-ink">
            ≤{applicantLabel(job.applicant_count)} applicants
          </span>
          <span
            className="inline-flex items-center gap-1 rounded-full bg-prime-soft px-1.5 py-px text-[10px] font-semibold tabular-nums text-prime"
            title={`${job.open_roles.toLocaleString()} open roles on LinkedIn for this stack`}
          >
            {job.applicants_per_hour != null ? `+${job.applicants_per_hour.toFixed(1)}/hr` : "high demand"}
          </span>
        </div>
      </div>
    </li>
  );
}
