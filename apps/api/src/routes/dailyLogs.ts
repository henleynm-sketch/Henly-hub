import { Router } from "express";
import { z } from "zod";
import { requireScope } from "../middleware/auth";
import { rateLimit, idempotency } from "../middleware/guards";
import { asyncHandler } from "../lib/handler";
import { ok } from "../lib/envelope";
import { parseBody, createDailyLog, getDailyLogById } from "@repo/services";

export const dailyLogsRouter = Router();

const createDailyLogBody = z.object({
  projectId: z.string().min(1),
  authorId: z.string().min(1),
  notes: z.string().min(1),
  weather: z.string().nullish(),
  crewOnSite: z.string().nullish(),
  hoursWorked: z.number().nonnegative().nullish(),
  clientVisible: z.boolean().optional(),
  photos: z.array(z.string()).nullish(),
});

// POST /api/v1/daily-logs
dailyLogsRouter.post(
  "/",
  requireScope("daily-logs:write"),
  rateLimit,
  idempotency,
  asyncHandler(async (req, res) => {
    const input = parseBody(createDailyLogBody, req.body);
    const log = await createDailyLog(input);
    res.status(201).json(ok(log));
  })
);

// GET /api/v1/daily-logs/:id
dailyLogsRouter.get(
  "/:id",
  requireScope("daily-logs:read"),
  rateLimit,
  asyncHandler(async (req, res) => {
    res.json(ok(await getDailyLogById(req.params.id)));
  })
);
