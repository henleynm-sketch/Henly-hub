import "server-only";
import { prisma } from "@/lib/prisma";
import { NotFoundError, ValidationError, ConflictError } from "@/lib/api/errors";

export const CHANGE_ORDER_STATUSES = ["DRAFT", "SENT", "APPROVED", "DECLINED"] as const;
export type ChangeOrderStatus = (typeof CHANGE_ORDER_STATUSES)[number];

export function isChangeOrderStatus(s: string): s is ChangeOrderStatus {
  return (CHANGE_ORDER_STATUSES as readonly string[]).includes(s);
}

// Allowed transitions. A change order is locked once it is APPROVED or DECLINED.
const TRANSITIONS: Record<ChangeOrderStatus, ChangeOrderStatus[]> = {
  DRAFT: ["SENT"],
  SENT: ["APPROVED", "DECLINED"],
  APPROVED: [],
  DECLINED: [],
};

export function canTransition(from: string, to: ChangeOrderStatus): boolean {
  return isChangeOrderStatus(from) && TRANSITIONS[from].includes(to);
}

export async function listProjectChangeOrders(projectId: string) {
  return prisma.changeOrder.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    include: { createdBy: { select: { name: true } } },
  });
}

export async function getChangeOrderById(id: string) {
  const co = await prisma.changeOrder.findUnique({ where: { id } });
  if (!co) throw new NotFoundError("Change order not found");
  return co;
}

export type CreateChangeOrderInput = {
  projectId: string;
  createdById: string;
  title: string;
  description?: string | null;
  amountCents: number;
  estimateId?: string | null;
  clientVisible?: boolean;
};

export async function createChangeOrder(input: CreateChangeOrderInput) {
  const title = input.title?.trim();
  if (!input.projectId) throw new ValidationError("projectId is required", { projectId: ["required"] });
  if (!title) throw new ValidationError("title is required", { title: ["required"] });
  if (!Number.isInteger(input.amountCents)) {
    throw new ValidationError("amountCents must be an integer", { amountCents: ["invalid"] });
  }
  if (input.amountCents === 0) {
    throw new ValidationError("amountCents must not be zero", { amountCents: ["nonzero"] });
  }
  const project = await prisma.project.findUnique({ where: { id: input.projectId } });
  if (!project) throw new ValidationError("projectId does not reference an existing project", { projectId: ["not found"] });

  const count = await prisma.changeOrder.count();
  return prisma.changeOrder.create({
    data: {
      number: `CO-${1001 + count}`,
      projectId: input.projectId,
      estimateId: input.estimateId ?? null,
      createdById: input.createdById,
      title,
      description: input.description?.trim() || null,
      amountCents: input.amountCents,
      clientVisible: input.clientVisible ?? false,
      status: "DRAFT",
    },
  });
}

export async function sendChangeOrder(id: string) {
  const co = await getChangeOrderById(id);
  if (!canTransition(co.status, "SENT")) {
    throw new ConflictError(`Cannot send a change order that is ${co.status.toLowerCase()}`);
  }
  return prisma.changeOrder.update({
    where: { id },
    data: { status: "SENT", sentAt: new Date(), clientVisible: true },
  });
}

// Approving is the only money-moving path. In one transaction we lock the change
// order and roll its amount into the project: the contract total grows, and a
// BudgetItem records the added scope so it shows in the Budget vs actual table.
// Mirrors the existing integer-cent machinery (Project.contractCents, BudgetItem).
export async function approveChangeOrder(id: string, decidedByName: string) {
  return prisma.$transaction(async (tx) => {
    const co = await tx.changeOrder.findUnique({ where: { id } });
    if (!co) throw new NotFoundError("Change order not found");
    if (!canTransition(co.status, "APPROVED")) {
      throw new ConflictError(`Cannot approve a change order that is ${co.status.toLowerCase()}`);
    }
    const updated = await tx.changeOrder.update({
      where: { id },
      data: { status: "APPROVED", decidedAt: new Date(), decidedByName: decidedByName.trim() || null },
    });
    await tx.project.update({
      where: { id: co.projectId },
      data: { contractCents: { increment: co.amountCents } },
    });
    await tx.budgetItem.create({
      data: {
        projectId: co.projectId,
        category: "Change Order",
        description: `${co.number} · ${co.title}`,
        estimateCents: co.amountCents,
        actualCents: 0,
      },
    });
    return updated;
  });
}

export async function declineChangeOrder(id: string, decidedByName: string) {
  const co = await getChangeOrderById(id);
  if (!canTransition(co.status, "DECLINED")) {
    throw new ConflictError(`Cannot decline a change order that is ${co.status.toLowerCase()}`);
  }
  return prisma.changeOrder.update({
    where: { id },
    data: { status: "DECLINED", decidedAt: new Date(), decidedByName: decidedByName.trim() || null },
  });
}
