import { z } from "zod";
import { apiRoute } from "@/lib/api/handler";
import { parseBody } from "@/lib/api/validation";
import { getProjectById, updateProject } from "@/lib/services/projectService";

export const GET = apiRoute<{ id: string }>("projects:read", async ({ params }) => {
  return { data: await getProjectById(params.id) };
});

const updateProjectBody = z.object({
  name: z.string().min(1).optional(),
  address: z.string().nullish(),
  city: z.string().nullish(),
  status: z.string().optional(),
  currentPhase: z.string().nullish(),
  nextStep: z.string().nullish(),
  team: z.string().nullish(),
  contractCents: z.number().int().nonnegative().optional(),
  budgetCents: z.number().int().nonnegative().optional(),
  description: z.string().nullish(),
});

export const PATCH = apiRoute<{ id: string }>("projects:write", async ({ params, body }) => {
  const input = parseBody(updateProjectBody, await body());
  return { data: await updateProject(params.id, input) };
});
