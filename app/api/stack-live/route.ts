import { cached, CACHE_HEADERS } from "@/lib/cache";
import { fetchStackListings, fetchLiveApplicants, STACK_QUERY, delay } from "@/lib/linkedin";
import { STACKS, type ApiResult, type Stack, type StackLiveData, type StackLiveJob } from "@/lib/types";

// GET /api/stack-live?stack=<name> — the hottest LIVE roles for a Prime stack,
// straight from LinkedIn (not the tracked sample). We pull the freshest guest
// listings for the stack, read each one's CURRENT applicant count, and return
// the ones with the fewest applicants (the hottest, lowest-competition roles)
// first. Cached per stack for 10 minutes so repeat opens are instant and we
// don't re-hit LinkedIn on every click.
const TARGET = 20; // how many hot roles to show
const MAX_CANDIDATES = 28; // live listings to price (extra headroom for de-duping repeats)
const CONCURRENCY = 5; // parallel applicant-count fetches (kept modest to avoid 429)
const TTL_MS = 600_000; // 10 minutes

export async function GET(req: Request) {
  const stack = new URL(req.url).searchParams.get("stack") as Stack | null;
  if (!stack || !STACKS.includes(stack)) {
    return Response.json(
      { configured: true, data: null, error: "Unknown stack" } satisfies ApiResult<StackLiveData | null>,
      { status: 400 },
    );
  }

  try {
    const data = await cached<StackLiveData>(`live:${stack}`, TTL_MS, () => compute(stack));
    return Response.json({ configured: true, data } satisfies ApiResult<StackLiveData>, { headers: CACHE_HEADERS });
  } catch (e) {
    return Response.json({
      configured: true,
      data: null,
      error: e instanceof Error ? e.message : "Live fetch failed",
    } satisfies ApiResult<StackLiveData | null>);
  }
}

async function compute(stack: Stack): Promise<StackLiveData> {
  // 1. Freshest live listings for this stack (up to MAX_CANDIDATES).
  const { listings: raw, rateLimited } = await fetchStackListings(STACK_QUERY[stack], 3);
  const listings = raw.slice(0, MAX_CANDIDATES);
  if (!listings.length) {
    // A transient 429 must NOT be cached as "empty" for 10 minutes — throw so
    // the caller gets a retryable error. A genuinely empty result caches fine.
    if (rateLimited) throw new Error("LinkedIn is busy right now — please try again in a moment.");
    return { stack, as_of: new Date().toISOString(), jobs: [], scanned: 0, partial: true };
  }

  // 2. Price each one with its live applicant count, a few in parallel. A small
  //    random jitter spreads the detail fetches so they don't burst together
  //    (which LinkedIn rate-limits).
  const priced = await mapPool(listings, CONCURRENCY, async (l): Promise<StackLiveJob> => {
    try {
      await delay(Math.random() * 250);
      const { count, text } = await fetchLiveApplicants(l.linkedin_job_id);
      return { ...l, applicant_count: count, applicant_text: text };
    } catch {
      return { ...l, applicant_count: null, applicant_text: null };
    }
  });

  // 3. Hottest first: fewest applicants, unknown counts last; newer breaks ties.
  priced.sort((a, b) => {
    const av = a.applicant_count ?? Number.POSITIVE_INFINITY;
    const bv = b.applicant_count ?? Number.POSITIVE_INFINITY;
    if (av !== bv) return av - bv;
    return (b.posted ?? "").localeCompare(a.posted ?? "");
  });

  // 4. Collapse the same role listed under several job ids (LinkedIn reposts the
  //    same title across cities) so the drawer shows DISTINCT roles, not the
  //    same one five times. The sort above means we keep the hottest instance.
  const distinct: StackLiveJob[] = [];
  const seenRole = new Set<string>();
  for (const j of priced) {
    const key = `${j.title}|${j.company}`.toLowerCase().replace(/\s+/g, " ").trim();
    if (seenRole.has(key)) continue;
    seenRole.add(key);
    distinct.push(j);
  }

  const jobs = distinct.slice(0, TARGET);
  return {
    stack,
    as_of: new Date().toISOString(),
    jobs,
    scanned: listings.length,
    partial: jobs.length < TARGET,
  };
}

// Run `fn` over `items` with at most `limit` in flight at once, preserving order.
async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (let i = next++; i < items.length; i = next++) {
      out[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return out;
}
