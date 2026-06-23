import { prisma } from "@repo/db";
import { NotFoundError, ValidationError, ConflictError } from "./errors";
import { cursorArgs, paginate, type Pagination } from "./pagination";

// NOTE: the field time-clock server actions live in
// apps/web/src/app/(app)/projects/[id]/timeActions.ts and are intentionally NOT
// refactored to use this service — that file (and the QBO push it calls) is on
// the do-not-touch guardrail list. This service is the API-facing surface.

export type TimeEntryFilter = { projectId?: string; userId?: string; approved?: boolean };
export type CreateTimeEntryInput = {
  userId: string;
  projectId: string;
  costCode: string;
  clockIn?: string | Date;
  clockOut?: string | Date | null;
  hours?: number | null;
};

export async function listTimeEntries(p: Pagination, filter?: TimeEntryFilter) {
  const where: Record<string, unknown> = {};
  if (filter?.projectId) where.projectId = filter.projectId;
  if (filter?.userId) where.userId = filter.userId;
  if (filter?.approved !== undefined) where.approved = filter.approved;
  const rows = await prisma.timeEntry.findMany({
    where,
    orderBy: { clockIn: "desc" },
    include: {
      user: { select: { id: true, name: true } },
      project: { select: { id: true, name: true } },
    },
    ...cursorArgs(p),
  });
  return paginate(rows, p.limit);
}

export async function getTimeEntryById(id: string) {
  const entry = await prisma.timeEntry.findUnique({ where: { id } });
  if (!entry) throw new NotFoundError("Time entry not found");
  return entry;
}

export async function createTimeEntry(input: CreateTimeEntryInput) {
  if (!input.userId) throw new ValidationError("userId is required", { userId: ["required"] });
  if (!input.projectId) throw new ValidationError("projectId is required", { projectId: ["required"] });
  if (!input.costCode?.trim()) throw new ValidationError("costCode is required", { costCode: ["required"] });
  const [user, project] = await Promise.all([
    prisma.user.findUnique({ where: { id: input.userId } }),
    prisma.project.findUnique({ where: { id: input.projectId } }),
  ]);
  if (!user) throw new ValidationError("userId does not reference an existing user", { userId: ["not found"] });
  if (!project) throw new ValidationError("projectId does not reference an existing project", { projectId: ["not found"] });

  const clockIn = input.clockIn ? new Date(input.clockIn) : new Date();
  const clockOut = input.clockOut ? new Date(input.clockOut) : null;
  let hours = input.hours ?? null;
  if (clockOut && hours == null) {
    hours = Math.max(0.01, Math.round(((clockOut.getTime() - clockIn.getTime()) / 3600000) * 100) / 100);
  }

  return prisma.timeEntry.create({
    data: {
      userId: input.userId,
      projectId: input.projectId,
      costCode: input.costCode.trim(),
      clockIn,
      clockOut,
      hours,
    },
  });
}

// Marks the entry approved + qbReady. The actual QuickBooks push remains in the
// existing internal/UI flow (timeActions.ts → pushTimeActivity) to respect the
// QBO guardrail; the API does not trigger QBO side effects.
export async function approveTimeEntry(id: string, approvedById?: string | null) {
  const entry = await getTimeEntryById(id);
  if (!entry.clockOut) throw new ConflictError("Cannot approve a time entry that is still clocked in");
  if (entry.approved) return entry;
  return prisma.timeEntry.update({
    where: { id },
    data: { approved: true, approvedById: approvedById ?? null, approvedAt: new Date(), qbReady: true },
  });
}
