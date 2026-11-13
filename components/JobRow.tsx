"use client";

import { useState } from "react";
import type { ApiResult, RefreshResult, StackJob } from "@/lib/types";
import { SENIORITY_LABEL, type Seniority } from "@/lib/seniority";
import { bandOf, BAND_BADGE, applicantLabel } from "@/lib/applicants";

// One posting in a drill-down list, with a live "refresh" control that fetches
// this job's current applicant count from LinkedIn on demand. Shared by the
// stack and company drawers.
export function JobRow({ job }: { job: StackJob }) {
  const url = `https://www.linkedin.com/jobs/view/${job.linkedin_job_id}`;
  const [count, setCount] = useState<number | null>(job.applicant_count);
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");

  const refresh = async () => {
    setState("loading");
    try {
      const res = await fetch(`/api/refresh?id=${encodeURIComponent(job.linkedin_job_id)}`);
      const j = (await res.json()) as ApiResult<RefreshResult | null>;
      if (!j.data) throw new Error(j.error ?? "failed");
      setCount(j.data.applicant_count);
      setState("done");
    } catch {
      setState("error");
    }
  };

  return (
    <li className="flex items-center gap-3 bg-card px-4 py-3 transition-colors hover:bg-brand-soft/40">
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
          {job.location && <span className="text-muted">· {job.location}</span>}
          <SeniorityTag s={job.seniority} />
          {state === "done" && <span className="text-[10px] font-medium text-good">✓ live · just now</span>}
          {state === "error" && <span className="text-[10px] font-medium text-crit">couldn&apos;t refresh</span>}
        </div>
      </div>
      <div className="shrink-0 text-right">
        {count != null ? <ApplicantBadge n={count} /> : <span className="text-xs text-muted">—</span>}
        {job.applicants_per_hour != null && job.applicants_per_hour > 0 && (
          <div className="mt-1 text-[11px] tabular-nums text-warn">+{job.applicants_per_hour.toFixed(1)}/h</div>
        )}
      </div>
      <button
        onClick={refresh}
        disabled={state === "loading"}
        title="Fetch this job's current applicant count from LinkedIn"
        aria-label="Refresh applicant count from LinkedIn"
        className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-line text-sub transition-colors hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-50"
      >
        <svg
          viewBox="0 0 24 24"
          className={`h-3.5 w-3.5 ${state === "loading" ? "animate-spin" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 2v6h-6M3 22v-6h6" />
          <path d="M3.5 10a9 9 0 0 1 14.85-3.36L21 8M20.5 14a9 9 0 0 1-14.85 3.36L3 16" />
        </svg>
      </button>
    </li>
  );
}

function SeniorityTag({ s }: { s: Seniority }) {
  return (
    <span className="rounded-full border border-line px-1.5 py-px text-[10px] font-medium uppercase tracking-wide text-muted">
      {SENIORITY_LABEL[s]}
    </span>
  );
}

export function ApplicantBadge({ n }: { n: number }) {
  return (
    <span
      className={`inline-flex items-baseline gap-1 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${BAND_BADGE[bandOf(n)]}`}
    >
      {applicantLabel(n)}
      <span className="font-normal opacity-80">appl.</span>
    </span>
  );
}
