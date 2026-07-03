import { z } from "zod";
import { apiRoute } from "@/lib/api/handler";
import { parseBody, parsePagination } from "@/lib/api/validation";
import { listClients, createClient } from "@/lib/services/clientService";

export const GET = apiRoute("clients:read", async ({ url }) => {
  const { items, nextCursor } = await listClients(parsePagination(url));
  return { data: items, meta: { nextCursor } };
});

const createClientBody = z.object({
  name: z.string().min(1),
  primaryEmail: z.string().email().nullish(),
  primaryPhone: z.string().nullish(),
  address: z.string().nullish(),
  city: z.string().nullish(),
  state: z.string().nullish(),
  zip: z.string().nullish(),
  source: z.string().nullish(),
  stage: z.string().optional(),
  notes: z.string().nullish(),
});

export const POST = apiRoute("clients:write", async ({ body }) => {
  const input = parseBody(createClientBody, await body());
  const client = await createClient(input);
  return { data: client, status: 201 };
});
