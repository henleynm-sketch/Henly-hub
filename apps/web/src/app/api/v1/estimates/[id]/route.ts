import { z } from "zod";
import { apiRoute } from "@/lib/api/handler";
import { parseBody } from "@/lib/api/validation";
import { getEstimateById, updateEstimate } from "@/lib/services/estimateService";

export const GET = apiRoute<{ id: string }>("estimates:read", async ({ params }) => {
  return { data: await getEstimateById(params.id) };
});

const updateEstimateBody = z.object({
  title: z.string().min(1).optional(),
  notes: z.string().nullish(),
});

export const PATCH = apiRoute<{ id: string }>("estimates:write", async ({ params, body }) => {
  const input = parseBody(updateEstimateBody, await body());
  return { data: await updateEstimate(params.id, input) };
});
