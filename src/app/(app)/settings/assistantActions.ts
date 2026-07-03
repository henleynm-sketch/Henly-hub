"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canManageTeam, type Role } from "@/lib/roles";
import { revalidatePath } from "next/cache";
import { detectProvider, verifyProvider, modelMatchesProvider, DEFAULT_MODELS, PROVIDER_LABELS } from "@/lib/assistant/providers";

export type AssistantActionResult = { ok: boolean; error?: string; providerLabel?: string };

async function ceo() {
  const me = await auth();
  if (!me?.user || !canManageTeam(me.user.role as Role)) return null;
  return me;
}

export async function saveAnthropicConfig(formData: FormData): Promise<AssistantActionResult> {
  const me = await ceo();
  if (!me) return { ok: false, error: "Not authorized" };

  const apiKey = String(formData.get("apiKey") || "").trim();
  let model = String(formData.get("model") || "").trim();

  const existing = await prisma.anthropicConfig.findUnique({ where: { id: "singleton" } }).catch(() => null);
  if (!existing?.apiKey && !apiKey) return { ok: false, error: "API key is required" };

  // Universal box: detect the provider from the key prefix, verify it live,
  // and only then enable. Model auto-fills per provider when left blank.
  const effectiveKey = apiKey || existing!.apiKey!;
  const provider = detectProvider(effectiveKey);
  if (!provider) {
    return {
      ok: false,
      error: "Could not recognize this key. Supported: Anthropic (sk-ant-…), OpenAI (sk-…), Google Gemini (AIza… or AQ.…).",
    };
  }
  // Wrong-family model names (e.g. claude-* sent to Gemini) are silently
  // corrected to the provider default — the model field only sticks when it
  // matches the detected provider.
  if (!model || !modelMatchesProvider(model, provider)) {
    model = DEFAULT_MODELS[provider];
  }

  const check = await verifyProvider(provider, effectiveKey, model);
  if (!check.ok) {
    return { ok: false, error: `${PROVIDER_LABELS[provider]} rejected the key/model: ${check.error}` };
  }

  const data: { model: string; apiKey?: string; enabled: boolean; provider: string } = {
    model,
    enabled: true,
    provider,
  };
  if (apiKey) data.apiKey = apiKey;

  try {
    await prisma.anthropicConfig.upsert({
      where: { id: "singleton" },
      update: data,
      create: { id: "singleton", apiKey: apiKey || null, model, enabled: true, provider },
    });
  } catch (err) {
    return {
      ok: false,
      error:
        "Database is missing the assistant tables — run `npx prisma db push` then retry. " +
        (err instanceof Error ? err.message.slice(0, 200) : ""),
    };
  }
  await prisma.auditLog.create({
    data: { actorId: me.user.id, action: existing?.apiKey ? "assistant.config.edit" : "assistant.config.enable", target: model },
  });
  revalidatePath("/settings");
  revalidatePath("/", "layout"); // launcher pill appears app-wide immediately
  return { ok: true, providerLabel: PROVIDER_LABELS[provider] };
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
