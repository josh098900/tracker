import { getCache } from "./cache";

/**
 * IP-keyed sliding window-ish rate limiter.
 *
 * The strategy is a fixed 1-hour bucket: we `INCR` a per-IP counter and
 * set a 1-hour TTL the first time the bucket is created. After 10
 * cache-miss analyses in a wall-clock hour the bucket trips, and the
 * caller returns 429.
 *
 * `KV.incr` is atomic, so this is safe even under concurrent requests.
 *
 * Cached analyses don't count — the route only calls `consume()` after
 * deciding the request is a cache miss (see docs/ARCHITECTURE.md).
 */

const WINDOW_SECONDS = 60 * 60;
const DEFAULT_LIMIT = 10;

export type RateLimitVerdict = {
  allowed: boolean;
  remaining: number;
  limit: number;
  /** Seconds until the bucket resets — best-effort. */
  retryAfter: number;
};

export type RateLimitOptions = {
  /** Override the per-window quota. Defaults to 10/hour. */
  limit?: number;
  /** Override the bucket TTL. Defaults to one hour. */
  windowSeconds?: number;
};

const keyFor = (ip: string) => `ratelimit:${ip}`;

/**
 * Increment the bucket for `ip` and return whether the request is
 * within budget. Use in the request path *before* doing real work.
 */
export async function consumeRateLimit(
  ip: string,
  options: RateLimitOptions = {},
): Promise<RateLimitVerdict> {
  const limit = options.limit ?? DEFAULT_LIMIT;
  const windowSeconds = options.windowSeconds ?? WINDOW_SECONDS;
  const cache = getCache();
  const key = keyFor(ip);

  const count = await cache.incr(key);
  // First hit in the bucket — set its TTL.
  if (count === 1) {
    await cache.expire(key, windowSeconds);
  }

  const allowed = count <= limit;
  return {
    allowed,
    limit,
    remaining: Math.max(0, limit - count),
    // We don't track per-key TTL precisely without an extra round-trip;
    // returning the full window is a safe upper bound for clients.
    retryAfter: allowed ? 0 : windowSeconds,
  };
}

/**
 * Best-effort IP extraction from a Next.js request headers object.
 * Vercel sets `x-forwarded-for`; falls back to `x-real-ip`. Defaults to
 * a sentinel string so the limiter still applies even if no IP is
 * forwarded (better than allowing unbounded traffic).
 */
export function ipFromHeaders(headers: Headers): string {
  const xff = headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const real = headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}
