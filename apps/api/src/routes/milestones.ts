import { Router } from "express";
import { z } from "zod";
import { requireScope } from "../middleware/auth";
import { rateLimit, idempotency } from "../middleware/guards";
import { asyncHandler } from "../lib/handler";
import { ok } from "../lib/envelope";
import { parseBody, createMilestone, completeMilestone } from "@repo/services";

export const milestonesRouter = Router();

const createMilestoneBody = z.object({
  projectId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().nullish(),
  dueDate: z.string().datetime().nullish(),
  clientVisible: z.boolean().optional(),
  order: z.number().int().optional(),
});

// POST /api/v1/milestones
milestonesRouter.post(
  "/",
  requireScope("milestones:write"),
  rateLimit,
  idempotency,
  asyncHandler(async (req, res) => {
    const input = parseBody(createMilestoneBody, req.body);
    const milestone = await createMilestone(input);
    res.status(201).json(ok(milestone));
  })
);

// POST /api/v1/milestones/:id/complete
milestonesRouter.post(
  "/:id/complete",
  requireScope("milestones:complete"),
  rateLimit,
  idempotency,
  asyncHandler(async (req, res) => {
    res.json(ok(await completeMilestone(req.params.id)));
  })
);
