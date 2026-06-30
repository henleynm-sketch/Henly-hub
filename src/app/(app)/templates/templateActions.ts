"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import type { Role } from "@/lib/roles";
import { isValidJobType, type JobType } from "@/lib/taxonomy";

export type TemplateResult = { ok: boolean; error?: string };

function isManager(role: Role) {
  return role === "CEO" || role === "OFFICE";
}

async function getMe() {
  const session = await auth();
  if (!session?.user) return null;
  return session.user as { id: string; role: string };
}

// ─── Template CRUD ────────────────────────────────────────────────────────────

export async function createTemplate(
  formData: FormData
): Promise<TemplateResult> {
  const me = await getMe();
  if (!me || !isManager(me.role as Role)) return { ok: false, error: "Not authorized" };

  const name    = String(formData.get("name")    || "").trim();
  const jobType = String(formData.get("jobType") || "").trim();

  if (!name) return { ok: false, error: "Name is required" };
  if (!isValidJobType(jobType)) return { ok: false, error: "Invalid job type" };

  await prisma.jobTemplate.create({ data: { name, jobType } });
  revalidatePath("/templates");
  return { ok: true };
}

export async function updateTemplate(
  templateId: string,
  formData: FormData
): Promise<TemplateResult> {
  const me = await getMe();
  if (!me || !isManager(me.role as Role)) return { ok: false, error: "Not authorized" };

  const name    = String(formData.get("name")    || "").trim();
  const jobType = String(formData.get("jobType") || "").trim();

  if (!name) return { ok: false, error: "Name is required" };
  if (!isValidJobType(jobType)) return { ok: false, error: "Invalid job type" };

  const tpl = await prisma.jobTemplate.findUnique({ where: { id: templateId } });
  if (!tpl) return { ok: false, error: "Template not found" };

  await prisma.jobTemplate.update({ where: { id: templateId }, data: { name, jobType } });
  revalidatePath("/templates");
  return { ok: true };
}

export async function deleteTemplate(templateId: string): Promise<TemplateResult> {
  const me = await getMe();
  if (!me || !isManager(me.role as Role)) return { ok: false, error: "Not authorized" };

  const tpl = await prisma.jobTemplate.findUnique({ where: { id: templateId } });
  if (!tpl) return { ok: false, error: "Template not found" };

  // Child items cascade via onDelete: Cascade
  await prisma.jobTemplate.delete({ where: { id: templateId } });
  revalidatePath("/templates");
  return { ok: true };
}

// ─── Schedule item CRUD ───────────────────────────────────────────────────────

export async function addScheduleItem(
  templateId: string,
  formData: FormData
): Promise<TemplateResult> {
  const me = await getMe();
  if (!me || !isManager(me.role as Role)) return { ok: false, error: "Not authorized" };

  const name            = String(formData.get("name")            || "").trim();
  const offsetStartDays = parseInt(String(formData.get("offsetStartDays") || "0"), 10);
  const durationDays    = parseInt(String(formData.get("durationDays")    || "1"), 10);

  if (!name) return { ok: false, error: "Name is required" };
  if (isNaN(offsetStartDays) || offsetStartDays < 0) return { ok: false, error: "Offset must be ≥ 0" };
  if (isNaN(durationDays)    || durationDays    < 1) return { ok: false, error: "Duration must be ≥ 1" };

  const tpl = await prisma.jobTemplate.findUnique({ where: { id: templateId } });
  if (!tpl) return { ok: false, error: "Template not found" };

  const count = await prisma.templateScheduleItem.count({ where: { templateId } });
  await prisma.templateScheduleItem.create({
    data: { templateId, name, offsetStartDays, durationDays, order: count },
  });
  revalidatePath("/templates");
  return { ok: true };
}

export async function updateScheduleItem(
  itemId: string,
  formData: FormData
): Promise<TemplateResult> {
  const me = await getMe();
  if (!me || !isManager(me.role as Role)) return { ok: false, error: "Not authorized" };

  const name            = String(formData.get("name")            || "").trim();
  const offsetStartDays = parseInt(String(formData.get("offsetStartDays") || "0"), 10);
  const durationDays    = parseInt(String(formData.get("durationDays")    || "1"), 10);

  if (!name) return { ok: false, error: "Name is required" };

  await prisma.templateScheduleItem.update({
    where: { id: itemId },
    data: { name, offsetStartDays, durationDays },
  });
  revalidatePath("/templates");
  return { ok: true };
}

export async function deleteScheduleItem(itemId: string): Promise<TemplateResult> {
  const me = await getMe();
  if (!me || !isManager(me.role as Role)) return { ok: false, error: "Not authorized" };

  await prisma.templateScheduleItem.delete({ where: { id: itemId } });
  revalidatePath("/templates");
  return { ok: true };
}

// ─── Budget item CRUD ─────────────────────────────────────────────────────────

export async function addBudgetItem(
  templateId: string,
  formData: FormData
): Promise<TemplateResult> {
  const me = await getMe();
  if (!me || !isManager(me.role as Role)) return { ok: false, error: "Not authorized" };

  const category    = String(formData.get("category") || "").trim();
  const budgetCents = Math.round(parseFloat(String(formData.get("budget") || "0")) * 100);

  if (!category) return { ok: false, error: "Category is required" };
  if (isNaN(budgetCents) || budgetCents < 0) return { ok: false, error: "Budget must be ≥ 0" };

  const tpl = await prisma.jobTemplate.findUnique({ where: { id: templateId } });
  if (!tpl) return { ok: false, error: "Template not found" };

  await prisma.templateBudgetItem.create({ data: { templateId, category, budgetCents } });
  revalidatePath("/templates");
  return { ok: true };
}

export async function updateBudgetItem(
  itemId: string,
  formData: FormData
): Promise<TemplateResult> {
  const me = await getMe();
  if (!me || !isManager(me.role as Role)) return { ok: false, error: "Not authorized" };

  const category    = String(formData.get("category") || "").trim();
  const budgetCents = Math.round(parseFloat(String(formData.get("budget") || "0")) * 100);

  if (!category) return { ok: false, error: "Category is required" };

  await prisma.templateBudgetItem.update({ where: { id: itemId }, data: { category, budgetCents } });
  revalidatePath("/templates");
  return { ok: true };
}

export async function deleteBudgetItem(itemId: string): Promise<TemplateResult> {
  const me = await getMe();
  if (!me || !isManager(me.role as Role)) return { ok: false, error: "Not authorized" };

  await prisma.templateBudgetItem.delete({ where: { id: itemId } });
  revalidatePath("/templates");
  return { ok: true };
}

// ─── Apply template ───────────────────────────────────────────────────────────
// Idempotent: if any ScheduleTask for this project already carries sourceTemplateId
// === templateId, the call is a no-op and returns an error to the caller.

export async function applyTemplate(
  projectId: string,
  templateId: string
): Promise<TemplateResult> {
  const me = await getMe();
  if (!me || !isManager(me.role as Role)) return { ok: false, error: "Not authorized" };

  const [project, template] = await Promise.all([
    prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, startDate: true, jobType: true },
    }),
    prisma.jobTemplate.findUnique({
      where: { id: templateId },
      include: {
        scheduleItems: { orderBy: { order: "asc" } },
        budgetItems:   true,
      },
    }),
  ]);

  if (!project)  return { ok: false, error: "Project not found" };
  if (!template) return { ok: false, error: "Template not found" };

  // Idempotency guard — check both tables
  const [existSched, existBudget] = await Promise.all([
    prisma.scheduleTask.count({ where: { projectId, sourceTemplateId: templateId } }),
    prisma.budgetItem.count({   where: { projectId, sourceTemplateId: templateId } }),
  ]);
  if (existSched > 0 || existBudget > 0) {
    return { ok: false, error: "Template already applied to this project" };
  }

  const startDate = project.startDate ?? new Date();
  const currentOrder = await prisma.scheduleTask.count({ where: { projectId } });

  // Materialize schedule tasks
  await Promise.all(
    template.scheduleItems.map((item, idx) => {
      const taskStart = new Date(startDate);
      taskStart.setDate(taskStart.getDate() + item.offsetStartDays);
      const taskEnd = new Date(taskStart);
      taskEnd.setDate(taskEnd.getDate() + item.durationDays);

      return prisma.scheduleTask.create({
        data: {
          projectId,
          name:            item.name,
          startDate:       taskStart,
          endDate:         taskEnd,
          order:           currentOrder + idx,
          sourceTemplateId: templateId,
        },
      });
    })
  );

  // Materialize budget items
  await Promise.all(
    template.budgetItems.map((item) =>
      prisma.budgetItem.create({
        data: {
          projectId,
          category:        item.category,
          description:     item.category,  // BudgetItem.description is required
          estimateCents:   item.budgetCents,
          sourceTemplateId: templateId,
        },
      })
    )
  );

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/schedule");
  return { ok: true };
}

// ─── Seed standard Henley templates ─────────────────────────────────────────
// The 9 standard job templates, each seeded with Henley's real 6-phase
// construction skeleton as ordered schedule items. Idempotent: matched by name,
// so re-running creates no duplicates. No budget lines or per-task detail are
// fabricated (schedule items use their schema defaults for offset/duration).

const HENLEY_TEMPLATES: { name: string; jobType: JobType }[] = [
  { name: "Addition", jobType: "Addition" },
  { name: "Bathroom Reno", jobType: "Bathroom" },
  { name: "Custom Home", jobType: "Custom New Home" },
  { name: "Detached Garage/Boathouse", jobType: "Addition" },
  { name: "Full Home Reno", jobType: "Whole Home Remodel" },
  { name: "Kitchen w/Flooring Reno", jobType: "Kitchen" },
  { name: "Kitchen w/o Flooring Reno", jobType: "Kitchen" },
  { name: "Partially Finished Basement Reno", jobType: "Basement" },
  { name: "Unfinished Basement Reno", jobType: "Basement" },
];

const CONSTRUCTION_PHASES = [
  "Pre-Construction",
  "Site Prep & Foundations",
  "Rough Structure & Exterior",
  "Interior Finishing",
  "Cleanup Landscaping & Handoff",
  "Complete",
];

export type SeedResult = { ok: boolean; created?: number; skipped?: number; error?: string };

export async function seedHenleyTemplates(): Promise<SeedResult> {
  const me = await getMe();
  if (!me || (me.role as Role) !== "CEO") return { ok: false, error: "Not authorized" };

  let created = 0;
  let skipped = 0;
  for (const t of HENLEY_TEMPLATES) {
    const existing = await prisma.jobTemplate.findFirst({ where: { name: t.name } });
    if (existing) {
      skipped += 1;
      continue;
    }
    await prisma.jobTemplate.create({
      data: {
        name: t.name,
        jobType: t.jobType,
        scheduleItems: {
          create: CONSTRUCTION_PHASES.map((name, i) => ({ name, order: i })),
        },
      },
    });
    created += 1;
  }
  revalidatePath("/templates");
  return { ok: true, created, skipped };
}
