import "server-only";
import { NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "crypto";
import type { ApiKey } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fail } from "./errors";
import { type Scope, parseScopes, hasScope } from "./scopes";

// Keys are never stored in the clear — we store and look up sha256(key).
export function hashKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

function readBearer(req: Request): string | null {
  // Our API uses a standard "Authorization: Bearer <key>" header. (Quo's
  // connector uses a bare key by their server's convention — unrelated.)
  const header = req.headers.get("authorization");
  if (!header) return null;
  return header.startsWith("Bearer ") ? header.slice(7).trim() : null;
}

export type AuthOk = { apiKey: ApiKey; scopes: Scope[] };

// Resolve the bearer key and enforce the required scope.
// Returns the loaded ApiKey (+ parsed scopes) on success, or a ready-to-return
// NextResponse (401/403) on failure. lastUsedAt is touched fire-and-forget.
export async function requireScope(
  req: Request,
  required: Scope
): Promise<AuthOk | NextResponse> {
  const presented = readBearer(req);
  if (!presented) return fail("unauthorized", "Missing bearer token");

  const hash = hashKey(presented);
  const apiKey = await prisma.apiKey.findUnique({ where: { hash } }).catch(() => null);
  if (!apiKey) return fail("unauthorized", "Invalid API key");

  // Constant-time confirm on the (equal-length hex) hashes.
  const a = Buffer.from(hash);
  const b = Buffer.from(apiKey.hash);
  if (a.length !== b.length || !timingSafeEqual(new Uint8Array(a), new Uint8Array(b))) {
    return fail("unauthorized", "Invalid API key");
  }

  if (apiKey.revokedAt) return fail("unauthorized", "API key has been revoked");

  const scopes = parseScopes(apiKey.scopes);
  if (!hasScope(scopes, required)) {
    return fail("forbidden", `This key is missing the required scope: ${required}`);
  }

  prisma.apiKey
    .update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {});

  return { apiKey, scopes };
}

export function isAuthFailure(r: AuthOk | NextResponse): r is NextResponse {
  return r instanceof NextResponse;
}
