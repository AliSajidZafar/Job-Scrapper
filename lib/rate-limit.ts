// Tiny in-memory rate limiter keyed by e.g. "login:<ip>". Good enough for a
// single server process (the app runs as one pm2 process on the VPS).

const buckets = new Map<string, { count: number; resetAt: number }>();

export function isLimited(key: string, max: number): boolean {
  const b = buckets.get(key);
  return !!b && b.resetAt > Date.now() && b.count >= max;
}

export function hit(key: string, windowMs: number): void {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) buckets.set(key, { count: 1, resetAt: now + windowMs });
  else b.count += 1;
}

export function clear(key: string): void {
  buckets.delete(key);
}

// Real visitor IP: Cloudflare's header first (the app sits behind a tunnel).
export function clientIp(req: Request): string {
  return (
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    "local"
  );
}
