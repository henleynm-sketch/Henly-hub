import { z } from "zod";
import { apiRoute } from "@/lib/api/handler";
import { parseBody } from "@/lib/api/validation";
import { createDailyLog } from "@/lib/services/dailyLogService";

const createDailyLogBody = z.object({
  projectId: z.string().min(1),
  authorId: z.string().min(1),
  notes: z.string().min(1),
  weather: z.string().nullish(),
  crewOnSite: z.string().nullish(),
  hoursWorked: z.number().nonnegative().nullish(),

  clientVisible: z.boolean().optional(),
  photos: z.array(z.string()).nullish(),
  // P7 structured fields
  anticipatedDelays: z.boolean().optional(),
  materialDeliveries: z.boolean().optional(),
  safetyIncidents: z.string().nullish(),
  tradesOnsite: z.string().nullish(),
  unplannedTasks: z.string().nullish(),
  internalNotes: z.string().nullish(),
});

export const POST = apiRoute("daily-logs:write", async ({ body }) => {
  const input = parseBody(createDailyLogBody, await body());
  const log = await createDailyLog(input);
  return { data: log, status: 201 };
});
