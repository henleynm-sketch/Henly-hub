import type { Request, Response, NextFunction } from "express";
import { prisma } from "@repo/db";
import { ApiError } from "@repo/services";

// ---- Rate limiting -------------------------------------------------------
// Per-key in-memory token bucket. Reads and writes have separate budgets.
// TODO: move to Redis when Hub deploys multi-instance (process-local buckets
// do not coordinate across instances behind a load balancer).
type Bucket = { count: number; resetAt: number };
const READ_LIMIT = 60;
const WRITE_LIMIT = 20;
const WINDOW_MS = 60_000;
const readBuckets = new Map<string, Bucket>();
const writeBuckets = new Map<string, Bucket>();

export function rateLimit(req: Request, res: Response, next: NextFunction) {
  const apiKeyId = req.apiKey?.id;
  if (!apiKeyId) return next(); // auth middleware runs first; defensive only.

  const isRead = req.method.toUpperCase() === "GET";
  const map = isRead ? readBuckets : writeBuckets;
  const limit = isRead ? READ_LIMIT : WRITE_LIMIT;
  const now = Date.now();
  const bucket = map.get(apiKeyId);

  if (!bucket || now >= bucket.resetAt) {
    map.set(apiKeyId, { count: 1, resetAt: now + WINDOW_MS });
    return next();
  }
  if (bucket.count < limit) {
    bucket.count += 1;
    return next();
  }
  const retryAfterSec = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
  res.setHeader("Retry-After", String(retryAfterSec));
  next(new ApiError("rate_limited", "Rate limit exceeded"));
}

// ---- Idempotency ---------------------------------------------------------
// Optional Idempotency-Key support for write requests. The cached response
// (status + envelope body) is held in process memory for a 10-minute window.
// ApiCallLog separately records the key, so the audit trail survives a restart
// even though the dedup cache does not.
type Cached = { status: number; body: unknown; expiresAt: number };
const TTL_MS = 10 * 60_000;
const idemCache = new Map<string, Cached>();

function idemGet(id: string): Cached | null {
  const hit = idemCache.get(id);
  if (!hit) return null;
  if (Date.now() >= hit.expiresAt) {
    idemCache.delete(id);
    return null;
  }
  return hit;
}

export function idempotency(req: Request, res: Response, next: NextFunction) {
  if (req.method.toUpperCase() === "GET") return next();
  const key = req.header("Idempotency-Key")?.trim();
  if (!key || !req.apiKey) return next();

  const composite = `${req.apiKey.id}:${key}`;
  const cached = idemGet(composite);
  if (cached) {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Idempotency-Replayed", "true");
    return res.status(cached.status).json(cached.body);
  }

  // Capture the response body on the way out; only cache 2xx responses.
  const originalJson = res.json.bind(res);
  res.json = ((body: unknown) => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      idemCache.set(composite, { status: res.statusCode, body, expiresAt: Date.now() + TTL_MS });
    }
    return originalJson(body);
  }) as typeof res.json;
  next();
}

// ---- Call logging --------------------------------------------------------
// Fire-and-forget ApiCallLog write on response finish; never blocks the
// response and never throws. Runs for every request, including auth failures.
export function callLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  res.on("finish", () => {
    const path = (req.originalUrl || req.url).split("?")[0];
    prisma.apiCallLog
      .create({
        data: {
          apiKeyId: req.apiKey?.id ?? undefined,
          method: req.method.toUpperCase(),
          path,
          status: res.statusCode,
          scopeUsed: req.requiredScope ?? undefined,
          idempotencyKey: req.header("Idempotency-Key")?.trim() || undefined,
          durationMs: Date.now() - start,
        },
      })
      .catch(() => {});
  });
  next();
}
