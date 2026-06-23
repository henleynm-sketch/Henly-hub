import { Router } from "express";
import { z } from "zod";
import { requireScope } from "../middleware/auth";
import { rateLimit, idempotency } from "../middleware/guards";
import { asyncHandler, reqUrl } from "../lib/handler";
import { ok } from "../lib/envelope";
import { parseBody, parsePagination, listTimeEntries, createTimeEntry, approveTimeEntry } from "@repo/services";

export const timeEntriesRouter = Router();

// GET /api/v1/time-entries
timeEntriesRouter.get(
  "/",
  requireScope("time-entries:read"),
  rateLimit,
  asyncHandler(async (req, res) => {
    const url = reqUrl(req);
    const projectId = url.searchParams.get("projectId") || undefined;
    const userId = url.searchParams.get("userId") || undefined;
    const approvedParam = url.searchParams.get("approved");
    const approved = approvedParam == null ? undefined : approvedParam === "true";
    const { items, nextCursor } = await listTimeEntries(parsePagination(url), { projectId, userId, approved });
    res.json(ok(items, { nextCursor }));
  })
);

const createTimeEntryBody = z.object({
  userId: z.string().min(1),
  projectId: z.string().min(1),
  costCode: z.string().min(1),
  clockIn: z.string().datetime().optional(),
  clockOut: z.string().datetime().nullish(),
  hours: z.number().nonnegative().nullish(),
});

// POST /api/v1/time-entries
timeEntriesRouter.post(
  "/",
  requireScope("time-entries:write"),
  rateLimit,
  idempotency,
  asyncHandler(async (req, res) => {
    const input = parseBody(createTimeEntryBody, req.body);
    const entry = await createTimeEntry(input);
    res.status(201).json(ok(entry));
  })
);

// POST /api/v1/time-entries/:id/approve
// API consumers operate as a system user — approvedById is null. The QBO push
// stays in the internal flow (guardrail): API approve does NOT push to QBO.
timeEntriesRouter.post(
  "/:id/approve",
  requireScope("time-entries:approve"),
  rateLimit,
  idempotency,
  asyncHandler(async (req, res) => {
    res.json(ok(await approveTimeEntry(req.params.id, null)));
  })
);
