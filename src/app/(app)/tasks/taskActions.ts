"use server";

import { auth } from "@/auth";
import { type Role } from "@/lib/roles";
import { revalidatePath } from "next/cache";
import { createTask } from "@/lib/henleyTasks";

export type CreateTaskActionResult = { ok: boolean; error?: string; taskId?: string };

// Create is CEO/Office only — FIELD is read-only on the Tasks workspace.
// Module-scope helper (never closed over inside a component, per guardrail).
async function requireCeoOrOffice() {
  const me = await auth();
  const role = me?.user?.role as Role | undefined;
  if (!role || (role !== "CEO" && role !== "OFFICE")) return null;
  return me!;
}

export async function createTaskAction(formData: FormData): Promise<CreateTaskActionResult> {
  const me = await requireCeoOrOffice();
  if (!me) return { ok: false, error: "Not authorized" };

  const title = String(formData.get("title") || "").trim();
  if (!title) return { ok: false, error: "Title is required" };

  const priority = (String(formData.get("priority") || "") as "low" | "medium" | "high") || undefined;
  const dueDate = String(formData.get("dueDate") || "").trim() || undefined;
  const assignee = String(formData.get("assignee") || "").trim() || undefined;
  const note = String(formData.get("note") || "").trim() || undefined;

  const result = await createTask({ title, priority, dueDate, assignee, note });
  if (result.ok) {
    // Re-read from the API on the next render; the Hub keeps no local copy.
    revalidatePath("/tasks");
    return { ok: true, taskId: result.taskId };
  }
  return { ok: false, error: result.error };
}
