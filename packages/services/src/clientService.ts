import { prisma } from "@repo/db";
import { NotFoundError, ValidationError } from "./errors";
import { cursorArgs, paginate, type Pagination } from "./pagination";

// Pure, HTTP-unaware business logic for Clients. Both the v1 API routes and the
// Hub server actions call these. Functions throw typed errors (NotFoundError,
// ValidationError, ...) which the API layer translates to HTTP responses.

export type CreateClientInput = {
  name: string;
  primaryEmail?: string | null;
  primaryPhone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  source?: string | null;
  stage?: string;
  notes?: string | null;
};
export type UpdateClientInput = Partial<CreateClientInput>;

export async function listClients(p: Pagination) {
  const rows = await prisma.client.findMany({ orderBy: { createdAt: "desc" }, ...cursorArgs(p) });
  return paginate(rows, p.limit);
}

export async function getClientById(id: string) {
  const client = await prisma.client.findUnique({ where: { id } });
  if (!client) throw new NotFoundError("Client not found");
  return client;
}

export async function createClient(input: CreateClientInput) {
  const name = input.name?.trim();
  if (!name) throw new ValidationError("name is required", { name: ["required"] });
  return prisma.client.create({
    data: {
      name,
      primaryEmail: input.primaryEmail ?? null,
      primaryPhone: input.primaryPhone ?? null,
      address: input.address ?? null,
      city: input.city ?? null,
      state: input.state ?? null,
      zip: input.zip ?? null,
      source: input.source ?? null,
      stage: input.stage ?? "LEAD",
      notes: input.notes ?? null,
    },
  });
}

export async function updateClient(id: string, input: UpdateClientInput) {
  await getClientById(id);
  const data: UpdateClientInput = { ...input };
  if (data.name !== undefined) {
    const n = String(data.name).trim();
    if (!n) throw new ValidationError("name cannot be empty", { name: ["required"] });
    data.name = n;
  }
  return prisma.client.update({ where: { id }, data });
}
