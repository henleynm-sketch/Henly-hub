import { prisma } from "@repo/db";
import { NotFoundError, ValidationError } from "./errors";

export const MILESTONE_STATUSES = ["PENDING", "IN_PROGRESS", "DONE", "BLOCKED"] as const;
export type MilestoneStatus = (typeof MILESTONE_STATUSES)[number];

export function isMilestoneStatus(s: string): s is MilestoneStatus {
  return (MILESTONE_STATUSES as readonly string[]).includes(s);
}

export type CreateMilestoneInput = {
  projectId: string;
  title: string;
  description?: string | null;
  dueDate?: string | Date | null;
  clientVisible?: boolean;
  order?: number;
};

export async function listProjectMilestones(projectId: string) {
  return prisma.milestone.findMany({ where: { projectId }, orderBy: { order: "asc" } });
}

export async function getMilestoneById(id: string) {
  const m = await prisma.milestone.findUnique({ where: { id } });
  if (!m) throw new NotFoundError("Milestone not found");
  return m;
}

export async function createMilestone(input: CreateMilestoneInput) {
  if (!input.projectId) throw new ValidationError("projectId is required", { projectId: ["required"] });
  const title = input.title?.trim();
  if (!title) throw new ValidationError("title is required", { title: ["required"] });
  const project = await prisma.project.findUnique({ where: { id: input.projectId } });
  if (!project) throw new ValidationError("projectId does not reference an existing project", { projectId: ["not found"] });
  return prisma.milestone.create({
    data: {
      projectId: input.projectId,
      title,
      description: input.description ?? null,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      clientVisible: input.clientVisible ?? true,
      order: input.order ?? 0,
    },
  });
}

export async function updateMilestoneStatus(id: string, status: string) {
  await getMilestoneById(id);
  if (!isMilestoneStatus(status)) {
    throw new ValidationError(`status must be one of ${MILESTONE_STATUSES.join(", ")}`, { status: ["invalid"] });
  }
  return prisma.milestone.update({ where: { id }, data: { status } });
}

export async function completeMilestone(id: string) {
  await getMilestoneById(id);
  return prisma.milestone.update({ where: { id }, data: { status: "DONE" } });
}
