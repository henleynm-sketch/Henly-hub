import { prisma } from "@repo/db";
import { NotFoundError, ValidationError } from "./errors";
import { cursorArgs, paginate, type Pagination } from "./pagination";

export const ESTIMATE_STATUSES = ["DRAFT", "SENT", "ACCEPTED", "DECLINED"] as const;
export type EstimateStatus = (typeof ESTIMATE_STATUSES)[number];

export function isEstimateStatus(s: string): s is EstimateStatus {
  return (ESTIMATE_STATUSES as readonly string[]).includes(s);
}

export type EstimateLineInput = {
  category?: string | null;
  description: string;
  quantity: number;
  unitCents: number;
};
export type CreateEstimateInput = {
  clientId: string;
  authorId: string;
  title: string;
  notes?: string | null;
  taxRate?: number; // percent, e.g. 6.5
  lines: EstimateLineInput[];
};
export type UpdateEstimateInput = Partial<{ title: string; notes: string | null }>;

export async function listEstimates(p: Pagination) {
  const rows = await prisma.estimate.findMany({
    orderBy: { createdAt: "desc" },
    include: { client: { select: { id: true, name: true } } },
    ...cursorArgs(p),
  });
  return paginate(rows, p.limit);
}

export async function getEstimateById(id: string) {
  const e = await prisma.estimate.findUnique({
    where: { id },
    include: { client: { select: { id: true, name: true } }, lineItems: true },
  });
  if (!e) throw new NotFoundError("Estimate not found");
  return e;
}

export async function createEstimate(input: CreateEstimateInput) {
  const title = input.title?.trim();
  if (!input.clientId) throw new ValidationError("clientId is required", { clientId: ["required"] });
  if (!title) throw new ValidationError("title is required", { title: ["required"] });
  if (!input.authorId) throw new ValidationError("authorId is required", { authorId: ["required"] });
  const client = await prisma.client.findUnique({ where: { id: input.clientId } });
  if (!client) throw new ValidationError("clientId does not reference an existing client", { clientId: ["not found"] });

  const lines = (input.lines ?? []).filter(
    (l) => l.description?.trim() && l.quantity > 0 && l.unitCents > 0
  );
  const subtotalCents = lines.reduce((a, l) => a + Math.round(l.quantity * l.unitCents), 0);
  const taxCents = Math.round(subtotalCents * ((input.taxRate ?? 0) / 100));
  const totalCents = subtotalCents + taxCents;

  const count = await prisma.estimate.count();
  const number = `EST-${String(1001 + count).padStart(4, "0")}`;

  return prisma.estimate.create({
    data: {
      clientId: input.clientId,
      authorId: input.authorId,
      number,
      title,
      status: "DRAFT",
      notes: input.notes ?? null,
      subtotalCents,
      taxCents,
      totalCents,
      lineItems: {
        create: lines.map((l) => ({
          category: l.category ?? null,
          description: l.description.trim(),
          quantity: l.quantity,
          unitCents: l.unitCents,
          totalCents: Math.round(l.quantity * l.unitCents),
        })),
      },
    },
    include: { lineItems: true },
  });
}

export async function updateEstimate(id: string, input: UpdateEstimateInput) {
  await getEstimateById(id);
  const data: UpdateEstimateInput = {};
  if (input.title !== undefined) {
    const t = input.title.trim();
    if (!t) throw new ValidationError("title cannot be empty", { title: ["required"] });
    data.title = t;
  }
  if (input.notes !== undefined) data.notes = input.notes;
  return prisma.estimate.update({ where: { id }, data, include: { lineItems: true } });
}

export async function setEstimateStatus(id: string, status: string) {
  await getEstimateById(id);
  if (!isEstimateStatus(status)) {
    throw new ValidationError(`status must be one of ${ESTIMATE_STATUSES.join(", ")}`, { status: ["invalid"] });
  }
  return prisma.estimate.update({ where: { id }, data: { status } });
}
