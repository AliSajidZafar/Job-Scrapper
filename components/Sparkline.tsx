"use client";

import { useId } from "react";

// Tiny dependency-free sparkline: a 2px line over a soft vertical gradient, with
// a dot on the latest point. No axes or labels — it shows direction at a glance
// and inherits its entity color (brand for headline, the stack color per tile).
// `preserveAspectRatio="none"` stretches it to the box; the stroke stays crisp
// via non-scaling-stroke. Fewer than two points renders nothing (nothing to show).
export function Sparkline({
  values,
  color,
  className = "",
  strokeWidth = 1.75,
}: {
  values: number[];
  color: string;
  className?: string;
  strokeWidth?: number;
}) {
  const id = useId().replace(/:/g, "");
  if (values.length < 2) return null;

  const W = 100;
  const H = 32;
  const PAD = 3;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const x = (i: number) => PAD + (i / (values.length - 1)) * (W - 2 * PAD);
  const y = (v: number) => PAD + (1 - (v - min) / span) * (H - 2 * PAD);

  const line = values.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  const area = `${x(0)},${H} ${line} ${x(values.length - 1)},${H}`;
  const lastX = x(values.length - 1);
  const lastY = y(values[values.length - 1]);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className={className}
      aria-hidden
    >
      <defs>
        <linearGradient id={`spark-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.22} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#spark-${id})`} />
      <polyline
        points={line}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={lastX} cy={lastY} r={2.4} fill={color} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
