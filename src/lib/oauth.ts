import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/roles";

/**
 * OAuth 2.1 primitives for Hub-as-MCP-connector. Public clients + PKCE S256
 * only; token values stored as sha256 hashes; revocation immediate.
 */

export const OAUTH_SCOPES = ["hub:tools"] as const;
export const ACCESS_TTL_MS = 60 * 60 * 1000; // 1h
export const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30d
export const CODE_TTL_MS = 10 * 60 * 1000; // 10m

export const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");
export const newToken = (prefix: string) => `${prefix}_${randomBytes(32).toString("base64url")}`;

export function verifyPkceS256(verifier: string, challenge: string): boolean {
  if (!verifier || verifier.length < 43 || verifier.length > 128) return false;
  const computed = createHash("sha256").update(verifier).digest("base64url");
  const a = Buffer.from(computed);
  const b = Buffer.from(challenge);
  return a.length === b.length && timingSafeEqual(a, b);
}

export type BearerUser = {
  userId: string;
  userName: string;
  role: Role;
  clientId: string | null; // CRM client link for CLIENT role
  tokenId: string;
  scopes: string[];
};

/** Resolve a Bearer access token to its Hub user. Null = invalid/revoked/expired. */
export async function getUserForBearer(authorization: string | null): Promise<BearerUser | null> {
  const m = authorization?.match(/^Bearer (.+)$/);
  if (!m) return null;
  const token = await prisma.oAuthToken.findUnique({
    where: { accessTokenHash: sha256(m[1]) },
  });
  if (!token || token.revokedAt || token.expiresAt < new Date()) return null;
  const user = await prisma.user.findUnique({ where: { id: token.userId } });
  if (!user || !user.active) return null;
  await prisma.oAuthToken
    .update({ where: { id: token.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {});
  return {
    userId: user.id,
    userName: user.name,
    role: user.role as Role,
    clientId: user.clientId,
    tokenId: token.id,
    scopes: token.scopes.split(" ").filter(Boolean),
  };
}

export function parseRedirectUris(json: string): string[] {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.filter((u): u is string => typeof u === "string") : [];
  } catch {
    return [];
  }
}

const HTTP_LOCALHOST = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//;

/** OAuth 2.1: exact-match redirect URIs; https required except localhost. */
export function isAcceptableRedirectUri(uri: string): boolean {
  try {
    const u = new URL(uri);
    if (u.protocol === "https:") return true;
    return HTTP_LOCALHOST.test(uri);
  } catch {
    return false;
  }
}
