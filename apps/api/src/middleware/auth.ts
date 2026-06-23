import type { Request, Response, NextFunction } from "express";
import { createHash, timingSafeEqual } from "node:crypto";
import { prisma } from "@repo/db";
import { type Scope, parseScopes, hasScope, UnauthorizedError, ForbiddenError } from "@repo/services";

// Keys are never stored in the clear — we store and look up sha256(key).
export function hashKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

function readBearer(req: Request): string | null {
  const header = req.header("authorization");
  if (!header) return null;
  return header.startsWith("Bearer ") ? header.slice(7).trim() : null;
}

// Express middleware: resolve the bearer key and enforce the required scope.
// Attaches req.apiKey + req.scopes on success; throws ApiError (→ errorHandler)
// on failure. lastUsedAt is touched fire-and-forget. req.requiredScope is set
// immediately so the call logger records the scope even on failures.
export function requireScope(required: Scope) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    req.requiredScope = required;
    try {
      const presented = readBearer(req);
      if (!presented) throw new UnauthorizedError("Missing bearer token");

      const hash = hashKey(presented);
      const apiKey = await prisma.apiKey.findUnique({ where: { hash } }).catch(() => null);
      if (!apiKey) throw new UnauthorizedError("Invalid API key");

      // Constant-time confirm on the (equal-length hex) hashes.
      const a = Buffer.from(hash);
      const b = Buffer.from(apiKey.hash);
      if (a.length !== b.length || !timingSafeEqual(new Uint8Array(a), new Uint8Array(b))) {
        throw new UnauthorizedError("Invalid API key");
      }

      if (apiKey.revokedAt) throw new UnauthorizedError("API key has been revoked");

      const scopes = parseScopes(apiKey.scopes);
      if (!hasScope(scopes, required)) {
        throw new ForbiddenError(`This key is missing the required scope: ${required}`);
      }

      prisma.apiKey
        .update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } })
        .catch(() => {});

      req.apiKey = apiKey;
      req.scopes = scopes;
      next();
    } catch (err) {
      next(err);
    }
  };
}
