// Single-process protection for the loopback development adapter. This is not a
// distributed rate limiter or an AWS spending cap. No request contents are stored.
export const MCP_LIMITS = Object.freeze({
  globalConcurrent: 8, accountConcurrent: 2, burst: 30, refillPerSecond: 2,
  maxAccounts: 1024, idleMs: 60000, bodyBytes: 24000, bodyTimeoutMs: 5000,
});

type Lease = { release: () => void };
type Admission = ({ ok: true } & Lease) | { ok: false; status: 429 | 503; retryAfter: number };
type Bucket = { tokens: number; updated: number; active: number };

export function createMcpLimits(options: { [K in keyof typeof MCP_LIMITS]?: number } = {}, clock = Date.now) {
  const limits = { ...MCP_LIMITS, ...options };
  for (const value of Object.values(limits)) {
    if (!Number.isFinite(value) || value <= 0) throw new Error('MCP limits must be positive.');
  }
  const buckets = new Map<string, Bucket>();
  let active = 0;
  const lease = (release: () => void): Lease => {
    let released = false;
    return { release: () => { if (!released) { released = true; release(); } } };
  };
  return {
    enterRequest(): Admission {
      if (active >= limits.globalConcurrent) return { ok: false, status: 503, retryAfter: 1 };
      active++;
      return { ok: true, ...lease(() => { active--; }) };
    },
    enterAccount(actorId: string): Admission {
      const now = clock();
      // Only discard fully refilled, inactive entries. A smaller configured idle
      // window must never reset the remaining quota and allow a burst bypass.
      const expiry = Math.max(limits.idleMs, limits.burst / limits.refillPerSecond * 1000);
      for (const [key, bucket] of buckets) {
        if (!bucket.active && now - bucket.updated >= expiry) buckets.delete(key);
      }
      let bucket = buckets.get(actorId);
      if (!bucket) {
        if (buckets.size >= limits.maxAccounts) return { ok: false, status: 503, retryAfter: 1 };
        bucket = { tokens: limits.burst, updated: now, active: 0 };
        buckets.set(actorId, bucket);
      }
      const elapsed = Math.max(0, now - bucket.updated);
      bucket.tokens = Math.min(limits.burst, bucket.tokens + elapsed * limits.refillPerSecond / 1000);
      bucket.updated = Math.max(now, bucket.updated);
      if (bucket.active >= limits.accountConcurrent) return { ok: false, status: 429, retryAfter: 1 };
      if (bucket.tokens < 1) return { ok: false, status: 429, retryAfter: Math.max(1, Math.ceil((1 - bucket.tokens) / limits.refillPerSecond)) };
      bucket.tokens--;
      bucket.active++;
      return { ok: true, ...lease(() => { bucket.active--; }) };
    },
  };
}
export type McpLimits = ReturnType<typeof createMcpLimits>;
