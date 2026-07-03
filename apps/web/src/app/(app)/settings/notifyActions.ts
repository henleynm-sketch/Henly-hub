"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canManageTeam, type Role } from "@/lib/roles";
import { revalidatePath } from "next/cache";
import { emitNotification, processQueue } from "@/lib/notifications/dispatch";

export type NotifyActionResult = { ok: boolean; error?: string; attempted?: number };

async function ceo() {
  const me = await auth();
  if (!me?.user || !canManageTeam(me.user.role as Role)) return null;
  return me;
}

// The gate-verification send: one real email from hello@ to the signed-in CEO.
export async function sendTestNotification(): Promise<NotifyActionResult> {
  const me = await ceo();
  if (!me) return { ok: false, error: "Not authorized" };
  await emitNotification({ eventType: "TEST_EMAIL", actorId: me.user.id });
  revalidatePath("/settings");
  return { ok: true };
}

export async function flushNotificationQueue(): Promise<NotifyActionResult> {
  const me = await ceo();
  if (!me) return { ok: false, error: "Not authorized" };
  const r = await processQueue();
  revalidatePath("/settings");
  return { ok: true, attempted: r.attempted };
}

export async function setNotifyMaster(on: boolean): Promise<NotifyActionResult> {
  const me = await ceo();
  if (!me) return { ok: false, error: "Not authorized" };
  await prisma.setting.upsert({
    where: { key: "notify.enabled" },
    update: { value: on ? "on" : "off" },
    create: { key: "notify.enabled", value: on ? "on" : "off" },
  });
  await prisma.auditLog.create({
    data: { actorId: me.user.id, action: on ? "notify.enable" : "notify.kill_switch", target: "email" },
  });
  revalidatePath("/settings");
  return { ok: true };
}
