"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canManageTeam, isInternal, type Role } from "@/lib/roles";
import { revalidatePath } from "next/cache";
import { testQuoConnection, syncQuoMessages, syncQuoCalls, type Inbox } from "@/lib/quo";

export type SaveResult = { ok: boolean; error?: string; inboxes?: Inbox[] };
export type ActionResult = { ok: boolean; error?: string };
export type SyncResult = { ok: boolean; sms?: number; calls?: number; error?: string; partial?: string };

async function ceo() {
  const me = await auth();
  if (!me?.user || !canManageTeam(me.user.role as Role)) return null;
  return me;
}

// Step 1: write key + base, run a live test. On success returns the inboxes
// so the UI can show the inbox picker. An empty apiKey keeps the existing one.
export async function saveQuoCredentials(formData: FormData): Promise<SaveResult> {
  const me = await ceo();
  if (!me) return { ok: false, error: "Not authorized" };

  const apiKey = String(formData.get("apiKey") || "").trim();
  const apiBase = String(formData.get("apiBase") || "").trim() || null;

  const existing = await prisma.quoConfig.findUnique({ where: { id: "singleton" } }).catch(() => null);
  const hadKey = Boolean(existing?.apiKey);
  if (!hadKey && !apiKey) return { ok: false, error: "API key is required" };

  const data: { apiBase: string | null; apiKey?: string } = { apiBase };
  if (apiKey) data.apiKey = apiKey; // TODO: encrypt at rest once a helper exists

  await prisma.quoConfig.upsert({
    where: { id: "singleton" },
    update: data,
    create: { id: "singleton", ...data, apiKey: apiKey || "" },
  });
  await prisma.auditLog.create({
    data: { actorId: me.user.id, action: hadKey ? "quo.edit" : "quo.configure", target: "quo" },
  });

  const test = await testQuoConnection();
  revalidatePath("/settings");
  if (!test.ok) return { ok: false, error: test.error };
  return { ok: true, inboxes: test.inboxes ?? [] };
}

// Step 2: persist the chosen inbox.
export async function saveQuoInbox(inboxId: string, inboxName: string): Promise<ActionResult> {
  const me = await ceo();
  if (!me) return { ok: false, error: "Not authorized" };
  if (!inboxId) return { ok: false, error: "Pick an inbox" };
  await prisma.quoConfig.update({
    where: { id: "singleton" },
    data: { defaultInboxId: inboxId, defaultInboxName: inboxName || null },
  });
  revalidatePath("/settings");
  return { ok: true };
}

export async function testQuo(): Promise<ActionResult> {
  const me = await auth();
  if (!me?.user || !isInternal(me.user.role as Role)) return { ok: false, error: "Not authorized" };
  if (me.user.role !== "CEO" && me.user.role !== "OFFICE") return { ok: false, error: "Not authorized" };
  const test = await testQuoConnection();
  revalidatePath("/settings");
  return test.ok ? { ok: true } : { ok: false, error: test.error };
}

export async function disconnectQuo(): Promise<ActionResult> {
  const me = await ceo();
  if (!me) return { ok: false, error: "Not authorized" };
  await prisma.quoConfig
    .update({
      where: { id: "singleton" },
      data: { apiKey: null, defaultInboxId: null, defaultInboxName: null },
    })
    .catch(() => {});
  await prisma.auditLog.create({ data: { actorId: me.user.id, action: "quo.disconnect", target: "quo" } });
  revalidatePath("/settings");
  return { ok: true };
}

export async function syncQuoNow(): Promise<SyncResult> {
  const me = await ceo();
  if (!me) return { ok: false, error: "Not authorized" };
  const cfg = await prisma.quoConfig.findUnique({ where: { id: "singleton" } }).catch(() => null);
  if (!cfg?.defaultInboxId) return { ok: false, error: "No default inbox selected" };

  const [smsRes, callRes] = await Promise.allSettled([
    syncQuoMessages(cfg.defaultInboxId),
    syncQuoCalls(cfg.defaultInboxId),
  ]);
  revalidatePath("/settings");
  revalidatePath("/inbox");

  const sms = smsRes.status === "fulfilled" ? smsRes.value.created : undefined;
  const calls = callRes.status === "fulfilled" ? callRes.value.created : undefined;

  if (smsRes.status === "fulfilled" && callRes.status === "fulfilled") {
    return { ok: true, sms, calls };
  }
  if (smsRes.status === "fulfilled" && callRes.status === "rejected") {
    return { ok: true, sms, partial: `Calls sync failed: ${(callRes.reason as Error)?.message ?? "error"}` };
  }
  if (smsRes.status === "rejected" && callRes.status === "fulfilled") {
    return { ok: true, calls, partial: `SMS sync failed: ${(smsRes.reason as Error)?.message ?? "error"}` };
  }
  return { ok: false, error: (smsRes as PromiseRejectedResult).reason?.message ?? "Sync failed" };
}
