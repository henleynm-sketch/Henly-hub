import { Router } from "express";
import { z } from "zod";
import { requireScope } from "../middleware/auth";
import { rateLimit, idempotency } from "../middleware/guards";
import { asyncHandler } from "../lib/handler";
import { ok } from "../lib/envelope";
import { parseBody, createFileMetadata, getFileById } from "@repo/services";

// TODO: when cloud storage (S3/R2/Azure Blob) is configured, add
// PUT /api/v1/files/:id/content for the binary upload. For now this endpoint
// only registers metadata; the file does not exist anywhere.
export const filesRouter = Router();

const createFileBody = z.object({
  projectId: z.string().min(1),
  kind: z.string().min(1),
  name: z.string().min(1),
  sizeBytes: z.number().int().nonnegative().nullish(),
  mimeType: z.string().nullish(),
  visibleToClient: z.boolean().optional(),
});

// POST /api/v1/files — kind is validated inside createFileMetadata (→ 400).
filesRouter.post(
  "/",
  requireScope("files:write"),
  rateLimit,
  idempotency,
  asyncHandler(async (req, res) => {
    const input = parseBody(createFileBody, req.body);
    const doc = await createFileMetadata(input);
    // Binary storage is not wired — the row is metadata-only (url empty, pending).
    res.status(201).json(ok({ ...doc, storageStatus: "pending_no_backend" }));
  })
);

// GET /api/v1/files/:id
filesRouter.get(
  "/:id",
  requireScope("files:read"),
  rateLimit,
  asyncHandler(async (req, res) => {
    res.json(ok(await getFileById(req.params.id)));
  })
);
