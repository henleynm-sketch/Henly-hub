"use server";

import { auth } from "@/auth";
import { type Role } from "@/lib/roles";
import { revalidatePath } from "next/cache";
import { createTask, updateTask, deleteTask, type HenleyTask } from "@/lib/henleyTasks";

export type CreateTaskActionResult = { ok: boolean; error?: string; taskId?: string };
export type TaskWriteResult = { ok: boolean; error?: string };

// Fields the Hub is allowed to PATCH (Antu-confirmed editable set).
export type TaskPatch = {
  title?: string;
  description?: string;
  priority?: "low" | "medium" | "high";
  due_date?: string;
  assignee?: string;
  status?: "open" | "in_progress" | "done";
};

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

// Partial update — only the fields present in `patch` are sent (PATCH). The
// client builds `patch` from just the changed fields. "Mark done" / status
// change is updateTaskAction(id, { status: "done" | ... }).
export async function updateTaskAction(id: string, patch: TaskPatch): Promise<TaskWriteResult> {
  const me = await requireCeoOrOffice();
  if (!me) return { ok: false, error: "Not authorized" };
  if (!id) return { ok: false, error: "Task id required" };

  // Whitelist the editable fields; drop anything not explicitly provided.
  const clean: Partial<HenleyTask> = {};
  if (patch.title !== undefined) clean.title = patch.title;
  if (patch.description !== undefined) clean.description = patch.description;
  if (patch.priority !== undefined) clean.priority = patch.priority;
  if (patch.due_date !== undefined) clean.due_date = patch.due_date;
  if (patch.assignee !== undefined) clean.assignee = patch.assignee;
  if (patch.status !== undefined) clean.status = patch.status;
  if (Object.keys(clean).length === 0) return { ok: true }; // nothing changed

  const result = await updateTask(id, clean);
  if (result.ok) revalidatePath("/tasks");
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}

export async function deleteTaskAction(id: string): Promise<TaskWriteResult> {
  const me = await requireCeoOrOffice();
  if (!me) return { ok: false, error: "Not authorized" };
  if (!id) return { ok: false, error: "Task id required" };

  const result = await deleteTask(id);
  if (result.ok) revalidatePath("/tasks");
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}
