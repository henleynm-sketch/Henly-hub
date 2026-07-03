import "server-only";
import { prisma } from "@/lib/prisma";
import { NotFoundError, ValidationError } from "@/lib/api/errors";
import { cursorArgs, paginate, type Pagination } from "@/lib/api/validation";

const projectSelect = {
  id: true,
  name: true,
  status: true,
  projectType: true,
  clientId: true,
  address: true,
  city: true,
  budgetCents: true,
  contractCents: true,
  currentPhase: true,
  nextStep: true,
  team: true,
  archivedAt: true,
  createdAt: true,
  updatedAt: true,
  client: { select: { id: true, name: true } },
} as const;

export type CreateProjectInput = {
  name: string;
  clientId: string;
  address?: string | null;
  contractCents?: number;
  budgetCents?: number;
  description?: string | null;
  status?: string;
};
export type UpdateProjectInput = Partial<{
  name: string;
  address: string | null;
  city: string | null;
  status: string;
  currentPhase: string | null;
  nextStep: string | null;
  team: string | null;
  contractCents: number;
  budgetCents: number;
  description: string | null;
}>;

export async function listProjects(p: Pagination) {
  const rows = await prisma.project.findMany({
    orderBy: { updatedAt: "desc" },
    select: projectSelect,
    ...cursorArgs(p),
  });
  return paginate(rows, p.limit);
}

export async function getProjectById(id: string) {
  const project = await prisma.project.findUnique({ where: { id }, select: projectSelect });
  if (!project) throw new NotFoundError("Project not found");
  return project;
}

export async function createProject(input: CreateProjectInput) {
  const name = input.name?.trim();
  if (!name) throw new ValidationError("name is required", { name: ["required"] });
  if (!input.clientId) throw new ValidationError("clientId is required", { clientId: ["required"] });
  const client = await prisma.client.findUnique({ where: { id: input.clientId } });
  if (!client) throw new ValidationError("clientId does not reference an existing client", { clientId: ["not found"] });
  return prisma.project.create({
    data: {
      name,
      clientId: input.clientId,
      address: input.address ?? null,
      contractCents: input.contractCents ?? 0,
      budgetCents: input.budgetCents ?? 0,
      description: input.description ?? null,
      status: input.status ?? "PLANNING",
    },
    select: projectSelect,
  });
}

export async function updateProject(id: string, input: UpdateProjectInput) {
  const existing = await getProjectById(id);
  const data: Record<string, unknown> = { ...input };
  // An address change invalidates the geocoded pin — clear coords so the
  // Location card honestly asks to re-locate instead of showing a stale pin.
  if (input.address !== undefined && input.address !== existing.address) {
    data.latitude = null;
    data.longitude = null;
    data.geocodedAt = null;
    data.geocodeSource = null;
  }
  return prisma.project.update({ where: { id }, data, select: projectSelect });
}

// Soft archive — stamps archivedAt, never hard-deletes.
export async function archiveProject(id: string) {
  await getProjectById(id);
  return prisma.project.update({ where: { id }, data: { archivedAt: new Date() }, select: projectSelect });
}
