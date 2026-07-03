"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isUiTheme } from "@/lib/uiTheme";
import { revalidatePath } from "next/cache";

// Per-user UI skin preference (glass | saas). Any authenticated user may set
// their own — not CEO-gated.
export async function setUiTheme(theme: string) {
  const me = await auth();
  if (!me?.user) throw new Error("Not authenticated");
  if (!isUiTheme(theme)) throw new Error("Invalid UI theme");
  await prisma.user.update({ where: { id: me.user.id }, data: { uiTheme: theme } });
  revalidatePath("/", "layout");
  return { ok: true as const };
}
