"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canManageTeam, isInternal, type Role } from "@/lib/roles";
import { revalidatePath } from "next/cache";
import { testM365Connection, syncInbox } from "@/lib/microsoft365";

export type ActionResult = { ok: boolean; error?: string; created?: number; tested?: boolean };

async function ceo() {
  const me = await auth();
  if (!me?.user || !canManageTeam(me.user.role as Role)) return null;
  return me;
}

// Configure or edit: CEO only. Writes the singleton, then runs a live test so
// the user lands on the real connection state. clientSecret is left untouched
// when the field comes back empty (Edit mode "keep existing secret").
export async function saveM365Config(formData: FormData): Promise<ActionResult> {
  const me = await ceo();
  if (!me) return { ok: false, error: "Not authorized" };

  const tenantId = String(formData.get("tenantId") || "").trim();
  const clientId = String(formData.get("clientId") || "").trim();
  const clientSecret = String(formData.get("clientSecret") || "").trim();
  const mailbox = String(formData.get("mailbox") || "").trim();
  if (!tenantId || !clientId || !mailbox) {
    return { ok: false, error: "Tenant ID, client ID and mailbox are required" };
  }

  const existing = await prisma.m365Config.findUnique({ where: { id: "singleton" } }).catch(() => null);
  const hadConfig = Boolean(existing?.tenantId && existing?.clientId && existing?.clientSecret && existing?.mailbox);
  if (!hadConfig && !clientSecret) {
    return { ok: false, error: "Client secret is required" };
  }

  const data: {
    tenantId: string;
    clientId: string;
    mailbox: string;
    clientSecret?: string;
  } = { tenantId, clientId, mailbox };
  if (clientSecret) data.clientSecret = clientSecret;

  await prisma.m365Config.upsert({
    where: { id: "singleton" },
    update: data,
    create: { id: "singleton", ...data, clientSecret: clientSecret || "" },
  });

  await prisma.auditLog.create({
    data: { actorId: me.user.id, action: hadConfig ? "m365.edit" : "m365.configure", target: mailbox },
  });

  const result = await testM365Connection();
  revalidatePath("/settings");
  revalidatePath("/inbox");
  return { ok: result.ok, error: result.ok ? undefined : result.error, tested: true };
}

// Test connection: CEO or Office (any internal admin who can see the card).
export async function testM365(): Promise<ActionResult> {
  const me = await auth();
  if (!me?.user || !isInternal(me.user.role as Role)) return { ok: false, error: "Not authorized" };
  if (me.user.role !== "CEO" && me.user.role !== "OFFICE") return { ok: false, error: "Not authorized" };
  const result = await testM365Connection();
  revalidatePath("/settings");
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}

// Disconnect: CEO only. Clears credentials, keeps lastSync* for history.
export async function disconnectM365(): Promise<ActionResult> {
  const me = await ceo();
  if (!me) return { ok: false, error: "Not authorized" };
  await prisma.m365Config
    .update({
      where: { id: "singleton" },
      data: { tenantId: null, clientId: null, clientSecret: null, mailbox: null },
    })
    .catch(() => {});
  await prisma.auditLog.create({
    data: { actorId: me.user.id, action: "m365.disconnect", target: "microsoft 365" },
  });
  revalidatePath("/settings");
  return { ok: true };
}

// Sync inbox now: CEO only. No audit (too noisy).
export async function syncM365(): Promise<ActionResult> {
  const me = await ceo();
  if (!me) return { ok: false, error: "Not authorized" };
  try {
    const result = await syncInbox();
    revalidatePath("/settings");
    revalidatePath("/inbox");
    return { ok: true, created: result.created };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Sync failed" };
  }
}
