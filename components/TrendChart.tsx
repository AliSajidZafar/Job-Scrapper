"use client";

import { STACKS, type Stack, type TrendPoint } from "@/lib/types";

// Dependency-free SVG line chart: one line per stack, x = day, y = job count.
// Kept deliberately small so the scaffold has no charting-library install.

const COLORS: Record<Stack, string> = {
  SAP: "#2563eb",
  Salesforce: "#0ea5e9",
  MERN: "#16a34a",
  ".NET": "#9333ea",
  Java: "#ea580c",
};

const W = 760;
const H = 300;
const PAD = { top: 16, right: 16, bottom: 28, left: 36 };

export function TrendChart({ points }: { points: TrendPoint[] }) {
  if (points.length === 0) {
    return <p className="text-sm text-zinc-500">No trend data yet — needs a few days of scrapes.</p>;
  }

  const days = [...new Set(points.map((p) => p.day))].sort();
  const maxCount = Math.max(1, ...points.map((p) => p.job_count));

  const x = (i: number) =>
    PAD.left + (i / Math.max(1, days.length - 1)) * (W - PAD.left - PAD.right);
  const y = (v: number) =>
    H - PAD.bottom - (v / maxCount) * (H - PAD.top - PAD.bottom);

  const seriesByStack = STACKS.map((stack) => {
    const path = days
      .map((day, i) => {
        const pt = points.find((p) => p.day === day && p.stack === stack);
        return `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(pt?.job_count ?? 0).toFixed(1)}`;
      })
      .join(" ");
    return { stack, path };
  });

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Job count per stack over time">
        {/* y grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <g key={f}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(maxCount * f)}
              y2={y(maxCount * f)}
              className="stroke-zinc-200 dark:stroke-zinc-800"
            />
            <text x={4} y={y(maxCount * f) + 4} className="fill-zinc-400 text-[10px]">
              {Math.round(maxCount * f)}
            </text>
          </g>
        ))}
        {/* series */}
        {seriesByStack.map(({ stack, path }) => (
          <path key={stack} d={path} fill="none" stroke={COLORS[stack]} strokeWidth={2} />
        ))}
      </svg>
      <div className="mt-2 flex flex-wrap gap-4 text-xs">
        {STACKS.map((s) => (
          <span key={s} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS[s] }} />
            {s}
          </span>
        ))}
      </div>
    </div>
  );
}
