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
const MAX_CANDIDATES = 24; // DISTINCT listings to price for applicants
const CONCURRENCY = 4; // parallel applicant-count fetches (kept modest to avoid 429)
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
  // 1. Freshest live listings for this stack.
  const { listings: raw, rateLimited } = await fetchStackListings(STACK_QUERY[stack], 3);
  if (!raw.length) {
    // A transient 429 must NOT be cached as "empty" for 10 minutes — throw so
    // the caller gets a retryable error. A genuinely empty result caches fine.
    if (rateLimited) throw new Error("LinkedIn is busy right now — please try again in a moment.");
    return { stack, as_of: new Date().toISOString(), jobs: [], scanned: 0, partial: true };
  }

  // 2. Collapse the same role listed under several job ids (LinkedIn reposts the
  //    same title across cities) BEFORE pricing — so we don't spend an applicant
  //    fetch (and a slice of the rate-limit budget) on five copies of one role.
  //    Listings are newest-first, so the kept copy is the freshest.
  const distinct: typeof raw = [];
  const seenRole = new Set<string>();
  for (const l of raw) {
    const key = `${l.title}|${l.company}`.toLowerCase().replace(/\s+/g, " ").trim();
    if (seenRole.has(key)) continue;
    seenRole.add(key);
    distinct.push(l);
  }
  const candidates = distinct.slice(0, MAX_CANDIDATES);

  // 3. Price each distinct role with its live applicant count, a few in parallel
  //    with a retry so nearly every row gets LinkedIn's real figure (not a "—").
  const priced = await mapPool(candidates, CONCURRENCY, async (l): Promise<StackLiveJob> => {
    await delay(Math.random() * 250); // spread the burst a little
    const { count, text } = await fetchApplicantsResilient(l.linkedin_job_id);
    return { ...l, applicant_count: count, applicant_text: text };
  });

  // 4. Hottest first: fewest applicants, unknown counts last; newer breaks ties.
  priced.sort((a, b) => {
    const av = a.applicant_count ?? Number.POSITIVE_INFINITY;
    const bv = b.applicant_count ?? Number.POSITIVE_INFINITY;
    if (av !== bv) return av - bv;
    return (b.posted ?? "").localeCompare(a.posted ?? "");
  });

  const jobs = priced.slice(0, TARGET);
  return {
    stack,
    as_of: new Date().toISOString(),
    jobs,
    scanned: candidates.length,
    partial: jobs.length < TARGET,
  };
}

// One applicant-count read, with a single back-off retry on failure/429, so a
// transient rate-limit doesn't leave a row without LinkedIn's real figure.
async function fetchApplicantsResilient(id: string): Promise<{ count: number | null; text: string | null }> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await fetchLiveApplicants(id);
    } catch {
      if (attempt === 0) await delay(700 + Math.random() * 500);
    }
  }
  return { count: null, text: null };
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
