// Mavericks "M" monogram — angular, drawn in the brand teal (currentColor).
// Recreated as SVG so it stays crisp at any size and themes cleanly.
export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      className={className}
      role="img"
      aria-label="Mavericks"
      fill="currentColor"
    >
      {/* Bold M body */}
      <path d="M6 41 V9 H15 L24 27 L33 9 H42 V41 H33 V22 L26.5 35 H21.5 L15 22 V41 Z" />
      {/* Thin left chevron, echoing the logo's overlapping triangle */}
      <path
        d="M10 40 L19 13 L21.6 18 L13.4 40 Z"
        fillOpacity="0.55"
      />
    </svg>
  );
}
