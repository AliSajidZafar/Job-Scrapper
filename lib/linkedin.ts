// Read one job's CURRENT applicant count from LinkedIn, live and on demand.
//
// The full job page (/jobs/view/<id>) is refused to data-center IPs (HTTP 999),
// but the guest job-posting endpoint is served and carries the same
// `num-applicants__caption` — verified to match LinkedIn's live page exactly
// (e.g. "195 applicants") — so a single plain fetch (no browser) returns the
// live figure. Used only for user-initiated, one-job refreshes, never bulk
// automation (that's the nightly guest scraper's job).

import type { Stack } from "./types";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const GUEST_JOB = "https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/";
const GUEST_SEARCH = "https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search";

// LinkedIn search keywords per stack — identical to the nightly scraper
// (scraper/config.js) so the live pull targets the same jobs the tiles count.
export const STACK_QUERY: Record<Stack, string> = {
  SAP: "SAP",
  Salesforce: "Salesforce",
  MERN: '"MERN"',
  ".NET": '".NET"',
  Java: '"Java" NOT "JavaScript"',
  ServiceNow: "ServiceNow",
  Workday: "Workday",
  "Data Engineering": '"Data Engineer"',
  DevOps: "DevOps",
  "AI / ML": '"Machine Learning"',
  Rust: '"Rust"',
  Elixir: '"Elixir"',
  "C++": '"C++"',
  Haskell: '"Haskell"',
  SRE: '"Site Reliability Engineer"',
  Embedded: '"Embedded"',
  GIS: '"GIS"',
  COBOL: '"COBOL"',
  CUDA: '"CUDA"',
  "Edge AI": '"Edge AI"',
};

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

// One fresh job card from LinkedIn's guest search listing (no applicant count —
// that lives on the job's detail page, fetched separately per job).
export interface LiveListing {
  linkedin_job_id: string;
  title: string;
  company: string;
  location: string | null;
  posted: string | null; // ISO date from the card's <time datetime="…">
}

// Minimal HTML-entity decode for the plain-text fields we read off the cards
// (&amp; &#39; &quot; and numeric entities) — no DOM parser dependency.
function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(?:39|x27);/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(parseInt(d, 10)))
    .replace(/&nbsp;/g, " ")
    .trim();
}

// Parse LinkedIn's guest search-listing HTML (a flat list of <li> job cards).
// The guest card markup is stable: the job id is in data-entity-urn, and the
// title/company/location/date sit in fixed base-search-card__* classes.
export function parseListings(html: string): LiveListing[] {
  const out: LiveListing[] = [];
  const cards = html.split(/<li[\s>]/).slice(1);
  for (const card of cards) {
    const id = card.match(/urn:li:jobPosting:(\d+)/);
    if (!id) continue;
    const title = card.match(/base-search-card__title[^>]*>\s*([^<]+?)\s*</i);
    const company =
      card.match(/base-search-card__subtitle[\s\S]*?<a[^>]*>\s*([^<]+?)\s*<\/a>/i) ||
      card.match(/base-search-card__subtitle[^>]*>\s*([^<]+?)\s*</i);
    const location = card.match(/job-search-card__location[^>]*>\s*([^<]+?)\s*</i);
    const date = card.match(/datetime="([^"]+)"/i);
    out.push({
      linkedin_job_id: id[1],
      title: title ? decodeEntities(title[1]) : "(untitled role)",
      company: company ? decodeEntities(company[1]) : "",
      location: location ? decodeEntities(location[1]) : null,
      posted: date ? date[1] : null,
    });
  }
  return out;
}

export const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

// One guest listing page. Returns the HTML, or null on a hard failure; signals
// a rate-limit (429) separately so the caller can back off and retry once.
async function fetchListingPage(query: string, start: number): Promise<{ html: string | null; rateLimited: boolean }> {
  const params = new URLSearchParams({
    keywords: query,
    location: "United States",
    f_TPR: "r86400", // posted in the last 24h
    f_WT: "2", // remote
    f_JT: "C,F", // contract + full-time
    sortBy: "DD", // most recent first
    start: String(start),
  });
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8_000);
  try {
    const res = await fetch(`${GUEST_SEARCH}?${params.toString()}`, {
      headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9" },
      signal: ctrl.signal,
      cache: "no-store",
    });
    if (res.status === 429) return { html: null, rateLimited: true };
    if (!res.ok) return { html: null, rateLimited: false };
    return { html: await res.text(), rateLimited: false };
  } catch {
    return { html: null, rateLimited: false };
  } finally {
    clearTimeout(timer);
  }
}

// Fetch up to `pages` pages of fresh guest listings for a stack's keywords,
// filtered to US · remote · contract+full-time · posted in the last 24h, newest
// first — the same filters as the nightly scraper. Deduped by job id. Paces the
// requests (a short gap between pages, one back-off retry on a 429) because
// LinkedIn's guest search rate-limits rapid bursts; stops on an empty page.
export async function fetchStackListings(query: string, pages = 3): Promise<LiveListing[]> {
  const seen = new Set<string>();
  const all: LiveListing[] = [];
  for (let p = 0; p < pages; p++) {
    if (p > 0) await delay(500); // gentle pacing between pages
    let { html, rateLimited } = await fetchListingPage(query, p * 10);
    if (rateLimited) {
      await delay(1_500); // backed off, try this page once more
      ({ html, rateLimited } = await fetchListingPage(query, p * 10));
    }
    if (!html) break; // rate-limited again, or a hard failure — keep what we have
    const got = parseListings(html);
    if (!got.length) break;
    for (const g of got) {
      if (!seen.has(g.linkedin_job_id)) {
        seen.add(g.linkedin_job_id);
        all.push(g);
      }
    }
  }
  return all;
}
