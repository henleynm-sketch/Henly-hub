import { prisma } from "@repo/db";
import { NotFoundError, ValidationError } from "./errors";

export const DOCUMENT_KINDS = ["CONTRACT", "PLAN", "PERMIT", "INVOICE", "PHOTO", "OTHER"] as const;

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

export async function setFileVisibility(id: string, clientVisible: boolean) {
  await getFileById(id);
  return prisma.document.update({ where: { id }, data: { clientVisible } });
}

export async function deleteFile(id: string) {
  const doc = await getFileById(id);
  await prisma.document.delete({ where: { id } });
  return doc;
}
