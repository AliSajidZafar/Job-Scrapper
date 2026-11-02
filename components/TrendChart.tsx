"use client";

import { useEffect, useMemo, useState } from "react";
import { STACKS, STACK_COLOR_VAR, STACK_SHORT, type Stack, type TrendPoint } from "@/lib/types";

// Dependency-free SVG line chart: one series per stack, x = day, y = open roles.
// Markers are drawn even for a single day (so the chart is never blank); lines
// connect them once there are two or more days. Colors come from the shared
// token palette, so it adapts to dark mode. `visible` (the dashboard's stack
// filter) sets which series start on; the legend below toggles them locally.
//
// Area gradient fills appear only when the view is focused to a few series
// (<= FILL_LIMIT) — with all ten on, overlapping fills would read as mud, so we
// keep lines only and let the fills reward a focused view.

const W = 760;
const H = 300;
const PAD = { top: 16, right: 20, bottom: 36, left: 48 };
const FILL_LIMIT = 3;

export function TrendChart({ points, visible = [] }: { points: TrendPoint[]; visible?: Stack[] }) {
  const [hover, setHover] = useState<number | null>(null);
  // A single series the viewer has focused by clicking the legend (null = all).
  // Reset whenever the dashboard filter (`visible`) changes so they never fight.
  const [focus, setFocus] = useState<Stack | null>(null);
  const visibleKey = visible.join("|");
  useEffect(() => setFocus(null), [visibleKey]);

  // The legend's full set: the filter selection, or all ten when nothing picked.
  const base: Stack[] = useMemo(
    () => (visible.length ? STACKS.filter((s) => visible.includes(s)) : [...STACKS]),
    [visible],
  );
  // Focused view shows that one series; otherwise everything in the base set.
  const active = focus && base.includes(focus) ? [focus] : base;
  const activeSet = new Set(active);
  const showFills = active.length > 0 && active.length <= FILL_LIMIT;

  if (points.length === 0) {
    return <p className="text-sm text-muted">No trend data yet — run a scrape to populate it.</p>;
  }

  const days = [...new Set(points.map((p) => p.day))].sort();
  const maxCount = Math.max(1, ...points.filter((p) => activeSet.has(p.stack)).map((p) => p.job_count));
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const baseY = PAD.top + plotH;

  const x = (i: number) =>
    days.length === 1 ? PAD.left + plotW / 2 : PAD.left + (i / (days.length - 1)) * plotW;
  const y = (v: number) => PAD.top + plotH - (v / maxCount) * plotH;

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(maxCount * f));
  const fmtDay = (d: string) =>
    new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const valueAt = (day: string, stack: Stack) =>
    points.find((p) => p.day === day && p.stack === stack)?.job_count ?? 0;

  // Click a legend chip to focus that series (and reveal its area fill); click
  // the focused one again to return to the full view.
  const toggle = (s: Stack) => setFocus((cur) => (cur === s ? null : s));

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const sx = ((e.clientX - rect.left) / rect.width) * W;
    let best = 0;
    let bestDist = Infinity;
    days.forEach((_, i) => {
      const d = Math.abs(x(i) - sx);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    });
    setHover(best);
  }

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full select-none"
        role="img"
        aria-label="Open roles per stack over time"
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          {active.map((stack) => (
            <linearGradient key={stack} id={`area-${slug(stack)}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={`var(${STACK_COLOR_VAR[stack]})`} stopOpacity={0.24} />
              <stop offset="100%" stopColor={`var(${STACK_COLOR_VAR[stack]})`} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>

        {/* gridlines + y ticks */}
        {ticks.map((t, k) => (
          <g key={k}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--grid)" strokeWidth={1} />
            <text
              x={PAD.left - 10}
              y={y(t) + 3.5}
              textAnchor="end"
              fontSize="10"
              fill="var(--muted)"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {t.toLocaleString()}
            </text>
          </g>
        ))}

        {/* x labels */}
        {days.map((d, i) => (
          <text key={d} x={x(i)} y={H - 12} textAnchor="middle" fontSize="10" fill="var(--muted)">
            {fmtDay(d)}
          </text>
        ))}

        {/* hover crosshair */}
        {hover != null && (
          <line
            x1={x(hover)}
            x2={x(hover)}
            y1={PAD.top}
            y2={H - PAD.bottom}
            stroke="var(--axis)"
            strokeWidth={1}
            strokeDasharray="3 3"
          />
        )}

        {/* area fills (focused view only), drawn under the lines */}
        {showFills &&
          active.map((stack) => {
            const pts = days.map((d, i) => `${x(i)},${y(valueAt(d, stack))}`);
            if (pts.length < 2) return null;
            const poly = `${x(0)},${baseY} ${pts.join(" ")} ${x(days.length - 1)},${baseY}`;
            return <polygon key={stack} points={poly} fill={`url(#area-${slug(stack)})`} />;
          })}

        {/* series: line (>=2 days) + donut markers */}
        {active.map((stack) => {
          const color = `var(${STACK_COLOR_VAR[stack]})`;
          const pts = days.map((d, i) => ({ i, cx: x(i), cy: y(valueAt(d, stack)) }));
          return (
            <g key={stack}>
              {pts.length > 1 && (
                <polyline
                  points={pts.map((p) => `${p.cx},${p.cy}`).join(" ")}
                  fill="none"
                  stroke={color}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              )}
              {pts.map((p) => (
                <circle
                  key={p.i}
                  cx={p.cx}
                  cy={p.cy}
                  r={hover === p.i ? 5 : 4}
                  fill="var(--card)"
                  stroke={color}
                  strokeWidth={2}
                />
              ))}
            </g>
          );
        })}
      </svg>

      {/* tooltip */}
      {hover != null && active.length > 0 && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-lg border border-line bg-card px-3 py-2 text-xs shadow-lg"
          style={{ left: `${(x(hover) / W) * 100}%`, top: 4 }}
        >
          <div className="mb-1.5 font-medium text-ink">{fmtDay(days[hover])}</div>
          <div className="space-y-1">
            {[...active]
              .sort((a, b) => valueAt(days[hover!], b) - valueAt(days[hover!], a))
              .map((s) => (
                <div key={s} className="flex items-center justify-between gap-4">
                  <span className="inline-flex items-center gap-1.5 text-sub">
                    <span className="h-2 w-2 rounded-full" style={{ background: `var(${STACK_COLOR_VAR[s]})` }} />
                    {STACK_SHORT[s]}
                  </span>
                  <span className="tabular-nums text-ink">{valueAt(days[hover!], s).toLocaleString()}</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* clickable legend — click a series to focus it (and reveal its fill) */}
      <div className="mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-1.5">
        {base.map((s) => {
          const isFocused = focus === s;
          const dimmed = focus != null && !isFocused;
          return (
            <button
              key={s}
              type="button"
              onClick={() => toggle(s)}
              aria-pressed={isFocused}
              title={isFocused ? `Show all stacks` : `Focus ${STACK_SHORT[s]}`}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-all ${
                isFocused
                  ? "border-brand bg-brand-soft text-ink"
                  : dimmed
                    ? "border-transparent text-muted/70 hover:text-sub"
                    : "border-line text-sub hover:border-brand hover:text-ink"
              }`}
            >
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: `var(${STACK_COLOR_VAR[s]})`, opacity: dimmed ? 0.45 : 1 }}
              />
              {STACK_SHORT[s]}
            </button>
          );
        })}
        {base.length > 1 && (
          <span className="ml-1 text-[11px] text-muted">
            {focus ? "· showing one — click it again for all" : "· click a stack to focus"}
          </span>
        )}
      </div>

      {days.length < 2 && (
        <p className="mt-3 text-xs text-muted">
          Showing one day so far — lines appear once there are at least two days of scrapes.
        </p>
      )}
    </div>
  );
}

// Safe id fragment for gradient ids (stack names contain spaces, ".", "/").
const slug = (s: string) => s.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
// (focus-model legend)
