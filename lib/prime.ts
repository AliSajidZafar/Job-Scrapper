import type { PrimeStack, StackSummary } from "./types";

// "Prime" = where the opportunity is right now, at two levels:
//
// 1. Prime STACKS: the top PRIME_TOP_N of the tracked stacks, ranked by an
//    opportunity score = open roles on LinkedIn ÷ average applicants per job.
//    More jobs and fewer applicants both push the score up, so #1 is the stack
//    with the most demand for the least competition. E.g. 1,000 roles at 40 avg
//    applicants scores 25 and outranks 800 roles at 120 avg applicants (6.7).
//    Both inputs are the numbers shown on the "Demand by stack" tiles, so the
//    ranking can be checked by eye.
// 2. Prime JOBS: a fresh role (from the latest scrape) with <= PRIME_MAX_APPLICANTS
//    applicants in one of those Prime stacks. These carry the flame badge
//    wherever a job is listed. <= 25 is LinkedIn's "be among the first 25
//    applicants" band, the genuinely early, low-competition window (finer counts
//    aren't exposed).
//
// Both are computed server-side in app/api/prime, so the panel and every badge
// come from one source and never disagree.
export const PRIME_TOP_N = 10;
export const PRIME_MAX_APPLICANTS = 25;

// Rank stacks by opportunity score, best first, and keep the top PRIME_TOP_N.
// A stack needs both an open-roles total and an applicant average to be scored.
// Ties go to the bigger market, then the lighter competition.
export function rankPrimeStacks(stacks: StackSummary[]): PrimeStack[] {
  const scored: PrimeStack[] = [];
  for (const s of stacks) {
    if (s.open_roles == null || s.open_roles <= 0 || s.avg_applicants == null) continue;
    scored.push({
      ...s,
      open_roles: s.open_roles,
      avg_applicants: s.avg_applicants,
      score: s.open_roles / Math.max(1, s.avg_applicants),
      rank: 0,
    });
  }
  scored.sort(
    (a, b) =>
      b.score - a.score ||
      b.open_roles - a.open_roles ||
      a.avg_applicants - b.avg_applicants ||
      a.stack.localeCompare(b.stack),
  );
  return scored.slice(0, PRIME_TOP_N).map((s, i) => ({ ...s, rank: i + 1 }));
}

// Score as shown on a card: one decimal while small, whole numbers once large.
export const formatScore = (n: number) => (n >= 100 ? Math.round(n).toLocaleString() : n.toFixed(1));
