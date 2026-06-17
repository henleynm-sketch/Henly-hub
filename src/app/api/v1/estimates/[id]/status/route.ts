import { z } from "zod";
import { apiRoute } from "@/lib/api/handler";
import { parseBody } from "@/lib/api/validation";
import { setEstimateStatus } from "@/lib/services/estimateService";

// status value is validated inside setEstimateStatus (→ 400 on invalid).
const statusBody = z.object({ status: z.string().min(1) });

export const POST = apiRoute<{ id: string }>("estimates:status", async ({ params, body }) => {
  const { status } = parseBody(statusBody, await body());
  return { data: await setEstimateStatus(params.id, status) };
});
