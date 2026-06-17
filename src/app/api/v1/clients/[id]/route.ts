import { z } from "zod";
import { apiRoute } from "@/lib/api/handler";
import { parseBody } from "@/lib/api/validation";
import { getClientById, updateClient } from "@/lib/services/clientService";

export const GET = apiRoute<{ id: string }>("clients:read", async ({ params }) => {
  return { data: await getClientById(params.id) };
});

const updateClientBody = z.object({
  name: z.string().min(1).optional(),
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

export const PATCH = apiRoute<{ id: string }>("clients:write", async ({ params, body }) => {
  const input = parseBody(updateClientBody, await body());
  return { data: await updateClient(params.id, input) };
});
