// Brand mark: the uploaded Mavericks logo (public/Logo.jpg). It has a white
// background, so it's shown in a rounded white tile with a hairline ring — reads
// as a crisp app-icon in both light and dark mode.
export function Logo({ className }: { className?: string }) {
  return (
    <span
      className={`inline-grid place-items-center overflow-hidden rounded-lg bg-white ring-1 ring-line ${className ?? ""}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/Logo.jpg" alt="Mavericks" className="h-full w-full object-contain" />
    </span>
  );
}
