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

export type BulkEngagementResult = {
  ok: boolean;
  error?: string;
  created?: number;
  linked?: number;
  skipped?: number;
};

// Already-linked jobs are always skipped and counted — never silently
// re-linked to a different project.

export async function bulkCreateEngagementPerJob(jobIds: string[]): Promise<BulkEngagementResult> {
  const me = await office();
  if (!me) return { ok: false, error: "Not authorized" };
  const ids = [...new Set(jobIds.map(String).filter(Boolean))];
  if (ids.length === 0) return { ok: false, error: "No jobs selected" };

  let created = 0;
  let linked = 0;
  let skipped = 0;
  for (const id of ids) {
    const job = await prisma.project.findUnique({ where: { id } });
    if (!job || job.engagementId) {
      skipped++;
      continue;
    }
    const e = await prisma.engagement.create({
      data: {
        name: job.name,
        clientId: job.clientId,
        description: job.description,
        status: job.status === "CLOSED" ? "COMPLETE" : "ACTIVE",
      },
    });
    // Guarded write: only claims a still-unlinked job, so a concurrent link
    // elsewhere is skipped instead of overwritten.
    const claimed = await prisma.project.updateMany({
      where: { id: job.id, engagementId: null },
      data: { engagementId: e.id },
    });
    if (claimed.count === 0) {
      await prisma.engagement.delete({ where: { id: e.id } }).catch(() => {});
      skipped++;
      continue;
    }
    created++;
    linked++;
  }
  revalidatePath("/jobs/projects");
  revalidatePath("/jobs/list");
  revalidatePath("/jobs");
  return { ok: true, created, linked, skipped };
}

export async function bulkGroupIntoEngagement(
  jobIds: string[],
  name: string,
): Promise<BulkEngagementResult> {
  const me = await office();
  if (!me) return { ok: false, error: "Not authorized" };
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Project name is required" };
  const ids = [...new Set(jobIds.map(String).filter(Boolean))];
  if (ids.length === 0) return { ok: false, error: "No jobs selected" };

  const jobs = await prisma.project.findMany({ where: { id: { in: ids } } });
  const eligible = jobs.filter((j) => !j.engagementId);
  const skipped = ids.length - eligible.length;
  if (eligible.length === 0) {
    return { ok: false, error: "All selected jobs are already linked to a project" };
  }
  const clientIds = new Set(eligible.map((j) => j.clientId));
  if (clientIds.size > 1) {
    return { ok: false, error: "Selected jobs belong to different clients — a project has one client" };
  }

  const e = await prisma.engagement.create({
    data: { name: trimmed, clientId: eligible[0].clientId },
  });
  let linked = 0;
  for (const j of eligible) {
    // Guarded write — a job linked concurrently since the eligibility read is
    // skipped, never stolen into the new project.
    const claimed = await prisma.project.updateMany({
      where: { id: j.id, engagementId: null },
      data: { engagementId: e.id },
    });
    linked += claimed.count;
  }
  if (linked === 0) {
    await prisma.engagement.delete({ where: { id: e.id } }).catch(() => {});
    return { ok: false, error: "All selected jobs are already linked to a project" };
  }
  revalidatePath("/jobs/projects");
  revalidatePath("/jobs/list");
  revalidatePath("/jobs");
  return { ok: true, created: 1, linked, skipped: skipped + (eligible.length - linked) };
}
