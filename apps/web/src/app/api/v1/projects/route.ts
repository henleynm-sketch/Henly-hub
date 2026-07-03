import { z } from "zod";
import { apiRoute } from "@/lib/api/handler";
import { parseBody, parsePagination } from "@/lib/api/validation";
import { listProjects, createProject } from "@/lib/services/projectService";

export const GET = apiRoute("projects:read", async ({ url }) => {
  const { items, nextCursor } = await listProjects(parsePagination(url));
  return { data: items, meta: { nextCursor } };
});

const createProjectBody = z.object({
  name: z.string().min(1),
  clientId: z.string().min(1),
  address: z.string().nullish(),
  contractCents: z.number().int().nonnegative().optional(),
  budgetCents: z.number().int().nonnegative().optional(),
  description: z.string().nullish(),
  status: z.string().optional(),
});

export const POST = apiRoute("projects:write", async ({ body }) => {
  const input = parseBody(createProjectBody, await body());
  const project = await createProject(input);
  return { data: project, status: 201 };
});
