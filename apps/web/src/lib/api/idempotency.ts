import "server-only";

// Optional Idempotency-Key support for write requests.
//
// The cached response (status + envelope body) is held in process memory for a
// 10-minute window — the same single-instance caveat as the rate limiter. The
// ApiCallLog row separately records the idempotency key for the activity feed,
// so the audit trail survives a restart even though the dedup cache does not.
// TODO: move the response cache to Redis for multi-instance correctness.
type Cached = { status: number; body: unknown; expiresAt: number };

const TTL_MS = 10 * 60_000;
const cache = new Map<string, Cached>();

function composite(apiKeyId: string, key: string): string {
  return `${apiKeyId}:${key}`;
}

export function readIdempotencyKey(req: Request): string | null {
  const k = req.headers.get("Idempotency-Key");
  return k && k.trim() ? k.trim() : null;
}

export function getIdempotent(apiKeyId: string, key: string): Cached | null {
  const id = composite(apiKeyId, key);
  const hit = cache.get(id);
  if (!hit) return null;
  if (Date.now() >= hit.expiresAt) {
    cache.delete(id);
    return null;
  }
  return hit;
}

export function setIdempotent(apiKeyId: string, key: string, status: number, body: unknown): void {
  cache.set(composite(apiKeyId, key), { status, body, expiresAt: Date.now() + TTL_MS });
}
