// Tiny in-process cache for the read-only dashboard APIs.
//
// The data behind the dashboard only changes once a day (the nightly scrape) or
// when someone refreshes a single job, yet every page load recomputed it from
// scratch — including the expensive applicant-velocity view. pm2 runs one
// long-lived Node process, so caching each computed response here means repeat
// loads (and concurrent viewers) skip the database entirely until the entry
// expires. A single-job refresh calls clearCache() so nothing goes stale.
type Entry = { value: unknown; expires: number };
const store = new Map<string, Entry>();

export async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = store.get(key);
  if (hit && hit.expires > now) return hit.value as T;
  const value = await fn();
  store.set(key, { value, expires: now + ttlMs });
  return value;
}

// Drop everything (called after a live refresh writes a new applicant count, so
// the next load recomputes the tiles and lists against the updated row).
export function clearCache(): void {
  store.clear();
}

// Standard caching headers for a cacheable GET: fresh in the browser for a
// minute, and servable stale while revalidating for a few more.
export const CACHE_HEADERS = {
  "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
} as const;
