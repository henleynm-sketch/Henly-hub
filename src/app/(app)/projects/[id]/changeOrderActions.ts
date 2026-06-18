"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canSeeFinancials, canViewAllProjects, type Role } from "@/lib/roles";
import { revalidatePath } from "next/cache";
import {
  createChangeOrder as createCO,
  sendChangeOrder as sendCO,
  approveChangeOrder as approveCO,
  declineChangeOrder as declineCO,
} from "@/lib/services/changeOrderService";

export type ChangeOrderResult = { ok: boolean; error?: string };

// --- module-scope authz helpers (never define these inside an action body) ---

async function session() {
  const me = await auth();
  return me?.user ? me.user : null;
}

// Office/CEO who can also reach this project. canViewAllProjects covers CEO/OFFICE;
// the assignment fallback keeps the rule honest if finance access ever widens.
async function internalForProject(projectId: string) {
  const user = await session();
  if (!user) return null;
  const role = user.role as Role;
  if (!canSeeFinancials(role)) return null;
  if (!canViewAllProjects(role)) {
    const assigned = await prisma.projectAssignment.findFirst({
      where: { projectId, userId: user.id },
    });
    if (!assigned) return null;
  }
  return user;
}

// A decision (approve/decline) may come from the project's own client on a
// client-visible change order, or from internal finance staff recording it.
async function deciderForChangeOrder(changeOrderId: string) {
  const user = await session();
  if (!user) return null;
  const co = await prisma.changeOrder.findUnique({
    where: { id: changeOrderId },
    include: { project: { select: { id: true, clientId: true } } },
  });
  if (!co) return null;
  const role = user.role as Role;

  if (role === "CLIENT") {
    if (!co.clientVisible) return null;
    if (user.clientId !== co.project.clientId) return null;
    return { user, co };
  }
  if (canSeeFinancials(role)) {
    if (!canViewAllProjects(role)) {
      const assigned = await prisma.projectAssignment.findFirst({
        where: { projectId: co.projectId, userId: user.id },
      });
      if (!assigned) return null;
    }
    return { user, co };
  }
  return null;
}

function fail(e: unknown): ChangeOrderResult {
  return { ok: false, error: e instanceof Error ? e.message : "Something went wrong" };
}

// --- actions ---

export async function createChangeOrder(formData: FormData): Promise<ChangeOrderResult> {
  const projectId = String(formData.get("projectId") || "");
  const user = await internalForProject(projectId);
  if (!user) return { ok: false, error: "Not authorized" };

  const amountDollars = Number(formData.get("amount") || NaN);
  if (!Number.isFinite(amountDollars)) return { ok: false, error: "Enter a dollar amount" };
  const amountCents = Math.round(amountDollars * 100);

  try {
    await createCO({
      projectId,
      createdById: user.id,
      title: String(formData.get("title") || ""),
      description: String(formData.get("description") || "") || null,
      amountCents,
      clientVisible: formData.get("clientVisible") === "on",
    });
  } catch (e) {
    return fail(e);
  }
  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

export async function sendChangeOrder(formData: FormData): Promise<ChangeOrderResult> {
  const id = String(formData.get("id") || "");
  const projectId = String(formData.get("projectId") || "");
  const user = await internalForProject(projectId);
  if (!user) return { ok: false, error: "Not authorized" };

  try {
    const co = await prisma.changeOrder.findUnique({ where: { id }, select: { projectId: true } });
    if (!co || co.projectId !== projectId) return { ok: false, error: "Change order not found" };
    await sendCO(id);
  } catch (e) {
    return fail(e);
  }
  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

export async function approveChangeOrder(formData: FormData): Promise<ChangeOrderResult> {
  const id = String(formData.get("id") || "");
  const decider = await deciderForChangeOrder(id);
  if (!decider) return { ok: false, error: "Not authorized" };

  try {
    await approveCO(id, decider.user.name ?? "");
  } catch (e) {
    return fail(e);
  }
  revalidatePath(`/projects/${decider.co.projectId}`);
  return { ok: true };
}

export async function declineChangeOrder(formData: FormData): Promise<ChangeOrderResult> {
  const id = String(formData.get("id") || "");
  const decider = await deciderForChangeOrder(id);
  if (!decider) return { ok: false, error: "Not authorized" };

  try {
    await declineCO(id, decider.user.name ?? "");
  } catch (e) {
    return fail(e);
  }
  revalidatePath(`/projects/${decider.co.projectId}`);
  return { ok: true };
}
