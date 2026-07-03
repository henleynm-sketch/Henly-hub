"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canManageTeam, type Role } from "@/lib/roles";
import { revalidatePath } from "next/cache";

export type AssistantActionResult = { ok: boolean; error?: string };

async function ceo() {
  const me = await auth();
  if (!me?.user || !canManageTeam(me.user.role as Role)) return null;
  return me;
}

export async function saveAnthropicConfig(formData: FormData): Promise<AssistantActionResult> {
  const me = await ceo();
  if (!me) return { ok: false, error: "Not authorized" };

  const apiKey = String(formData.get("apiKey") || "").trim();
  const model = String(formData.get("model") || "").trim() || "claude-sonnet-5";

  const existing = await prisma.anthropicConfig.findUnique({ where: { id: "singleton" } }).catch(() => null);
  if (!existing?.apiKey && !apiKey) return { ok: false, error: "API key is required" };

  const data: { model: string; apiKey?: string; enabled: boolean } = { model, enabled: true };
  if (apiKey) data.apiKey = apiKey;

  await prisma.anthropicConfig.upsert({
    where: { id: "singleton" },
    update: data,
    create: { id: "singleton", apiKey: apiKey || null, model, enabled: true },
  });
  await prisma.auditLog.create({
    data: { actorId: me.user.id, action: existing?.apiKey ? "assistant.config.edit" : "assistant.config.enable", target: model },
  });
  revalidatePath("/settings");
  return { ok: true };
}

// Kill switch: hides the launcher app-wide and blocks the route.
export async function setAssistantEnabled(enabled: boolean): Promise<AssistantActionResult> {
  const me = await ceo();
  if (!me) return { ok: false, error: "Not authorized" };
  await prisma.anthropicConfig
    .update({ where: { id: "singleton" }, data: { enabled } })
    .catch(() => {});
  await prisma.auditLog.create({
    data: { actorId: me.user.id, action: enabled ? "assistant.enable" : "assistant.disable", target: "claude" },
  });
  revalidatePath("/settings");
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function disconnectAssistant(): Promise<AssistantActionResult> {
  const me = await ceo();
  if (!me) return { ok: false, error: "Not authorized" };
  await prisma.anthropicConfig
    .update({ where: { id: "singleton" }, data: { apiKey: null, enabled: false } })
    .catch(() => {});
  await prisma.auditLog.create({
    data: { actorId: me.user.id, action: "assistant.disconnect", target: "claude" },
  });
  revalidatePath("/settings");
  revalidatePath("/", "layout");
  return { ok: true };
}
