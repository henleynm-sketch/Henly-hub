import "server-only";
import { prisma } from "@/lib/prisma";
import { NotFoundError, ValidationError } from "@/lib/api/errors";
import { cursorArgs, paginate, type Pagination } from "@/lib/api/validation";

export type CreateDailyLogInput = {
  projectId: string;
  authorId: string;
  notes: string;
  weather?: string | null;
  crewOnSite?: string | null;
  hoursWorked?: number | null;

  clientVisible?: boolean;
  photos?: string[] | null; // stored as a JSON string on the row
  // P7 structured fields
  anticipatedDelays?: boolean;
  materialDeliveries?: boolean;
  safetyIncidents?: string | null;
  tradesOnsite?: string | null;
  unplannedTasks?: string | null;
  internalNotes?: string | null;
};

export async function listProjectDailyLogs(projectId: string, p: Pagination) {
  const rows = await prisma.dailyLog.findMany({
    where: { projectId },
    orderBy: { date: "desc" },
    include: { author: { select: { id: true, name: true } } },
    ...cursorArgs(p),
  });
  return paginate(rows, p.limit);
}

export async function getDailyLogById(id: string) {
  const log = await prisma.dailyLog.findUnique({
    where: { id },
    include: { author: { select: { id: true, name: true } } },
  });
  if (!log) throw new NotFoundError("Daily log not found");
  return log;
}

export async function createDailyLog(input: CreateDailyLogInput) {
  if (!input.projectId) throw new ValidationError("projectId is required", { projectId: ["required"] });
  if (!input.authorId) throw new ValidationError("authorId is required", { authorId: ["required"] });
  const notes = input.notes?.trim();
  if (!notes) throw new ValidationError("notes is required", { notes: ["required"] });
  const project = await prisma.project.findUnique({ where: { id: input.projectId } });
  if (!project) throw new ValidationError("projectId does not reference an existing project", { projectId: ["not found"] });

  return prisma.dailyLog.create({
    data: {
      projectId: input.projectId,
      authorId: input.authorId,
      notes,
      weather: input.weather ?? null,
      crewOnSite: input.crewOnSite ?? null,
      hoursWorked: input.hoursWorked ?? null,
      clientVisible: input.clientVisible ?? false,
      photos: input.photos && input.photos.length ? JSON.stringify(input.photos) : null,
    },
  });
}
