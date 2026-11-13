"use client";

import { useEffect, useState } from "react";
import { STACK_COLOR_VAR, STACK_SHORT, type ApiResult, type CompanyDetail } from "@/lib/types";
import { SENIORITY_LABEL, SENIORITY_ORDER } from "@/lib/seniority";
import { applicantLabel } from "@/lib/applicants";
import { JobRow } from "./JobRow";

// Slide-over drill-down for a single company: how many roles they're hiring,
// which stacks, applicant competition, experience split, and the postings.
export function CompanyDetail({ company, onClose }: { company: string | null; onClose: () => void }) {
  const [detail, setDetail] = useState<CompanyDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const open = company != null;

  useEffect(() => {
    if (!company) return;
    let cancelled = false;
    setDetail(null);
    setError(false);
    setLoading(true);
    fetch(`/api/company?name=${encodeURIComponent(company)}`)
      .then((r) => r.json() as Promise<ApiResult<CompanyDetail | null>>)
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
  }, [company]);

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

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={`${company} details`}>
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-ink/40 backdrop-blur-[2px] animate-[fade_.2s_ease]" />

      <div className="absolute inset-y-0 right-0 flex w-full max-w-xl flex-col border-l border-line bg-plane shadow-2xl animate-[slideIn_.28s_cubic-bezier(.22,1,.36,1)]">
        <div className="sticky top-0 z-10 border-b border-line bg-card/95 px-5 py-4 backdrop-blur">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="truncate text-lg font-semibold tracking-tight text-ink">{company}</h2>
              <p className="mt-0.5 text-xs text-muted">
                {detail?.as_of ? `Across tracked stacks · latest scrape ${fmtWhen(detail.as_of)} PKT` : "Hiring on LinkedIn (US remote)"}
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

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {loading && <Skeleton />}
          {!loading && error && <Empty text="Couldn't load this company. Please try again." />}
          {!loading && detail && <Body detail={detail} />}
        </div>
      </div>

      <style>{`
        @keyframes slideIn { from { transform: translateX(16px); opacity: .4 } to { transform: translateX(0); opacity: 1 } }
        @keyframes fade { from { opacity: 0 } to { opacity: 1 } }
      `}</style>
    </div>
  );
}

function Body({ detail }: { detail: CompanyDetail }) {
  const { applicants } = detail;
  const maxStack = detail.stacks[0]?.count ?? 0;
  const seniorityTotal = SENIORITY_ORDER.reduce((s, k) => s + detail.seniority[k], 0);

  return (
    <div className="space-y-7">
      {/* headline numbers */}
      <section className="grid grid-cols-2 gap-3">
        <Stat label="Roles tracked" value={detail.captured.toLocaleString()} sub="open postings we follow" />
        <Stat label="Stacks hiring" value={String(detail.stacks.length)} sub="tech areas" />
        <Stat label="Avg applicants" value={applicants.avg != null ? String(applicants.avg) : "—"} sub={applicants.median != null ? `median ${applicantLabel(applicants.median)}` : "per role"} />
        <Stat label="Most applicants" value={applicants.max != null ? applicantLabel(applicants.max) : "—"} sub="on a single role" />
      </section>

      {/* stacks they hire for */}
      <Section title="Stacks they hire for" hint="How this company's tracked roles split across stacks.">
        <ol className="space-y-2">
          {detail.stacks.map((s) => (
            <li key={s.stack} className="flex items-center gap-3">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: `var(${STACK_COLOR_VAR[s.stack]})` }} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-ink">{STACK_SHORT[s.stack]}</span>
                <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-line">
                  <span className="block h-full rounded-full" style={{ width: `${maxStack ? (s.count / maxStack) * 100 : 0}%`, background: `var(${STACK_COLOR_VAR[s.stack]})` }} />
                </span>
              </span>
              <span className="shrink-0 text-sm font-semibold tabular-nums text-ink">{s.count}</span>
            </li>
          ))}
        </ol>
      </Section>

      {/* experience level */}
      {seniorityTotal > 0 && (
        <Section title="Experience level" hint="Inferred from job titles.">
          <div className="grid grid-cols-3 gap-2">
            {SENIORITY_ORDER.map((k) => (
              <div key={k} className="rounded-lg border border-line bg-card px-2.5 py-2">
                <div className="text-[11px] font-medium text-sub">{SENIORITY_LABEL[k]}</div>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="text-base font-semibold tabular-nums text-ink">{detail.seniority[k]}</span>
                  <span className="text-[11px] text-muted">{Math.round((detail.seniority[k] / seniorityTotal) * 100)}%</span>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* postings */}
      <Section title="Open roles" hint={`${detail.jobs.length} tracked postings, lowest competition first. Use ↻ to refresh a count live.`}>
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

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl border border-line bg-card p-3.5">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-1.5 text-2xl font-semibold tabular-nums tracking-tight text-ink">{value}</div>
      <div className="mt-0.5 text-xs text-muted">{sub}</div>
    </div>
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
  new Date(iso).toLocaleString("en-GB", { timeZone: "Asia/Karachi", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

function Skeleton() {
  return (
    <div className="space-y-7">
      <div className="grid grid-cols-2 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-[86px] animate-pulse rounded-xl border border-line bg-card" />
        ))}
      </div>
      <div className="h-40 animate-pulse rounded-xl border border-line bg-card" />
      <div className="h-40 animate-pulse rounded-xl border border-line bg-card" />
    </div>
  );
}
