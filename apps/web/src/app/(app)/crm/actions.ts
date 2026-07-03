"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  isValidPipelineStage,
  isValidLeadSource,
} from "@/lib/taxonomy";
import { revalidatePath } from "next/cache";

// ── Existing actions ──────────────────────────────────────────────────────────

export async function setPipelineStage(
  projectId: string,
  stage: string
): Promise<void> {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const role = (session.user as { role?: string }).role ?? "";
  if (role !== "OFFICE" && role !== "CEO")
    throw new Error("Forbidden: office or CEO only");
  if (!isValidPipelineStage(stage)) throw new Error("Invalid pipeline stage");
  await prisma.project.update({
    where: { id: projectId },
    data: { pipelineStage: stage },
  });
  revalidatePath("/crm");
  revalidatePath(`/crm/${projectId}`);
}

export async function setLeadSource(
  clientId: string,
  source: string
): Promise<void> {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const role = (session.user as { role?: string }).role ?? "";
  if (role !== "OFFICE" && role !== "CEO")
    throw new Error("Forbidden: office or CEO only");
  if (!isValidLeadSource(source)) throw new Error("Invalid lead source");
  await prisma.client.update({
    where: { id: clientId },
    data: { leadSource: source },
  });
  revalidatePath("/crm");
}

// ── Log activity (note / call / meeting) ─────────────────────────────────────

const VALID_ACTIVITY_TYPES = ["NOTE", "CALL", "MEETING"] as const;
type ActivityType = (typeof VALID_ACTIVITY_TYPES)[number];

export async function logActivity(input: {
  type: string;
  body: string;
  occurredAt?: Date;
  clientId?: string | null;
  projectId?: string | null;
}): Promise<void> {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const role = (session.user as { role?: string }).role ?? "";
  if (role !== "OFFICE" && role !== "CEO")
    throw new Error("Forbidden: office or CEO only");

  if (!(VALID_ACTIVITY_TYPES as readonly string[]).includes(input.type))
    throw new Error("Invalid activity type");

  if (!input.clientId && !input.projectId)
    throw new Error("Must provide clientId or projectId");

  const body = input.body.trim();
  if (!body) throw new Error("Activity body cannot be empty");

  const authorId = (session.user as { id?: string }).id ?? "";
  if (!authorId) throw new Error("Cannot resolve session user ID");

  await prisma.crmActivity.create({
    data: {
      type: input.type as ActivityType,
      body,
      occurredAt: input.occurredAt ?? new Date(),
      authorId,
      clientId: input.clientId ?? null,
      projectId: input.projectId ?? null,
    },
  });

  if (input.clientId) revalidatePath(`/clients/${input.clientId}`);
  if (input.projectId) revalidatePath(`/crm/${input.projectId}`);
}

// ── Quick-add lead (client + deal at New Lead stage) ─────────────────────────

export async function createLead(input: {
  name: string;
  email?: string;
  phone?: string;
  leadSource?: string;
}): Promise<{ clientId: string; projectId: string }> {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const role = (session.user as { role?: string }).role ?? "";
  if (role !== "OFFICE" && role !== "CEO")
    throw new Error("Forbidden: office or CEO only");

  const name = input.name.trim();
  if (!name) throw new Error("Name is required");

  const client = await prisma.client.create({
    data: {
      name,
      primaryEmail: input.email?.trim() || null,
      primaryPhone: input.phone?.trim() || null,
      leadSource: input.leadSource || null,
      stage: "LEAD",
    },
  });

  const project = await prisma.project.create({
    data: {
      clientId: client.id,
      name: `${name} — New Project`,
      status: "PRESALE",
      pipelineStage: "New Lead",
    },
  });

  revalidatePath("/crm");
  return { clientId: client.id, projectId: project.id };
}
