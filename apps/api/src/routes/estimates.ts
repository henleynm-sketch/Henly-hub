import { Router } from "express";
import { z } from "zod";
import { requireScope } from "../middleware/auth";
import { rateLimit, idempotency } from "../middleware/guards";
import { asyncHandler, reqUrl } from "../lib/handler";
import { ok } from "../lib/envelope";
import {
  parseBody,
  parsePagination,
  listEstimates,
  createEstimate,
  getEstimateById,
  updateEstimate,
  setEstimateStatus,
} from "@repo/services";

export const estimatesRouter = Router();

estimatesRouter.get(
  "/",
  requireScope("estimates:read"),
  rateLimit,
  asyncHandler(async (req, res) => {
    const { items, nextCursor } = await listEstimates(parsePagination(reqUrl(req)));
    res.json(ok(items, { nextCursor }));
  })
);

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

estimatesRouter.post(
  "/",
  requireScope("estimates:write"),
  rateLimit,
  idempotency,
  asyncHandler(async (req, res) => {
    const input = parseBody(createEstimateBody, req.body);
    const estimate = await createEstimate(input);
    res.status(201).json(ok(estimate));
  })
);

estimatesRouter.get(
  "/:id",
  requireScope("estimates:read"),
  rateLimit,
  asyncHandler(async (req, res) => {
    res.json(ok(await getEstimateById(req.params.id)));
  })
);

const updateEstimateBody = z.object({
  title: z.string().min(1).optional(),
  notes: z.string().nullish(),
});

estimatesRouter.patch(
  "/:id",
  requireScope("estimates:write"),
  rateLimit,
  idempotency,
  asyncHandler(async (req, res) => {
    const input = parseBody(updateEstimateBody, req.body);
    res.json(ok(await updateEstimate(req.params.id, input)));
  })
);

const statusBody = z.object({ status: z.string().min(1) });

// status value is validated inside setEstimateStatus (→ 400 on invalid).
estimatesRouter.post(
  "/:id/status",
  requireScope("estimates:status"),
  rateLimit,
  idempotency,
  asyncHandler(async (req, res) => {
    const { status } = parseBody(statusBody, req.body);
    res.json(ok(await setEstimateStatus(req.params.id, status)));
  })
);
