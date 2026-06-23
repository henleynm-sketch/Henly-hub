import "server-only";
import { randomUUID } from "crypto";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import type { Document } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { NotFoundError, ValidationError } from "@/lib/api/errors";
import { isStorageConfigured, putObject, getPresignedDownloadUrl } from "@/lib/storage";

export const DOCUMENT_KINDS = ["CONTRACT", "PLAN", "PERMIT", "INVOICE", "PHOTO", "OTHER"] as const;

const LOCAL_UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "documents");

export async function listProjectFiles(projectId: string) {
  return prisma.document.findMany({ where: { projectId }, orderBy: { createdAt: "desc" } });
}

export async function getFileById(id: string) {
  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) throw new NotFoundError("File not found");
  return doc;
}

export type CreateFileMetadataInput = {
  projectId: string;
  kind: string;
  name: string;
  sizeBytes?: number | null;
  mimeType?: string | null;
  visibleToClient?: boolean;
};

// Registers file METADATA only. Binary storage is not wired (no cloud backend),
// so the Document row is created with url="" and pending=true. See the v1 files
// route for the documented storage gap.
export async function createFileMetadata(input: CreateFileMetadataInput) {
  if (!input.projectId) throw new ValidationError("projectId is required", { projectId: ["required"] });
  if (!input.name?.trim()) throw new ValidationError("name is required", { name: ["required"] });
  const kind = (input.kind || "OTHER").toUpperCase();
  if (!(DOCUMENT_KINDS as readonly string[]).includes(kind)) {
    throw new ValidationError(`kind must be one of ${DOCUMENT_KINDS.join(", ")}`, { kind: ["invalid"] });
  }
  const project = await prisma.project.findUnique({ where: { id: input.projectId } });
  if (!project) throw new ValidationError("projectId does not reference an existing project", { projectId: ["not found"] });
  return prisma.document.create({
    data: {
      projectId: input.projectId,
      name: input.name.trim(),
      kind,
      url: "",
      mimeType: input.mimeType ?? null,
      pending: true,
      sizeBytes: input.sizeBytes ?? null,
      clientVisible: input.visibleToClient ?? false,
    },
  });
}

// Used by the existing internal upload flow, which writes the binary to disk
// first and passes a real url here.
export type CreateStoredFileInput = {
  projectId: string;
  name: string;
  kind: string;
  url: string;
  sizeBytes?: number | null;
  clientVisible?: boolean;
  uploadedById?: string | null;
};
export async function createStoredFile(input: CreateStoredFileInput) {
  return prisma.document.create({
    data: {
      projectId: input.projectId,
      name: input.name,
      kind: input.kind,
      url: input.url,
      sizeBytes: input.sizeBytes ?? null,
      clientVisible: input.clientVisible ?? false,
      uploadedById: input.uploadedById ?? null,
    },
  });
}

// Stores an uploaded binary and creates its Document row. When object storage is
// configured (STORAGE_* env), the bytes go to S3/R2 and we keep the object key;
// otherwise they fall back to local disk (public/uploads/documents) so dev works
// before any bucket keys exist. Either way pending=false — the file is real.
export type StoreFileBinaryInput = {
  projectId: string;
  name: string;
  kind: string;
  bytes: Buffer;
  mimeType?: string | null;
  sizeBytes?: number | null;
  clientVisible?: boolean;
  uploadedById?: string | null;
};

export async function storeFileBinary(input: StoreFileBinaryInput) {
  if (!input.projectId) throw new ValidationError("projectId is required", { projectId: ["required"] });
  if (!input.name?.trim()) throw new ValidationError("name is required", { name: ["required"] });
  const kind = (input.kind || "OTHER").toUpperCase();
  if (!(DOCUMENT_KINDS as readonly string[]).includes(kind)) {
    throw new ValidationError(`kind must be one of ${DOCUMENT_KINDS.join(", ")}`, { kind: ["invalid"] });
  }
  const project = await prisma.project.findUnique({ where: { id: input.projectId } });
  if (!project) throw new ValidationError("projectId does not reference an existing project", { projectId: ["not found"] });

  const ext = path.extname(input.name) || "";
  const base = {
    projectId: input.projectId,
    name: input.name.trim(),
    kind,
    mimeType: input.mimeType ?? null,
    sizeBytes: input.sizeBytes ?? input.bytes.byteLength,
    clientVisible: input.clientVisible ?? false,
    uploadedById: input.uploadedById ?? null,
    pending: false,
  };

  if (isStorageConfigured()) {
    const key = `documents/${input.projectId}/${randomUUID()}${ext}`;
    await putObject(key, input.bytes, input.mimeType);
    return prisma.document.create({ data: { ...base, url: "", storageKey: key } });
  }

  await mkdir(LOCAL_UPLOAD_DIR, { recursive: true });
  const filename = `${randomUUID()}${ext}`;
  await writeFile(path.join(LOCAL_UPLOAD_DIR, filename), new Uint8Array(input.bytes));
  return prisma.document.create({
    data: { ...base, url: `/uploads/documents/${filename}`, storageKey: null },
  });
}

// Resolves a viewable URL for a document, role-checking happens at the call site.
// Cloud objects get a short-lived presigned URL; local files return their path.
export async function resolveDownloadUrl(doc: Pick<Document, "url" | "storageKey">): Promise<string | null> {
  if (doc.storageKey) return getPresignedDownloadUrl(doc.storageKey);
  return doc.url || null;
}

export async function setFileVisibility(id: string, clientVisible: boolean) {
  await getFileById(id);
  return prisma.document.update({ where: { id }, data: { clientVisible } });
}

export async function deleteFile(id: string) {
  const doc = await getFileById(id);
  await prisma.document.delete({ where: { id } });
  return doc;
}
