import { Router } from "express";
import { requireScope } from "../middleware/auth";
import { rateLimit } from "../middleware/guards";
import { asyncHandler, reqUrl } from "../lib/handler";
import { ok } from "../lib/envelope";
import { parsePagination, listThreads, listThreadMessages } from "@repo/services";

export const threadsRouter = Router();

// GET /api/v1/threads
threadsRouter.get(
  "/",
  requireScope("threads:read"),
  rateLimit,
  asyncHandler(async (req, res) => {
    const url = reqUrl(req);
    const clientId = url.searchParams.get("clientId") || undefined;
    const channel = url.searchParams.get("channel") || undefined;
    const { items, nextCursor } = await listThreads(parsePagination(url), { clientId, channel });
    res.json(ok(items, { nextCursor }));
  })
);

// GET /api/v1/threads/:id/messages
threadsRouter.get(
  "/:id/messages",
  requireScope("messages:read"),
  rateLimit,
  asyncHandler(async (req, res) => {
    const { items, nextCursor } = await listThreadMessages(req.params.id, parsePagination(reqUrl(req)));
    res.json(ok(items, { nextCursor }));
  })
);
