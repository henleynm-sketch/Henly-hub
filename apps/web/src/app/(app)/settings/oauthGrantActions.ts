"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export type GrantRow = {
  id: string;
  clientName: string;
  createdAt: string;
  lastUsedAt: string | null;
};

// Per-user grant management for the Hub-as-connector flow. Revocation is
// immediate — the bearer lookup checks revokedAt on every call.
export async function listMyGrants(): Promise<GrantRow[]> {
  const me = await auth();
  if (!me?.user) return [];
  try {
    return await listGrantsUnsafe(me.user.id);
  } catch {
    // OAuth tables not pushed yet — settings must render regardless.
    return [];
  }
}

async function listGrantsUnsafe(userId: string): Promise<GrantRow[]> {
  const rows = await prisma.oAuthToken.findMany({
    where: { userId, revokedAt: null, expiresAt: { gt: new Date(0) } },
    orderBy: { createdAt: "desc" },
    include: { client: { select: { name: true } } },
    take: 50,
  });
  return rows.map((t) => ({
    id: t.id,
    clientName: t.client.name,
    createdAt: t.createdAt.toISOString(),
    lastUsedAt: t.lastUsedAt?.toISOString() ?? null,
  }));
}

export async function revokeGrant(tokenId: string): Promise<{ ok: boolean; error?: string }> {
  const me = await auth();
  if (!me?.user) return { ok: false, error: "Not authorized" };
  const token = await prisma.oAuthToken.findUnique({ where: { id: tokenId } });
  if (!token || token.userId !== me.user.id) return { ok: false, error: "Grant not found" };
  await prisma.oAuthToken.update({
    where: { id: tokenId },
    data: { revokedAt: new Date(), refreshTokenHash: null },
  });
  await prisma.auditLog.create({
    data: { actorId: me.user.id, action: "oauth.revoke", target: tokenId },
  });
  revalidatePath("/settings");
  return { ok: true };
}
