"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canManageTeam, isInternal, type Role } from "@/lib/roles";
import { revalidatePath } from "next/cache";
import { testQuoConnection, syncQuo } from "@/lib/quo";

export type ActionResult = { ok: boolean; error?: string; created?: number };

async function ceo() {
  const me = await auth();
  if (!me?.user || !canManageTeam(me.user.role as Role)) return null;
  return me;
}

export async function saveQuoConfig(formData: FormData): Promise<ActionResult> {
  const me = await ceo();
  if (!me) return { ok: false, error: "Not authorized" };

  const apiKey = String(formData.get("apiKey") || "").trim();
  const baseUrl = String(formData.get("baseUrl") || "").trim();
  const inboxNumber = String(formData.get("inboxNumber") || "").trim();
  if (!baseUrl) return { ok: false, error: "Base URL is required" };

  const existing = await prisma.quoConfig.findUnique({ where: { id: "singleton" } }).catch(() => null);
  const hadConfig = Boolean(existing?.apiKey && existing?.baseUrl);
  if (!hadConfig && !apiKey) return { ok: false, error: "API key is required" };

  const data: { baseUrl: string; inboxNumber: string | null; apiKey?: string } = {
    baseUrl,
    inboxNumber: inboxNumber || null,
  };
  if (apiKey) data.apiKey = apiKey;

  await prisma.quoConfig.upsert({
    where: { id: "singleton" },
    update: data,
    create: { id: "singleton", ...data, apiKey: apiKey || "" },
  });
  await prisma.auditLog.create({
    data: { actorId: me.user.id, action: hadConfig ? "quo.edit" : "quo.configure", target: baseUrl },
  });

  const result = await testQuoConnection();
  revalidatePath("/settings");
  return { ok: result.ok, error: result.ok ? undefined : result.error };
}

export async function testQuo(): Promise<ActionResult> {
  const me = await auth();
  if (!me?.user || !isInternal(me.user.role as Role)) return { ok: false, error: "Not authorized" };
  if (me.user.role !== "CEO" && me.user.role !== "OFFICE") return { ok: false, error: "Not authorized" };
  const result = await testQuoConnection();
  revalidatePath("/settings");
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}

export async function disconnectQuo(): Promise<ActionResult> {
  const me = await ceo();
  if (!me) return { ok: false, error: "Not authorized" };
  await prisma.quoConfig
    .update({ where: { id: "singleton" }, data: { apiKey: null, baseUrl: null, inboxNumber: null } })
    .catch(() => {});
  await prisma.auditLog.create({ data: { actorId: me.user.id, action: "quo.disconnect", target: "quo" } });
  revalidatePath("/settings");
  return { ok: true };
}

export async function syncQuoNow(): Promise<ActionResult> {
  const me = await ceo();
  if (!me) return { ok: false, error: "Not authorized" };
  try {
    const r = await syncQuo();
    revalidatePath("/settings");
    revalidatePath("/inbox");
    return { ok: true, created: r.created };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Sync failed" };
  }
}
