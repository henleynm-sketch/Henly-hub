import { z } from "zod";
import { apiRoute } from "@/lib/api/handler";
import { parseBody } from "@/lib/api/validation";
import { createMilestone } from "@/lib/services/milestoneService";

const createMilestoneBody = z.object({
  projectId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().nullish(),
  dueDate: z.string().datetime().nullish(),
  clientVisible: z.boolean().optional(),
  order: z.number().int().optional(),
});

export const POST = apiRoute("milestones:write", async ({ body }) => {
  const input = parseBody(createMilestoneBody, await body());
  const milestone = await createMilestone(input);
  return { data: milestone, status: 201 };
});
