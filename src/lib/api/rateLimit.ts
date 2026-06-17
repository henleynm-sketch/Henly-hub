import "server-only";

// Per-key in-memory token bucket. Reads and writes have separate budgets.
// TODO: Move to Redis when Hub deploys multi-instance — process-local buckets
// do not coordinate across instances behind a load balancer.
type Bucket = { count: number; resetAt: number };

const READ_LIMIT = 60; // GET requests per window
const WRITE_LIMIT = 20; // POST/PATCH/DELETE per window
const WINDOW_MS = 60_000;

const readBuckets = new Map<string, Bucket>();
const writeBuckets = new Map<string, Bucket>();

export type RateKind = "read" | "write";
export type RateResult = { ok: true } | { ok: false; retryAfterSec: number };

export function rateKindForMethod(method: string): RateKind {
  return method.toUpperCase() === "GET" ? "read" : "write";
}

export function rateLimit(apiKeyId: string, kind: RateKind): RateResult {
  const map = kind === "read" ? readBuckets : writeBuckets;
  const limit = kind === "read" ? READ_LIMIT : WRITE_LIMIT;
  const now = Date.now();
  const bucket = map.get(apiKeyId);

  if (!bucket || now >= bucket.resetAt) {
    map.set(apiKeyId, { count: 1, resetAt: now + WINDOW_MS });
    return { ok: true };
  }
  if (bucket.count < limit) {
    bucket.count += 1;
    return { ok: true };
  }
  return { ok: false, retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) };
}
