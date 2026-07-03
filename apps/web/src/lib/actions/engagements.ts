"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/roles";
import { revalidatePath } from "next/cache";

/**
 * Engagements — the UI-facing "Projects" that group Jobs (legacy Project
 * model). Grouping is by client engagement/contract, assigned manually;
 * nothing is auto-grouped (no fabricated engagement boundaries).
 */

export type EngagementActionResult = { ok: boolean; error?: string; id?: string };

async function office() {
  const me = await auth();
  if (!me?.user) return null;
  const role = me.user.role as Role;
  if (role !== "CEO" && role !== "OFFICE") return null;
  return me;
}

const ENGAGEMENT_STATUSES = ["ACTIVE", "COMPLETE", "ON_HOLD"];

export async function createEngagement(formData: FormData): Promise<EngagementActionResult> {
  const me = await office();
  if (!me) return { ok: false, error: "Not authorized" };
  const name = String(formData.get("name") || "").trim();
  const clientId = String(formData.get("clientId") || "");
  if (!name || !clientId) return { ok: false, error: "Name and client are required" };
  if (!(await prisma.client.findUnique({ where: { id: clientId } }))) {
    return { ok: false, error: "Unknown client" };
  }
  const e = await prisma.engagement.create({
    data: {
      name,
      clientId,
      description: String(formData.get("description") || "").trim() || null,
    },
  });
  // Optionally attach initial jobs (same-client only, enforced below).
  const jobIds = formData.getAll("jobIds").map(String).filter(Boolean);
  for (const jobId of jobIds) {
    await attachJobInternal(e.id, jobId);
  }
  revalidatePath("/jobs/projects");
  return { ok: true, id: e.id };
}

export async function updateEngagement(formData: FormData): Promise<EngagementActionResult> {
  const me = await office();
  if (!me) return { ok: false, error: "Not authorized" };
  const id = String(formData.get("id") || "");
  const e = await prisma.engagement.findUnique({ where: { id } });
  if (!e) return { ok: false, error: "Project not found" };
  const data: Record<string, unknown> = {};
  const name = String(formData.get("name") || "").trim();
  if (name) data.name = name;
  const status = String(formData.get("status") || "");
  if (status) {
    if (!ENGAGEMENT_STATUSES.includes(status)) return { ok: false, error: "Invalid status" };
    data.status = status;
  }
  if (formData.has("description")) {
    data.description = String(formData.get("description") || "").trim() || null;
  }
  await prisma.engagement.update({ where: { id }, data });
  revalidatePath("/jobs/projects");
  revalidatePath(`/jobs/projects/${id}`);
  return { ok: true, id };
}

async function attachJobInternal(engagementId: string, jobId: string): Promise<string | null> {
  const [engagement, job] = await Promise.all([
    prisma.engagement.findUnique({ where: { id: engagementId } }),
    prisma.project.findUnique({ where: { id: jobId } }),
  ]);
  if (!engagement) return "Project not found";
  if (!job) return "Job not found";
  if (job.clientId !== engagement.clientId) {
    return "Job belongs to a different client than this project";
  }
  await prisma.project.update({ where: { id: jobId }, data: { engagementId } });
  return null;
}

export async function attachJob(engagementId: string, jobId: string): Promise<EngagementActionResult> {
  const me = await office();
  if (!me) return { ok: false, error: "Not authorized" };
  const err = await attachJobInternal(engagementId, jobId);
  if (err) return { ok: false, error: err };
  revalidatePath("/jobs/projects");
  revalidatePath(`/jobs/projects/${engagementId}`);
  revalidatePath(`/jobs/${jobId}`);
  return { ok: true };
}

export async function detachJob(jobId: string): Promise<EngagementActionResult> {
  const me = await office();
  if (!me) return { ok: false, error: "Not authorized" };
  const job = await prisma.project.findUnique({ where: { id: jobId } });
  if (!job) return { ok: false, error: "Job not found" };
  const prev = job.engagementId;
  await prisma.project.update({ where: { id: jobId }, data: { engagementId: null } });
  revalidatePath("/jobs/projects");
  if (prev) revalidatePath(`/jobs/projects/${prev}`);
  revalidatePath(`/jobs/${jobId}`);
  return { ok: true };
}
