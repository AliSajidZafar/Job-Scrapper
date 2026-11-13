// Read one job's CURRENT applicant count from LinkedIn, live and on demand.
//
// The full job page (/jobs/view/<id>) is refused to data-center IPs (HTTP 999),
// but the guest job-posting endpoint is served and carries the same
// `num-applicants__caption`, so a single plain fetch — no browser — returns the
// live count. This is used only for user-initiated, one-job refreshes, never
// bulk automation (that's the nightly guest scraper's job).

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const GUEST_JOB = "https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/";

// "Over 200 applicants" -> 200 ; "Be among the first 25 applicants" -> 25 ;
// "47 applicants" -> 47. Returns null when no count is present.
export function parseApplicantCount(html: string): number | null {
  const caption = html.match(/num-applicants__caption[^>]*>\s*([^<]+)</i);
  const text = caption ? caption[1] : (html.match(/[\d,]+\s+applicants?/i)?.[0] ?? "");
  const n = text.replace(/,/g, "").match(/(\d+)/);
  return n ? parseInt(n[1], 10) : null;
}

export async function fetchLiveApplicantCount(linkedinJobId: string): Promise<number | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12_000);
  try {
    const res = await fetch(GUEST_JOB + encodeURIComponent(linkedinJobId), {
      headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9" },
      signal: ctrl.signal,
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`LinkedIn returned ${res.status}`);
    return parseApplicantCount(await res.text());
  } finally {
    clearTimeout(timer);
  }
}
