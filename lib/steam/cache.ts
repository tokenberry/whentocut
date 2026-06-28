/**
 * Tiny in-memory TTL cache + a global rate limiter. Steam's public endpoints
 * (especially SteamSpy: 1 req/sec) will rate-limit or ban aggressive callers, so all
 * clients funnel through here. In production on the droplet this can be swapped for
 * Redis without touching call sites.
 */

interface Entry<T> {
  value: T;
  expiresAt: number;
}

const store = new Map<string, Entry<unknown>>();

export async function cached<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>,
): Promise<T> {
  const hit = store.get(key) as Entry<T> | undefined;
  if (hit && hit.expiresAt > Date.now()) return hit.value;
  const value = await loader();
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
  return value;
}

export function clearCache(): void {
  store.clear();
}

/** Serializes calls to a given lane and enforces a minimum gap between them. */
class RateLimiter {
  private last = 0;
  private chain: Promise<unknown> = Promise.resolve();
  constructor(private minGapMs: number) {}

  run<T>(task: () => Promise<T>): Promise<T> {
    const result = this.chain.then(async () => {
      const wait = this.minGapMs - (Date.now() - this.last);
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      this.last = Date.now();
      return task();
    });
    // Keep the lane alive even if a task rejects.
    this.chain = result.catch(() => undefined);
    return result;
  }
}

/** SteamSpy asks for <= 1 request/second. */
export const steamSpyLimiter = new RateLimiter(1100);
