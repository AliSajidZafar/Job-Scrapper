"use client";

import { useState } from "react";
import { STACKS, STACK_COLOR_VAR, type Stack, type TrendPoint } from "@/lib/types";

// Dependency-free SVG line chart: one series per stack, x = day, y = open roles.
// Markers are drawn even for a single day (so the chart is never blank); lines
// connect them once there are two or more days. Colors come from the shared
// token palette, so it adapts to dark mode.

const W = 760;
const H = 300;
const PAD = { top: 16, right: 20, bottom: 36, left: 48 };

export function TrendChart({ points }: { points: TrendPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);

  if (points.length === 0) {
    return <p className="text-sm text-muted">No trend data yet — run a scrape to populate it.</p>;
  }

  const days = [...new Set(points.map((p) => p.day))].sort();
  const maxCount = Math.max(1, ...points.map((p) => p.job_count));
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const x = (i: number) =>
    days.length === 1 ? PAD.left + plotW / 2 : PAD.left + (i / (days.length - 1)) * plotW;
  const y = (v: number) => PAD.top + plotH - (v / maxCount) * plotH;

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(maxCount * f));
  const fmtDay = (d: string) =>
    new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const valueAt = (day: string, stack: Stack) =>
    points.find((p) => p.day === day && p.stack === stack)?.job_count ?? 0;

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

        {/* series: line (>=2 days) + donut markers */}
        {STACKS.map((stack) => {
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
      {hover != null && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-lg border border-line bg-card px-3 py-2 text-xs shadow-lg"
          style={{ left: `${(x(hover) / W) * 100}%`, top: 4 }}
        >
          <div className="mb-1.5 font-medium text-ink">{fmtDay(days[hover])}</div>
          <div className="space-y-1">
            {STACKS.map((s) => (
              <div key={s} className="flex items-center justify-between gap-4">
                <span className="inline-flex items-center gap-1.5 text-sub">
                  <span className="h-2 w-2 rounded-full" style={{ background: `var(${STACK_COLOR_VAR[s]})` }} />
                  {s}
                </span>
                <span className="tabular-nums text-ink">{valueAt(days[hover], s).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* legend */}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-sub">
        {STACKS.map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: `var(${STACK_COLOR_VAR[s]})` }} />
            {s}
          </span>
        ))}
      </div>

      {days.length < 2 && (
        <p className="mt-3 text-xs text-muted">
          Showing one day so far — lines appear once there are at least two days of scrapes.
        </p>
      )}
    </div>
  );
}
