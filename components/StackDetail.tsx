"use client";

import { useEffect, useState } from "react";
import {
  STACK_COLOR_VAR,
  type ApiResult,
  type Stack,
  type StackDetail,
  type StackJob,
  type TrendPoint,
} from "@/lib/types";
import { SENIORITY_LABEL, SENIORITY_ORDER, type Seniority } from "@/lib/seniority";
import { TrendChart } from "./TrendChart";

// Slide-over drill-down for a single tech stack. Opens when `stack` is set,
// fetches /api/stack live, and lays its data out in clear sections: headline
// numbers, a dedicated demand chart, the experience-level split, the top
// hirers, and the individual open roles with their applicant counts.
export function StackDetail({ stack, onClose }: { stack: Stack | null; onClose: () => void }) {
  const [detail, setDetail] = useState<StackDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const open = stack != null;

  // Fetch whenever a new stack is opened.
  useEffect(() => {
    if (!stack) return;
    let cancelled = false;
    setDetail(null);
    setError(false);
    setLoading(true);
    fetch(`/api/stack?stack=${encodeURIComponent(stack)}`)
      .then((r) => r.json() as Promise<ApiResult<StackDetail | null>>)
      .then((res) => {
        if (cancelled) return;
        setDetail(res.data ?? null);
        setError(!res.data);
      })
      .catch(() => !cancelled && setError(true))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [stack]);

  // Esc to close + lock the page behind the panel while it's open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  const color = `var(${STACK_COLOR_VAR[stack]})`;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={`${stack} details`}>
      {/* backdrop */}
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-ink/40 backdrop-blur-[2px] animate-[fade_.2s_ease]"
      />

      {/* panel */}
      <div className="absolute inset-y-0 right-0 flex w-full max-w-xl flex-col border-l border-line bg-plane shadow-2xl animate-[slideIn_.28s_cubic-bezier(.22,1,.36,1)]">
        {/* header (sticky) */}
        <div className="sticky top-0 z-10 border-b border-line bg-card/95 px-5 py-4 backdrop-blur">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2.5">
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: color }} />
                <h2 className="truncate text-lg font-semibold tracking-tight text-ink">{stack}</h2>
              </div>
              <p className="mt-0.5 text-xs text-muted">
                {detail?.as_of ? `Live from the latest scrape · ${fmtWhen(detail.as_of)} PKT` : "US remote demand on LinkedIn"}
              </p>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-line text-sub transition-colors hover:border-brand hover:text-ink"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </div>
        </div>

        {/* body (scrolls) */}
        <div className="flex-1 overflow-y-auto px-5 py-5">
          {loading && <DetailSkeleton />}
          {!loading && error && <Empty text="Couldn't load this stack. Please try again." />}
          {!loading && detail && <Body detail={detail} color={color} />}
        </div>
      </div>

      <style>{`
        @keyframes slideIn { from { transform: translateX(16px); opacity: .4 } to { transform: translateX(0); opacity: 1 } }
        @keyframes fade { from { opacity: 0 } to { opacity: 1 } }
      `}</style>
    </div>
  );
}

function Body({ detail, color }: { detail: StackDetail; color: string }) {
  const { applicants } = detail;
  const points: TrendPoint[] = detail.trend.map((t) => ({
    day: t.day,
    stack: detail.stack,
    job_count: t.open_roles ?? t.captured,
  }));

  return (
    <div className="space-y-7">
      {/* headline numbers */}
      <section className="grid grid-cols-2 gap-3">
        <Stat label="Open roles" value={detail.open_roles != null ? detail.open_roles.toLocaleString() : "—"} sub="on LinkedIn" delta={detail.change_pct} accent={color} />
        <Stat label="Tracked in detail" value={detail.captured.toLocaleString()} sub="postings re-checked" />
        <Stat label="Avg applicants" value={applicants.avg != null ? String(applicants.avg) : "—"} sub={applicants.median != null ? `median ${applLabel(applicants.median)}` : "per job"} />
        <Stat label="Most applicants" value={applicants.max != null ? applLabel(applicants.max) : "—"} sub="on a single role" />
      </section>

      {/* demand trend */}
      <Section title="Demand trend" hint="Open roles on LinkedIn over time.">
        {points.length >= 1 ? (
          <TrendChart points={points} visible={[detail.stack]} />
        ) : (
          <Empty text="No trend history yet." />
        )}
      </Section>

      {/* experience level */}
      <Section title="Experience level" hint="Inferred from job titles (Junior / Intermediate / Advanced).">
        <SeniorityBar seniority={detail.seniority} color={color} total={detail.captured} />
      </Section>

      {/* top hirers */}
      <Section title="Top companies hiring" hint={`Most ${detail.stack} roles in the tracked sample.`}>
        {detail.companies.length ? (
          <ol className="space-y-2">
            {detail.companies.map((c, i) => (
              <li key={c.company} className="flex items-center gap-3">
                <span className="w-4 text-xs font-semibold tabular-nums text-muted">{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink">{c.company}</span>
                  <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-line">
                    <span
                      className="block h-full rounded-full"
                      style={{ width: `${(c.count / detail.companies[0].count) * 100}%`, background: color }}
                    />
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-sm font-semibold tabular-nums text-ink">{c.count}</span>
                  <span className="block text-[11px] text-muted">
                    {c.avg_applicants != null ? `${c.avg_applicants} appl.` : "—"}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <Empty text="No companies tracked yet." />
        )}
      </Section>

      {/* open roles list */}
      <Section
        title="Open roles"
        hint={`${detail.jobs.length} tracked postings, lowest competition first.`}
      >
        {detail.jobs.length ? (
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line">
            {detail.jobs.map((j) => (
              <JobRow key={j.id} job={j} />
            ))}
          </ul>
        ) : (
          <Empty text="No individual postings tracked yet." />
        )}
      </Section>
    </div>
  );
}

/* ----------------------------- pieces ------------------------------ */

function Stat({
  label,
  value,
  sub,
  delta = null,
  accent,
}: {
  label: string;
  value: string;
  sub: string;
  delta?: number | null;
  accent?: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-line bg-card p-3.5">
      {accent && <span className="absolute inset-y-0 left-0 w-[3px]" style={{ background: accent }} />}
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-1.5 flex items-baseline gap-2">
        <span className="text-2xl font-semibold tabular-nums tracking-tight text-ink">{value}</span>
        {delta != null && <Delta pct={delta} />}
      </div>
      <div className="mt-0.5 text-xs text-muted">{sub}</div>
    </div>
  );
}

function Delta({ pct }: { pct: number }) {
  const tone = pct > 0 ? "bg-good/10 text-good" : pct < 0 ? "bg-crit/10 text-crit" : "bg-line/60 text-muted";
  const arrow = pct > 0 ? "▲" : pct < 0 ? "▼" : "•";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${tone}`}>
      {arrow} {Math.abs(pct)}%
    </span>
  );
}

// Single sequential bar: more senior = more intense (the stack's own colour).
function SeniorityBar({ seniority, color, total }: { seniority: Record<Seniority, number>; color: string; total: number }) {
  const n = SENIORITY_ORDER.reduce((s, k) => s + seniority[k], 0);
  const opacity: Record<Seniority, number> = { junior: 0.4, mid: 0.68, senior: 1 };
  if (!n) return <Empty text="No roles to classify yet." />;

  return (
    <div>
      <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded-full">
        {SENIORITY_ORDER.filter((k) => seniority[k] > 0).map((k) => (
          <span
            key={k}
            title={`${SENIORITY_LABEL[k]}: ${seniority[k]}`}
            style={{ width: `${(seniority[k] / n) * 100}%`, background: color, opacity: opacity[k] }}
          />
        ))}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {SENIORITY_ORDER.map((k) => (
          <div key={k} className="rounded-lg border border-line bg-card px-2.5 py-2">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: color, opacity: opacity[k] }} />
              <span className="text-[11px] font-medium text-sub">{SENIORITY_LABEL[k]}</span>
            </div>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-base font-semibold tabular-nums text-ink">{seniority[k]}</span>
              <span className="text-[11px] text-muted">{total ? Math.round((seniority[k] / total) * 100) : 0}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function JobRow({ job }: { job: StackJob }) {
  const url = `https://www.linkedin.com/jobs/view/${job.linkedin_job_id}`;
  return (
    <li className="flex items-center gap-3 bg-card px-4 py-3 transition-colors hover:bg-brand-soft/40">
      <div className="min-w-0 flex-1">
        <a href={url} target="_blank" rel="noreferrer" className="line-clamp-1 text-sm font-medium text-ink hover:text-brand hover:underline">
          {job.title}
        </a>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-sub">
          <span className="truncate">{job.company}</span>
          {job.location && <span className="text-muted">· {job.location}</span>}
          <SeniorityTag s={job.seniority} />
        </div>
      </div>
      <div className="shrink-0 text-right">
        {job.applicant_count != null ? <ApplicantBadge n={job.applicant_count} /> : <span className="text-xs text-muted">—</span>}
        {job.applicants_per_hour != null && job.applicants_per_hour > 0 && (
          <div className="mt-1 text-[11px] tabular-nums text-warn">+{job.applicants_per_hour.toFixed(1)}/h</div>
        )}
      </div>
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

const applLabel = (n: number) => (n === 25 ? "<25" : n.toLocaleString());

function ApplicantBadge({ n }: { n: number }) {
  const tone = n <= 25 ? "bg-good/10 text-good" : n <= 50 ? "bg-brand-soft text-brand" : "bg-warn/10 text-warn";
  return (
    <span className={`inline-flex items-baseline gap-1 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${tone}`}>
      {applLabel(n)}
      <span className="font-normal opacity-80">appl.</span>
    </span>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      {hint && <p className="mb-3 mt-0.5 text-xs text-muted">{hint}</p>}
      {!hint && <div className="mb-3" />}
      {children}
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-xl border border-dashed border-line bg-card p-5 text-center text-sm text-muted">{text}</p>;
}

const fmtWhen = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", {
    timeZone: "Asia/Karachi",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

function DetailSkeleton() {
  return (
    <div className="space-y-7">
      <div className="grid grid-cols-2 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-[86px] animate-pulse rounded-xl border border-line bg-card" />
        ))}
      </div>
      <div className="h-56 animate-pulse rounded-xl border border-line bg-card" />
      <div className="h-24 animate-pulse rounded-xl border border-line bg-card" />
      <div className="h-40 animate-pulse rounded-xl border border-line bg-card" />
    </div>
  );
}
