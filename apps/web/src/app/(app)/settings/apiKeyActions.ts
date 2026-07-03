"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canManageTeam, type Role } from "@/lib/roles";
import { randomBytes, createHash } from "crypto";
import { revalidatePath } from "next/cache";
import { isScope } from "@/lib/api/scopes";

export type KeyActionResult = { ok: boolean; key?: string; error?: string };

function hashKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

async function ceo() {
  const me = await auth();
  if (!me?.user || !canManageTeam(me.user.role as Role)) return null;
  return me;
}

function sanitizeScopes(raw: string[]): string {
  return Array.from(new Set(raw.filter((s) => isScope(s)))).join(",");
}

// Create a new key. Returns the full key ONCE — it is never retrievable again.
export async function createApiKey(name: string, scopes: string[]): Promise<KeyActionResult> {
  const me = await ceo();
  if (!me) return { ok: false, error: "Not authorized" };
  const n = name.trim();
  if (!n) return { ok: false, error: "Name is required" };
  const scopeStr = sanitizeScopes(scopes);
  if (!scopeStr) return { ok: false, error: "Select at least one scope" };

  const key = randomBytes(32).toString("hex");
  const created = await prisma.apiKey.create({
    data: {
      name: n.slice(0, 100),
      hashPrefix: key.slice(0, 8),
      hash: hashKey(key),
      scopes: scopeStr,
      createdById: me.user.id,
    },
  });
  await prisma.apiKeyAudit.create({
    data: { apiKeyId: created.id, action: "created", actorId: me.user.id, detail: JSON.stringify({ scopes: scopeStr }) },
  });
  revalidatePath("/settings");
  return { ok: true, key };
}

// Rotate in place: the secret changes, so the OLD key stops matching (401)
// immediately, while activity/audit history stays on the same row.
export async function rotateApiKey(id: string): Promise<KeyActionResult> {
  const me = await ceo();
  if (!me) return { ok: false, error: "Not authorized" };
  const existing = await prisma.apiKey.findUnique({ where: { id } });
  if (!existing) return { ok: false, error: "Key not found" };
  if (existing.revokedAt) return { ok: false, error: "Key is revoked" };

  const key = randomBytes(32).toString("hex");
  await prisma.apiKey.update({ where: { id }, data: { hash: hashKey(key), hashPrefix: key.slice(0, 8) } });
  await prisma.apiKeyAudit.create({ data: { apiKeyId: id, action: "rotated", actorId: me.user.id } });
  revalidatePath("/settings");
  return { ok: true, key };
}

export async function revokeApiKey(id: string): Promise<KeyActionResult> {
  const me = await ceo();
  if (!me) return { ok: false, error: "Not authorized" };
  await prisma.apiKey.update({ where: { id }, data: { revokedAt: new Date() } }).catch(() => {});
  await prisma.apiKeyAudit.create({ data: { apiKeyId: id, action: "revoked", actorId: me.user.id } });
  revalidatePath("/settings");
  return { ok: true };
}

export async function updateApiKeyScopes(id: string, scopes: string[]): Promise<KeyActionResult> {
  const me = await ceo();
  if (!me) return { ok: false, error: "Not authorized" };
  const scopeStr = sanitizeScopes(scopes);
  if (!scopeStr) return { ok: false, error: "Select at least one scope" };
  await prisma.apiKey.update({ where: { id }, data: { scopes: scopeStr } });
  await prisma.apiKeyAudit.create({
    data: { apiKeyId: id, action: "scope_changed", actorId: me.user.id, detail: JSON.stringify({ scopes: scopeStr }) },
  });
  revalidatePath("/settings");
  return { ok: true };
}
