"use client";

import { createContext, useContext } from "react";
import { STACKS } from "@/lib/types";

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
      title="Prime: a fresh role with few applicants in a top-ranked Prime stack — apply early"
      className="inline-flex items-center gap-1 rounded-full border border-prime/40 bg-prime-soft px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-prime"
    >
      <Flame className="h-2.5 w-2.5" />
      {!compact && "Prime"}
    </span>
  );
}

// The highlighted panel on the main dashboard: the top stacks by opportunity
// score, rank 1 first. The cards inside are the dashboard's own StackTile in
// its Prime variant (red border + rank), passed in as children, so this panel
// and "Demand by stack" share one card design. This is the frame around them.
export function PrimePanel({ count, children }: { count?: number; children: React.ReactNode }) {
  return (
    <section
      aria-labelledby="prime-heading"
      className="overflow-hidden rounded-2xl border border-prime/30 bg-gradient-to-br from-prime-soft/70 to-card"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-prime/20 px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-prime text-prime-ink">
            <Flame className="h-4 w-4" />
          </span>
          <div>
            <h2 id="prime-heading" className="text-sm font-semibold tracking-tight text-ink">
              Prime Opportunities
            </h2>
            <p className="text-xs text-muted">
              The stacks with the most open roles for the fewest applicants, ranked by opportunity score (open
              roles ÷ avg applicants). Select one for the full breakdown.
            </p>
          </div>
        </div>
        {count != null && (
          <span className="rounded-full border border-prime/40 bg-prime-soft px-2 py-0.5 text-xs font-semibold tabular-nums text-prime">
            Top {count} of {STACKS.length} stacks
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 p-3 sm:grid-cols-3 sm:p-4 lg:grid-cols-5">{children}</div>
    </section>
  );
}
