// TODO: when cloud storage (S3/R2/Azure Blob) is configured, add
// PUT /api/v1/files/[id]/content for the binary upload. For now this
// endpoint only registers metadata; the file does not exist anywhere.
import { z } from "zod";
import { apiRoute } from "@/lib/api/handler";
import { parseBody } from "@/lib/api/validation";
import { createFileMetadata } from "@/lib/services/fileService";

// kind is validated inside createFileMetadata (→ 400 on invalid).
const createFileBody = z.object({
  projectId: z.string().min(1),
  kind: z.string().min(1),
  name: z.string().min(1),
  sizeBytes: z.number().int().nonnegative().nullish(),
  mimeType: z.string().nullish(),
  visibleToClient: z.boolean().optional(),
});

export const POST = apiRoute("files:write", async ({ body }) => {
  const input = parseBody(createFileBody, await body());
  const doc = await createFileMetadata(input);
  // Binary storage is not wired — the row is metadata-only (url empty, pending).
  return { data: { ...doc, storageStatus: "pending_no_backend" }, status: 201 };
});
