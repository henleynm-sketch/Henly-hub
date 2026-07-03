import { z } from "zod";
import { apiRoute } from "@/lib/api/handler";
import { parseBody, parsePagination } from "@/lib/api/validation";
import { listEstimates, createEstimate } from "@/lib/services/estimateService";

export const GET = apiRoute("estimates:read", async ({ url }) => {
  const { items, nextCursor } = await listEstimates(parsePagination(url));
  return { data: items, meta: { nextCursor } };
});

const createEstimateBody = z.object({
  clientId: z.string().min(1),
  authorId: z.string().min(1),
  title: z.string().min(1),
  notes: z.string().nullish(),
  taxRate: z.number().nonnegative().optional(),
  lines: z
    .array(
      z.object({
        category: z.string().nullish(),
        description: z.string().min(1),
        quantity: z.number().positive(),
        unitCents: z.number().int().nonnegative(),
      })
    )
    .default([]),
});

export const POST = apiRoute("estimates:write", async ({ body }) => {
  const input = parseBody(createEstimateBody, await body());
  const estimate = await createEstimate(input);
  return { data: estimate, status: 201 };
});
