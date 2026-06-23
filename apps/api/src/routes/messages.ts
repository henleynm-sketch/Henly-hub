import { Router } from "express";
import { z } from "zod";
import { requireScope } from "../middleware/auth";
import { rateLimit, idempotency } from "../middleware/guards";
import { asyncHandler } from "../lib/handler";
import { ok } from "../lib/envelope";
import { parseBody, createMessage } from "@repo/services";

export const messagesRouter = Router();

const createMessageBody = z.object({
  threadId: z.string().min(1),
  body: z.string().min(1),
  authorId: z.string().nullish(),
  fromName: z.string().optional(),
  direction: z.enum(["IN", "OUT"]).optional(),
  channel: z.string().optional(),
});

// POST /api/v1/messages
messagesRouter.post(
  "/",
  requireScope("messages:write"),
  rateLimit,
  idempotency,
  asyncHandler(async (req, res) => {
    const input = parseBody(createMessageBody, req.body);
    const message = await createMessage(input);
    res.status(201).json(ok(message));
  })
);
