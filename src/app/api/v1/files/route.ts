import { z } from "zod";
import { apiRoute } from "@/lib/api/handler";
import { parseBody } from "@/lib/api/validation";
import { ValidationError } from "@/lib/api/errors";
import { createFileMetadata, storeFileBinary } from "@/lib/services/fileService";
import { isStorageConfigured } from "@/lib/storage";

// kind is validated inside the service (→ 400 on invalid).
const createFileBody = z.object({
  projectId: z.string().min(1),
  kind: z.string().min(1),
  name: z.string().min(1),
  sizeBytes: z.number().int().nonnegative().nullish(),
  mimeType: z.string().nullish(),
  visibleToClient: z.boolean().optional(),
});

// Two modes:
//  - multipart/form-data with a `file` part → stores the binary (S3/R2 or local
//    disk fallback) and returns a real, non-pending Document.
//  - application/json → registers metadata only (no binary), staying pending.
export const POST = apiRoute("files:write", async ({ req, body }) => {
  const contentType = req.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      throw new ValidationError("file is required", { file: ["required"] });
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    const doc = await storeFileBinary({
      projectId: String(form.get("projectId") || ""),
      kind: String(form.get("kind") || "OTHER"),
      name: String(form.get("name") || file.name),
      bytes,
      mimeType: file.type || null,
      sizeBytes: file.size,
      clientVisible: form.get("visibleToClient") === "true" || form.get("visibleToClient") === "on",
    });
    return { data: { ...doc, storageStatus: doc.storageKey ? "stored_object" : "stored_local" }, status: 201 };
  }

  const input = parseBody(createFileBody, await body());
  const doc = await createFileMetadata(input);
  return {
    data: {
      ...doc,
      storageStatus: isStorageConfigured() ? "pending_no_binary" : "pending_no_backend",
    },
    status: 201,
  };
});
