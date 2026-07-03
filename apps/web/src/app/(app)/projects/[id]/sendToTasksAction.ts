"use server";

import { auth } from "@/auth";
import { isInternal, type Role } from "@/lib/roles";
import { createTask } from "@/lib/henleyTasks";

export type SendTaskResult = { ok: boolean; taskId?: string; error?: string };

export async function sendTaskToHenleyTasks(
  formData: FormData,
): Promise<SendTaskResult> {
  const me = await auth();
  const role = (me?.user as { role?: string } | undefined)?.role as Role | undefined;
  if (!role || !isInternal(role)) return { ok: false, error: "Not authorized" };

  const title = String(formData.get("title") || "").trim();
  if (!title) return { ok: false, error: "Title is required" };

  const priority = (String(formData.get("priority") || "") as "low" | "medium" | "high") || undefined;
  const dueDate = String(formData.get("dueDate") || "").trim() || undefined;
  const note = String(formData.get("note") || "").trim() || undefined;
  const projectName = String(formData.get("projectName") || "").trim() || undefined;

  return createTask({ title, priority, dueDate, note, projectName });
}
