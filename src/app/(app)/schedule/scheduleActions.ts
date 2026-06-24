"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import type { Role } from "@/lib/roles";

export type ScheduleResult = { ok: boolean; error?: string };

function isManager(role: Role) {
  return role === "CEO" || role === "OFFICE";
}

async function getMe() {
  const session = await auth();
  if (!session?.user) return null;
  return session.user as { id: string; role: string; name?: string | null };
}

// ─── Create ───────────────────────────────────────────────────────────────────

export async function createTask(formData: FormData): Promise<ScheduleResult> {
  const me = await getMe();
  if (!me || !isManager(me.role as Role)) return { ok: false, error: "Not authorized" };

  const projectId  = String(formData.get("projectId")  || "").trim();
  const name       = String(formData.get("name")        || "").trim();
  const startDate  = String(formData.get("startDate")   || "").trim();
  const endDate    = String(formData.get("endDate")     || "").trim();
  const assigneeId = String(formData.get("assigneeId")  || "").trim() || null;
  const dependsOnId = String(formData.get("dependsOnId") || "").trim() || null;

  if (!projectId || !name || !startDate || !endDate) {
    return { ok: false, error: "Name, start date, and end date are required" };
  }
  const start = new Date(startDate);
  const end   = new Date(endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return { ok: false, error: "Invalid dates" };
  }
  if (end <= start) {
    return { ok: false, error: "End date must be after start date" };
  }

  const count = await prisma.scheduleTask.count({ where: { projectId } });
  await prisma.scheduleTask.create({
    data: {
      projectId,
      name,
      startDate: start,
      endDate: end,
      assigneeId,
      dependsOnId,
      order: count,
    },
  });
  revalidatePath("/schedule");
  return { ok: true };
}

// ─── Update (managers: full edit; field/sub: progress on assigned tasks only) ─

export async function updateTask(
  taskId: string,
  formData: FormData
): Promise<ScheduleResult> {
  const me = await getMe();
  if (!me) return { ok: false, error: "Not authorized" };

  const task = await prisma.scheduleTask.findUnique({ where: { id: taskId } });
  if (!task) return { ok: false, error: "Task not found" };

  const role = me.role as Role;

  if (!isManager(role)) return { ok: false, error: "Not authorized" };

  const name       = String(formData.get("name")       || "").trim();
  const startDate  = String(formData.get("startDate")  || "").trim();
  const endDate    = String(formData.get("endDate")    || "").trim();
  const assigneeId = String(formData.get("assigneeId") || "").trim() || null;
  const dependsOnId = String(formData.get("dependsOnId") || "").trim() || null;
  const rawProgress = parseFloat(String(formData.get("progress") || "0"));

  if (!name || !startDate || !endDate) {
    return { ok: false, error: "Name, start date, and end date are required" };
  }
  const start = new Date(startDate);
  const end   = new Date(endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return { ok: false, error: "Invalid dates" };
  }
  if (end <= start) {
    return { ok: false, error: "End date must be after start date" };
  }

  const progress = isNaN(rawProgress) ? 0 : Math.min(1, Math.max(0, rawProgress));

  await prisma.scheduleTask.update({
    where: { id: taskId },
    data: { name, startDate: start, endDate: end, assigneeId, dependsOnId, progress },
  });
  revalidatePath("/schedule");
  return { ok: true };
}

// ─── Progress update (field/sub on assigned tasks, managers on any) ───────────

export async function updateProgress(
  taskId: string,
  progress: number
): Promise<ScheduleResult> {
  const me = await getMe();
  if (!me) return { ok: false, error: "Not authorized" };

  const task = await prisma.scheduleTask.findUnique({ where: { id: taskId } });
  if (!task) return { ok: false, error: "Task not found" };

  const role = me.role as Role;
  const isField = role === "FIELD" || role === "SUB";
  if (isField && task.assigneeId !== me.id) {
    return { ok: false, error: "Not assigned to this task" };
  }
  if (!isManager(role) && !isField) {
    return { ok: false, error: "Not authorized" };
  }

  await prisma.scheduleTask.update({
    where: { id: taskId },
    data: { progress: Math.min(1, Math.max(0, progress)) },
  });
  revalidatePath("/schedule");
  return { ok: true };
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export async function deleteTask(taskId: string): Promise<ScheduleResult> {
  const me = await getMe();
  if (!me || !isManager(me.role as Role)) return { ok: false, error: "Not authorized" };

  // Clear dependsOnId references before deleting to avoid FK violations
  await prisma.scheduleTask.updateMany({
    where: { dependsOnId: taskId },
    data: { dependsOnId: null },
  });
  await prisma.scheduleTask.delete({ where: { id: taskId } });
  revalidatePath("/schedule");
  return { ok: true };
}

// ─── Publish baseline ─────────────────────────────────────────────────────────

export async function publishBaseline(projectId: string): Promise<ScheduleResult> {
  const me = await getMe();
  if (!me || !isManager(me.role as Role)) return { ok: false, error: "Not authorized" };

  const tasks = await prisma.scheduleTask.findMany({ where: { projectId } });
  if (!tasks.length) return { ok: false, error: "No tasks to baseline" };

  await Promise.all(
    tasks.map((t) =>
      prisma.scheduleTask.update({
        where: { id: t.id },
        data: { baselineStartDate: t.startDate, baselineEndDate: t.endDate },
      })
    )
  );
  revalidatePath("/schedule");
  return { ok: true };
}
