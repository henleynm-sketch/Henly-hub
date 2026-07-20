"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canManageTeam, type Role } from "@/lib/roles";
import { revalidatePath } from "next/cache";

export type ActionResult = { ok: boolean; error?: string };

// Module-scope guard (not closed over a component function) — CEO only.
async function requireCeo() {
  const me = await auth();
  const role = me?.user?.role as Role | undefined;
  if (!role || !canManageTeam(role)) return null;
  return me!;
}

// Mark an ErrorLog row resolved / reopened. CEO only.
export async function setErrorResolved(id: string, resolved: boolean): Promise<ActionResult> {
  const me = await requireCeo();
  if (!me) return { ok: false, error: "Not authorized" };
  try {
    await prisma.errorLog.update({
      where: { id },
      data: resolved
        ? { resolved: true, resolvedAt: new Date(), resolvedById: me.user!.id }
        : { resolved: false, resolvedAt: null, resolvedById: null },
    });
    revalidatePath("/settings/diagnostics");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Update failed" };
  }
}
