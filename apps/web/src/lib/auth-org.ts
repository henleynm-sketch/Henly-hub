import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Tenant-READY, not multi-tenant: exactly one Organization row owns all
 * users. Idempotent seed from the existing org Settings + user backfill.
 * NO query scoping anywhere — that migration is a future brief.
 */

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "org";
}

export async function ensureOrganization(): Promise<{ id: string; name: string }> {
  const existing = await prisma.organization.findFirst({ orderBy: { createdAt: "asc" } });
  if (existing) {
    await backfillUsers(existing.id);
    return { id: existing.id, name: existing.name };
  }
  const nameSetting = await prisma.setting
    .findUnique({ where: { key: "org.name" } })
    .catch(() => null);
  const name = nameSetting?.value || "Henley Contracting Ltd.";
  const org = await prisma.organization.create({
    data: { name, slug: slugify(name) },
  });
  await backfillUsers(org.id);
  return { id: org.id, name: org.name };
}

async function backfillUsers(organizationId: string): Promise<void> {
  await prisma.user.updateMany({
    where: { organizationId: null },
    data: { organizationId },
  });
}

// Web Crypto token helpers (edge-bundling lesson: never node:crypto in any
// chain that instrumentation or middleware might pull in).
export function newRawToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function hashToken(raw: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function passwordPolicyError(pw: string): string | null {
  if (pw.length < 10) return "Password must be at least 10 characters.";
  return null; // no other theater
}
