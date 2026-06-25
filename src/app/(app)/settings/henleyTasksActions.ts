"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canManageTeam, type Role } from "@/lib/roles";
import { revalidatePath } from "next/cache";
import { testConnection } from "@/lib/henleyTasks";

export type ActionResult = { ok: boolean; error?: string };

async function requireCeoOrOffice() {
  const me = await auth();
  const role = me?.user?.role as Role | undefined;
  if (!role || (role !== "CEO" && role !== "OFFICE")) return null;
  return me!;
}

async function requireCeo() {
  const me = await auth();
  const role = me?.user?.role as Role | undefined;
  if (!role || !canManageTeam(role)) return null;
  return me!;
}

// Save API key + optional base URL. Blank key → preserve existing key.
export async function saveHenleyTasksConfig(formData: FormData): Promise<ActionResult> {
  const me = await requireCeo();
  if (!me) return { ok: false, error: "Not authorized" };

  const rawKey = String(formData.get("apiKey") || "").trim();
  const rawBase = String(formData.get("apiBaseUrl") || "").trim();

  const existing = await prisma.henleyTasksConfig
    .findUnique({ where: { id: "singleton" } })
    .catch(() => null);

  const hadKey = Boolean(existing?.apiKey);
  if (!hadKey && !rawKey) {
    return { ok: false, error: "API key is required" };
  }

  const update: { apiKey?: string; apiBaseUrl?: string } = {};
  if (rawKey) update.apiKey = rawKey;
  if (rawBase) update.apiBaseUrl = rawBase;

  await prisma.henleyTasksConfig.upsert({
    where: { id: "singleton" },
    update,
    create: {
      id: "singleton",
      apiKey: rawKey || undefined,
      apiBaseUrl: rawBase || undefined,
    },
  });

  const result = await testConnection();
  revalidatePath("/settings");
  return { ok: result.ok, error: result.ok ? undefined : result.error };
}

// Test connection: CEO or Office.
export async function testHenleyTasksConnection(): Promise<ActionResult> {
  const me = await requireCeoOrOffice();
  if (!me) return { ok: false, error: "Not authorized" };
  const result = await testConnection();
  revalidatePath("/settings");
  return { ok: result.ok, error: result.ok ? undefined : result.error };
}

// Disconnect: CEO only. Clears stored key.
export async function disconnectHenleyTasks(): Promise<ActionResult> {
  const me = await requireCeo();
  if (!me) return { ok: false, error: "Not authorized" };
  await prisma.henleyTasksConfig
    .update({ where: { id: "singleton" }, data: { apiKey: null } })
    .catch(() => {});
  revalidatePath("/settings");
  return { ok: true };
}
