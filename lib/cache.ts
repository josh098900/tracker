/**
 * Cache wrapper.
 *
 * In production we use Vercel KV (Upstash Redis under the hood) so that
 * cache hits work across cold starts and across the SSE / dashboard
 * routes. Locally — when `KV_REST_API_URL` is unset — we fall back to
 * an in-memory map so dev still works without spinning up Upstash.
 *
 * Cache keys (see docs/ARCHITECTURE.md):
 *   `analysis:${owner}/${repo}@${sha}`   TTL 7d
 *   `repo_meta:${owner}/${repo}`         TTL 5m
 *   `latest_sha:${owner}/${repo}`        TTL 2m
 *   `ratelimit:${ip}`                    TTL 1h
 */

type CacheValue = unknown;

export interface CacheClient {
  get<T extends CacheValue = CacheValue>(key: string): Promise<T | null>;
  set(key: string, value: CacheValue, ttlSeconds: number): Promise<void>;
  incr(key: string): Promise<number>;
  expire(key: string, ttlSeconds: number): Promise<void>;
  /** Drop all entries — only used by tests. */
  reset(): Promise<void>;
}

type Entry = { value: CacheValue; expiresAt: number };

class MemoryCache implements CacheClient {
  private store = new Map<string, Entry>();

  private now() {
    return Date.now();
  }

  private gc(key: string): Entry | undefined {
    const e = this.store.get(key);
    if (!e) return undefined;
    if (e.expiresAt > 0 && e.expiresAt < this.now()) {
      this.store.delete(key);
      return undefined;
    }
    return e;
  }

  async get<T extends CacheValue = CacheValue>(key: string): Promise<T | null> {
    const e = this.gc(key);
    return e ? (e.value as T) : null;
  }

  async set(key: string, value: CacheValue, ttlSeconds: number): Promise<void> {
    this.store.set(key, {
      value,
      expiresAt: ttlSeconds > 0 ? this.now() + ttlSeconds * 1000 : 0,
    });
  }

  async incr(key: string): Promise<number> {
    const existing = this.gc(key);
    const current = typeof existing?.value === "number" ? existing.value : 0;
    const next = current + 1;
    this.store.set(key, {
      value: next,
      expiresAt: existing?.expiresAt ?? 0,
    });
    return next;
  }

  async expire(key: string, ttlSeconds: number): Promise<void> {
    const e = this.store.get(key);
    if (!e) return;
    e.expiresAt = ttlSeconds > 0 ? this.now() + ttlSeconds * 1000 : 0;
  }

  async reset(): Promise<void> {
    this.store.clear();
  }
}

class VercelKvCache implements CacheClient {
  private kv: typeof import("@vercel/kv").kv | null = null;

  private async client() {
    if (!this.kv) {
      const mod = await import("@vercel/kv");
      this.kv = mod.kv;
    }
    return this.kv;
  }

  async get<T extends CacheValue = CacheValue>(key: string): Promise<T | null> {
    const kv = await this.client();
    return (await kv.get<T>(key)) ?? null;
  }

  async set(key: string, value: CacheValue, ttlSeconds: number): Promise<void> {
    const kv = await this.client();
    await kv.set(key, value, { ex: ttlSeconds });
  }

  async incr(key: string): Promise<number> {
    const kv = await this.client();
    return kv.incr(key);
  }

  async expire(key: string, ttlSeconds: number): Promise<void> {
    const kv = await this.client();
    await kv.expire(key, ttlSeconds);
  }

  async reset(): Promise<void> {
    throw new Error("reset() is not supported on VercelKvCache");
  }
}

let singleton: CacheClient | null = null;

/**
 * Returns the shared cache client. Picks Vercel KV when configured,
 * else an in-memory cache (dev / test).
 */
export function getCache(): CacheClient {
  if (singleton) return singleton;
  const hasKv = !!process.env.KV_REST_API_URL && !!process.env.KV_REST_API_TOKEN;
  singleton = hasKv ? new VercelKvCache() : new MemoryCache();
  return singleton;
}

/** Test helper — replace the cache with a fresh in-memory instance. */
export function _resetCacheForTests(): void {
  singleton = new MemoryCache();
}
