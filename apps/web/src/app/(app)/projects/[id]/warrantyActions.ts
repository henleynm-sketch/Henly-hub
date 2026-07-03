"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import type { Role } from "@/lib/roles";
import { WARRANTY_PHASE, isValidWarrantyPhase } from "@/lib/taxonomy";

export type WarrantyResult = { ok: boolean; error?: string };

async function getMe() {
  const session = await auth();
  if (!session?.user) return null;
  return session.user as { id: string; role: string };
}

function isManager(role: Role) {
  return role === "CEO" || role === "OFFICE";
}

// ─── Phase advancement ────────────────────────────────────────────────────────

export async function advanceWarrantyPhase(
  projectId: string
): Promise<WarrantyResult> {
  const me = await getMe();
  if (!me || !isManager(me.role as Role)) return { ok: false, error: "Not authorized" };

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, warrantyPhase: true },
  });
  if (!project) return { ok: false, error: "Project not found" };

  const currentIdx = project.warrantyPhase
    ? WARRANTY_PHASE.indexOf(project.warrantyPhase as typeof WARRANTY_PHASE[number])
    : -1;

  if (currentIdx >= WARRANTY_PHASE.length - 1) {
    return { ok: false, error: "Already at final warranty phase" };
  }

  const nextPhase = WARRANTY_PHASE[currentIdx + 1];
  await prisma.project.update({
    where: { id: projectId },
    data: { warrantyPhase: nextPhase },
  });
  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

export async function setWarrantyPhase(
  projectId: string,
  phase: string
): Promise<WarrantyResult> {
  const me = await getMe();
  if (!me || !isManager(me.role as Role)) return { ok: false, error: "Not authorized" };

  if (!isValidWarrantyPhase(phase)) return { ok: false, error: "Invalid warranty phase" };

  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true } });
  if (!project) return { ok: false, error: "Project not found" };

  await prisma.project.update({ where: { id: projectId }, data: { warrantyPhase: phase } });
  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

// ─── Deficiency CRUD ──────────────────────────────────────────────────────────

export async function createDeficiency(
  projectId: string,
  formData: FormData
): Promise<WarrantyResult> {
  const me = await getMe();
  if (!me || !isManager(me.role as Role)) return { ok: false, error: "Not authorized" };

  const title         = String(formData.get("title")       || "").trim();
  const description   = String(formData.get("description") || "").trim() || null;
  const clientVisible = formData.get("clientVisible") === "true";

  if (!title) return { ok: false, error: "Title is required" };

  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true } });
  if (!project) return { ok: false, error: "Project not found" };

  await prisma.warrantyItem.create({
    data: { projectId, title, description, clientVisible },
  });
  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

export async function updateDeficiency(
  itemId: string,
  formData: FormData
): Promise<WarrantyResult> {
  const me = await getMe();
  if (!me || !isManager(me.role as Role)) return { ok: false, error: "Not authorized" };

  const title         = String(formData.get("title")       || "").trim();
  const description   = String(formData.get("description") || "").trim() || null;
  const clientVisible = formData.get("clientVisible") === "true";

  if (!title) return { ok: false, error: "Title is required" };

  const item = await prisma.warrantyItem.findUnique({ where: { id: itemId } });
  if (!item) return { ok: false, error: "Item not found" };

  await prisma.warrantyItem.update({
    where: { id: itemId },
    data: { title, description, clientVisible },
  });
  revalidatePath(`/projects/${item.projectId}`);
  return { ok: true };
}

export async function resolveDeficiency(itemId: string): Promise<WarrantyResult> {
  const me = await getMe();
  if (!me || !isManager(me.role as Role)) return { ok: false, error: "Not authorized" };

  const item = await prisma.warrantyItem.findUnique({ where: { id: itemId } });
  if (!item) return { ok: false, error: "Item not found" };
  if (item.status === "resolved") return { ok: false, error: "Already resolved" };

  await prisma.warrantyItem.update({
    where: { id: itemId },
    data: { status: "resolved", resolvedAt: new Date() },
  });
  revalidatePath(`/projects/${item.projectId}`);
  return { ok: true };
}

export async function reopenDeficiency(itemId: string): Promise<WarrantyResult> {
  const me = await getMe();
  if (!me || !isManager(me.role as Role)) return { ok: false, error: "Not authorized" };

  const item = await prisma.warrantyItem.findUnique({ where: { id: itemId } });
  if (!item) return { ok: false, error: "Item not found" };

  await prisma.warrantyItem.update({
    where: { id: itemId },
    data: { status: "open", resolvedAt: null },
  });
  revalidatePath(`/projects/${item.projectId}`);
  return { ok: true };
}

export async function deleteDeficiency(itemId: string): Promise<WarrantyResult> {
  const me = await getMe();
  if (!me || !isManager(me.role as Role)) return { ok: false, error: "Not authorized" };

  const item = await prisma.warrantyItem.findUnique({ where: { id: itemId } });
  if (!item) return { ok: false, error: "Item not found" };

  await prisma.warrantyItem.delete({ where: { id: itemId } });
  revalidatePath(`/projects/${item.projectId}`);
  return { ok: true };
}

// ─── Client: flag a deficiency ────────────────────────────────────────────────
// Clients can report a deficiency on their own project; always clientVisible.

export async function flagDeficiency(
  projectId: string,
  formData: FormData
): Promise<WarrantyResult> {
  const me = await getMe();
  if (!me) return { ok: false, error: "Not authorized" };
  if ((me.role as Role) !== "CLIENT") return { ok: false, error: "Not authorized" };

  const title       = String(formData.get("title")       || "").trim();
  const description = String(formData.get("description") || "").trim() || null;
  if (!title) return { ok: false, error: "Title is required" };

  // Look up the client record associated with this user
  const user = await prisma.user.findUnique({
    where: { id: me.id },
    select: { clientId: true },
  });
  if (!user?.clientId) return { ok: false, error: "No client record found" };

  // Verify the project belongs to this client
  const project = await prisma.project.findFirst({
    where: { id: projectId, clientId: user.clientId },
    select: { id: true },
  });
  if (!project) return { ok: false, error: "Project not found" };

  await prisma.warrantyItem.create({
    data: { projectId, title, description, clientVisible: true, status: "open" },
  });
  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}
