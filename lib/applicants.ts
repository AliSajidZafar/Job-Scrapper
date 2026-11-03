// Applicant competition bands — a single source of truth so the whole app
// categorises applicant counts the same way (tiles, Opportunities, Competition,
// the stack drawer). The bands are MUTUALLY EXCLUSIVE: a job lands in exactly
// one, so a 20-applicant role and a 60-applicant role never share a bucket.
//
// LinkedIn shows "Be among the first 25 applicants" for anything under 25 (the
// scraper stores 25), so 25 means "fewer than 25" — the freshest band.

export type Band = "fresh" | "low" | "busy" | "crowded";

export interface BandDef {
  key: Band;
  name: string; // one-word label: Fresh / Low / Busy / Crowded
  range: string; // human range: "Under 25", "25–50", …
  blurb: string; // one-line meaning
}

// Ordered least → most competition. Boundaries are inclusive on the upper edge:
// fresh ≤25, low 26–50, busy 51–100, crowded 100+.
export const BANDS: BandDef[] = [
  { key: "fresh", name: "Fresh", range: "Under 25", blurb: "Be among the first — lowest competition" },
  { key: "low", name: "Low", range: "25–50", blurb: "Still early, worth a quick apply" },
  { key: "busy", name: "Busy", range: "50–100", blurb: "Filling up — apply soon" },
  { key: "crowded", name: "Crowded", range: "100+", blurb: "Highly contested" },
];

export function bandOf(n: number): Band {
  if (n <= 25) return "fresh";
  if (n <= 50) return "low";
  if (n <= 100) return "busy";
  return "crowded";
}

export const bandDef = (k: Band): BandDef => BANDS.find((b) => b.key === k)!;

// LinkedIn rounds anything below 25 to the "first 25" bucket.
export const applicantLabel = (n: number) => (n === 25 ? "<25" : n.toLocaleString());

// Badge + dot classes per band (token-based, so they adapt to dark mode).
export const BAND_BADGE: Record<Band, string> = {
  fresh: "bg-good/10 text-good",
  low: "bg-brand-soft text-brand",
  busy: "bg-warn/10 text-warn",
  crowded: "bg-crit/10 text-crit",
};

export const BAND_DOT: Record<Band, string> = {
  fresh: "bg-good",
  low: "bg-brand",
  busy: "bg-warn",
  crowded: "bg-crit",
};
