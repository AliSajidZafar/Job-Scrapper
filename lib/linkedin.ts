// Read one job's CURRENT applicant count from LinkedIn, live and on demand.
//
// The full job page (/jobs/view/<id>) is refused to data-center IPs (HTTP 999),
// but the guest job-posting endpoint is served and carries the same
// `num-applicants__caption` — verified to match LinkedIn's live page exactly
// (e.g. "195 applicants") — so a single plain fetch (no browser) returns the
// live figure. Used only for user-initiated, one-job refreshes, never bulk
// automation (that's the nightly guest scraper's job).

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const GUEST_JOB = "https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/";

export interface LiveApplicants {
  // The number for sorting/competition bands. "Over 200 applicants" -> 200,
  // "Be among the first 25 applicants" -> 25, "47 applicants" -> 47.
  count: number | null;
  // LinkedIn's exact wording, so the dashboard can show precisely what LinkedIn
  // shows (including the "Over …" / "Be among the first …" qualifiers).
  text: string | null;
}

export function parseApplicants(html: string): LiveApplicants {
  const m = html.match(/num-applicants__caption[^>]*>\s*([^<]+?)\s*</i);
  const text = m ? m[1].replace(/\s+/g, " ").trim() : null;
  const digits = text ? text.replace(/,/g, "").match(/(\d+)/) : null;
  return { count: digits ? parseInt(digits[1], 10) : null, text };
}

export async function fetchLiveApplicants(linkedinJobId: string): Promise<LiveApplicants> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12_000);
  try {
    const res = await fetch(GUEST_JOB + encodeURIComponent(linkedinJobId), {
      headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9" },
      signal: ctrl.signal,
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`LinkedIn returned ${res.status}`);
    return parseApplicants(await res.text());
  } finally {
    clearTimeout(timer);
  }
}
