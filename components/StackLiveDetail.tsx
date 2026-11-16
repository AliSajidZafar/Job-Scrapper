"use client";

import { useEffect, useState } from "react";
import {
  STACK_COLOR_VAR,
  type ApiResult,
  type RefreshResult,
  type Stack,
  type StackLiveData,
  type StackLiveJob,
} from "@/lib/types";
import { bandOf } from "@/lib/applicants";
import { ApplicantBadge } from "./JobRow";

// Slide-over for a Prime stack: its HOTTEST LIVE roles, pulled from LinkedIn on
// demand (GET /api/stack-live) — fresh openings with their current applicant
// counts, fewest applicants first. This is deliberately NOT the tracked sample
// the "Demand by stack" tiles open; it's a live, real-time look at where the
// low-competition roles are right now.
export function StackLiveDetail({ stack, onClose }: { stack: Stack | null; onClose: () => void }) {
  const [data, setData] = useState<StackLiveData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const open = stack != null;

  useEffect(() => {
    if (!stack) return;
    let cancelled = false;
    setData(null);
    setError(false);
    setLoading(true);
    fetch(`/api/stack-live?stack=${encodeURIComponent(stack)}`)
      .then((r) => r.json() as Promise<ApiResult<StackLiveData | null>>)
      .then((res) => {
        if (cancelled) return;
        setData(res.data ?? null);
        setError(!res.data);
      })
      .catch(() => !cancelled && setError(true))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [stack]);

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
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={`${stack} live roles`}>
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-ink/40 backdrop-blur-[2px] animate-[fade_.2s_ease]"
      />

      <div className="absolute inset-y-0 right-0 flex w-full max-w-xl flex-col border-l border-line bg-plane shadow-2xl animate-[slideIn_.28s_cubic-bezier(.22,1,.36,1)]">
        {/* header */}
        <div className="sticky top-0 z-10 border-b border-line bg-card/95 px-5 py-4 backdrop-blur">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2.5">
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: color }} />
                <h2 className="truncate text-lg font-semibold tracking-tight text-ink">{stack} · hottest live roles</h2>
              </div>
              <p className="mt-0.5 text-xs text-muted">
                {data
                  ? `Pulled live from LinkedIn · ${fmtWhen(data.as_of)} PKT · fewest applicants first`
                  : "Fetching the freshest roles from LinkedIn right now…"}
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
          {data && (
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-prime/40 bg-prime-soft px-2 py-0.5 text-xs font-semibold tabular-nums text-prime">
                {data.jobs.length} hot {data.jobs.length === 1 ? "role" : "roles"}
              </span>
              <span className="text-[11px] text-muted">checked {data.scanned} live listings · fresh (posted ≤24h) · US · remote</span>
            </div>
          )}
        </div>

        {/* body */}
        <div className="flex-1 overflow-y-auto px-5 py-5">
          {loading && <LiveSkeleton />}
          {!loading && error && <Empty text="Couldn't reach LinkedIn for this stack. Please try again in a moment." />}
          {!loading && data && data.jobs.length === 0 && (
            <Empty text="LinkedIn has no fresh remote roles for this stack right now. Check back later." />
          )}
          {!loading && data && data.jobs.length > 0 && (
            <>
              <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line">
                {data.jobs.map((j, i) => (
                  <LiveRow key={j.linkedin_job_id} job={j} rank={i + 1} />
                ))}
              </ul>
              {data.partial && (
                <p className="mt-3 text-center text-xs text-muted">
                  LinkedIn currently lists only {data.jobs.length} fresh remote {stack} role
                  {data.jobs.length === 1 ? "" : "s"} — that&apos;s everything available right now.
                </p>
              )}
            </>
          )}
        </div>
      </div>

      <style>{`
        @keyframes slideIn { from { transform: translateX(16px); opacity: .4 } to { transform: translateX(0); opacity: 1 } }
        @keyframes fade { from { opacity: 0 } to { opacity: 1 } }
      `}</style>
    </div>
  );
}

function LiveRow({ job, rank }: { job: StackLiveJob; rank: number }) {
  const url = `https://www.linkedin.com/jobs/view/${job.linkedin_job_id}`;
  const [count, setCount] = useState<number | null>(job.applicant_count);
  const [liveText, setLiveText] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const hot = count != null && bandOf(count) === "fresh";

  // Re-read this one job's CURRENT applicant count from LinkedIn on demand, and
  // show LinkedIn's exact wording — so the figure on the site matches the figure
  // on LinkedIn's page at that moment.
  const refresh = async () => {
    setState("loading");
    try {
      const res = await fetch(`/api/refresh?id=${encodeURIComponent(job.linkedin_job_id)}`);
      const j = (await res.json()) as ApiResult<RefreshResult | null>;
      if (!j.data) throw new Error(j.error ?? "failed");
      setCount(j.data.applicant_count);
      setLiveText(j.data.applicant_text);
      setState("done");
    } catch {
      setState("error");
    }
  };

  // Safety net: if this role arrived without a live count (its detail fetch was
  // rate-limited server-side), fill it in automatically on open — staggered so
  // the rows don't all hit LinkedIn at once — so every row shows LinkedIn's real
  // number without the user having to click refresh.
  useEffect(() => {
    if (job.applicant_count != null) return;
    const t = setTimeout(refresh, Math.random() * 2500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <li className="flex items-center gap-3 bg-card px-4 py-3 transition-colors hover:bg-brand-soft/40">
      <span className="w-5 shrink-0 text-center text-xs font-semibold tabular-nums text-muted">{rank}</span>
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
          {job.posted && <span className="text-muted">· {ago(job.posted)}</span>}
          {hot && (
            <span className="inline-flex items-center gap-1 rounded-full border border-prime/40 bg-prime-soft px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-prime">
              Hot
            </span>
          )}
          {state === "done" && (
            <span className="text-[10px] font-medium text-good">✓ {liveText ?? "live"} · matches LinkedIn now</span>
          )}
          {state === "error" && (
            <span className="text-[10px] font-medium text-warn">
              {count != null ? "LinkedIn busy · showing last live count" : "LinkedIn busy · tap ↻ to retry"}
            </span>
          )}
        </div>
      </div>
      <div className="shrink-0 text-right">
        {count != null ? <ApplicantBadge n={count} /> : <span className="text-xs text-muted">—</span>}
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

function Empty({ text }: { text: string }) {
  return <p className="rounded-xl border border-dashed border-line bg-card p-5 text-center text-sm text-muted">{text}</p>;
}

// "today" / "1d ago" / "5d ago" from the card's posted date (date-only ISO).
function ago(iso: string): string {
  const d = Date.parse(iso);
  if (Number.isNaN(d)) return "";
  const days = Math.floor((Date.now() - d) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "1d ago";
  return `${days}d ago`;
}

const fmtWhen = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", {
    timeZone: "Asia/Karachi",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

function LiveSkeleton() {
  return (
    <div className="space-y-4">
      <p className="text-center text-xs text-muted">
        Reading live applicant counts from LinkedIn — this takes a few seconds.
      </p>
      <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line">
        {Array.from({ length: 8 }, (_, i) => (
          <li key={i} className="flex items-center gap-3 bg-card px-4 py-3">
            <div className="h-4 w-4 shrink-0 animate-pulse rounded bg-line" />
            <div className="flex-1 space-y-2">
              <div className="h-3.5 w-2/3 animate-pulse rounded bg-line" />
              <div className="h-3 w-1/3 animate-pulse rounded bg-line" />
            </div>
            <div className="h-5 w-14 animate-pulse rounded-full bg-line" />
          </li>
        ))}
      </ul>
    </div>
  );
}
