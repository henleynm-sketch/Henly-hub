import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { resolveDownloadUrl } from "@/lib/services/fileService";
import { canViewAllProjects, type Role } from "@/lib/roles";

// Internal, session-authenticated document download. Resolves the document to a
// short-lived presigned URL (object storage) or its local path, after applying
// the same role visibility rules as the Files page. Never exposes the raw key.
const SUB_KINDS = ["PLAN", "PERMIT", "PHOTO", "OTHER"];

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = session.user.role as Role;
  const { id } = await ctx.params;

  const doc = await prisma.document.findUnique({
    where: { id },
    include: { project: { select: { clientId: true, assignments: { select: { userId: true } } } } },
  });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const assigned = doc.project?.assignments.some((a) => a.userId === session.user.id) ?? false;
  let allowed = false;
  if (canViewAllProjects(role)) {
    allowed = true;
  } else if (role === "CLIENT") {
    allowed = doc.clientVisible && !!doc.project && session.user.clientId === doc.project.clientId;
  } else if (role === "FIELD") {
    allowed = assigned;
  } else if (role === "SUB") {
    allowed = assigned && SUB_KINDS.includes(doc.kind);
  }
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const target = await resolveDownloadUrl(doc);
  if (!target) return NextResponse.json({ error: "File has no stored content" }, { status: 404 });

  // Presigned URLs are absolute; local paths are relative to this origin.
  const absolute = new URL(target, _req.url).toString();
  return NextResponse.redirect(absolute, 302);
}
