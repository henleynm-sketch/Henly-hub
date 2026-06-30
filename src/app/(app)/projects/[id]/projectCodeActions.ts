"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import type { Role } from "@/lib/roles";

export type CodeResult = { ok: boolean; error?: string };

function isManager(role: Role) {
  return role === "CEO" || role === "OFFICE";
}

// Set / clear a project's short code (the join key for the upcoming per-project
// Tasks tab). Manager-only. Codes are uppercased and unique among non-null; an
// empty value clears the code. Never silently overwrites another project's code.
export async function setProjectCode(projectId: string, rawCode: string): Promise<CodeResult> {
  const me = await auth();
  const role = me?.user?.role as Role | undefined;
  if (!role || !isManager(role)) return { ok: false, error: "Not authorized" };

  const code = rawCode.trim().toUpperCase();

  if (!code) {
    await prisma.project.update({ where: { id: projectId }, data: { code: null } });
    revalidatePath(`/projects/${projectId}`);
    revalidatePath("/clients");
    return { ok: true };
  }

  if (!/^[A-Z0-9-]{2,12}$/.test(code)) {
    return { ok: false, error: "Code must be 2–12 chars: letters, numbers, hyphen" };
  }

  const clash = await prisma.project.findFirst({ where: { code, NOT: { id: projectId } } });
  if (clash) return { ok: false, error: `Code "${code}" is already used by another project` };

  try {
    await prisma.project.update({ where: { id: projectId }, data: { code } });
  } catch {
    return { ok: false, error: "Could not save code — it must be unique" };
  }
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/clients");
  return { ok: true };
}
