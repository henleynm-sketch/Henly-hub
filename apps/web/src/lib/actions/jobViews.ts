"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canViewAllProjects, canManageTeam, type Role } from "@/lib/roles";
import { revalidatePath } from "next/cache";
import { JOB_STATUS } from "@/lib/taxonomy";
import { GROUP_AXES, isAxis, type GroupAxis, type JobViewDTO } from "@/lib/jobBoard";

/**
 * Saved views + drag persistence for the generalized Jobs board.
 * ownerId null = organization view (CEO-managed). Personal views belong to
 * their owner. Every mutation re-checks role and validates values against the
 * canonical taxonomy — the client is never trusted.
 */

export type ViewActionResult = { ok: boolean; error?: string; views?: JobViewDTO[] };

function toDTO(v: {
  id: string;
  name: string;
  ownerId: string | null;
  groupBy: string;
  filters: string | null;
  sortOrder: number;
}): JobViewDTO {
  let filters: JobViewDTO["filters"] = null;
  try {
    filters = v.filters ? JSON.parse(v.filters) : null;
  } catch {
    filters = null;
  }
  return {
    id: v.id,
    name: v.name,
    ownerId: v.ownerId,
    groupBy: isAxis(v.groupBy) ? v.groupBy : "status",
    filters,
    sortOrder: v.sortOrder,
  };
}

const PERSONAL_DEFAULTS: { name: string; groupBy: GroupAxis; filters?: object }[] = [
  { name: "Sales Pipeline", groupBy: "pipelineStage" },
  { name: "Construction Pipeline", groupBy: "constructionPhase" },
  { name: "Warranty & After-Sales", groupBy: "warrantyPhase" },
  { name: "Henley Capital — Development", groupBy: "division" },
];

const ORG_DEFAULTS: { name: string; groupBy: GroupAxis; filters?: object; sortOrder: number }[] = [
  { name: "All Jobs", groupBy: "status", sortOrder: 0 },
  { name: "Open Jobs", groupBy: "status", filters: { status: ["OPEN"] }, sortOrder: 1 },
  { name: "Closed Jobs", groupBy: "status", filters: { status: ["CLOSED"] }, sortOrder: 2 },
];

// List (and lazily seed) the views visible to the current user.
export async function listJobViews(): Promise<ViewActionResult> {
  const me = await auth();
  if (!me?.user) return { ok: false, error: "Not authorized" };
  const userId = me.user.id;

  try {
    const personalCount = await prisma.jobView.count({ where: { ownerId: userId } });
    if (personalCount === 0) {
      await prisma.jobView.createMany({
        data: PERSONAL_DEFAULTS.map((d, i) => ({
          name: d.name,
          ownerId: userId,
          groupBy: d.groupBy,
          filters: d.filters ? JSON.stringify(d.filters) : null,
          sortOrder: i,
        })),
      });
    }
    const orgCount = await prisma.jobView.count({ where: { ownerId: null } });
    if (orgCount === 0) {
      await prisma.jobView.createMany({
        data: ORG_DEFAULTS.map((d) => ({
          name: d.name,
          ownerId: null,
          groupBy: d.groupBy,
          filters: d.filters ? JSON.stringify(d.filters) : null,
          sortOrder: d.sortOrder,
        })),
      });
    }
    const views = await prisma.jobView.findMany({
      where: { OR: [{ ownerId: userId }, { ownerId: null }] },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
    return { ok: true, views: views.map(toDTO) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not load views" };
  }
}

async function canEditView(userId: string, role: Role, viewOwnerId: string | null): Promise<boolean> {
  if (viewOwnerId === null) return canManageTeam(role); // org views: CEO only
  return viewOwnerId === userId;
}

export async function createJobView(input: {
  name: string;
  groupBy: string;
  statusFilter?: string[];
  organization?: boolean;
}): Promise<ViewActionResult> {
  const me = await auth();
  if (!me?.user) return { ok: false, error: "Not authorized" };
  const role = me.user.role as Role;
  if (!canViewAllProjects(role)) return { ok: false, error: "Not authorized" };
  if (input.organization && !canManageTeam(role)) {
    return { ok: false, error: "Only the CEO can manage organization views" };
  }
  const name = input.name.trim();
  if (!name) return { ok: false, error: "Name is required" };
  if (!isAxis(input.groupBy)) return { ok: false, error: "Unknown group-by axis" };
  const statuses = (input.statusFilter ?? []).filter((s) =>
    (JOB_STATUS as readonly string[]).includes(s),
  );

  const ownerId = input.organization ? null : me.user.id;
  const max = await prisma.jobView.aggregate({ where: { ownerId }, _max: { sortOrder: true } });
  await prisma.jobView.create({
    data: {
      name,
      ownerId,
      groupBy: input.groupBy,
      filters: statuses.length ? JSON.stringify({ status: statuses }) : null,
      sortOrder: (max._max.sortOrder ?? -1) + 1,
    },
  });
  revalidatePath("/jobs/board");
  return listJobViews();
}

export async function updateJobView(input: {
  id: string;
  name?: string;
  groupBy?: string;
  statusFilter?: string[];
  sortOrder?: number;
}): Promise<ViewActionResult> {
  const me = await auth();
  if (!me?.user) return { ok: false, error: "Not authorized" };
  const view = await prisma.jobView.findUnique({ where: { id: input.id } });
  if (!view) return { ok: false, error: "View not found" };
  if (!(await canEditView(me.user.id, me.user.role as Role, view.ownerId))) {
    return { ok: false, error: "Not authorized to edit this view" };
  }
  const data: Record<string, unknown> = {};
  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) return { ok: false, error: "Name is required" };
    data.name = name;
  }
  if (input.groupBy !== undefined) {
    if (!isAxis(input.groupBy)) return { ok: false, error: "Unknown group-by axis" };
    data.groupBy = input.groupBy;
  }
  if (input.statusFilter !== undefined) {
    const statuses = input.statusFilter.filter((s) => (JOB_STATUS as readonly string[]).includes(s));
    data.filters = statuses.length ? JSON.stringify({ status: statuses }) : null;
  }
  if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder;
  await prisma.jobView.update({ where: { id: input.id }, data });
  revalidatePath("/jobs/board");
  return listJobViews();
}

export async function deleteJobView(id: string): Promise<ViewActionResult> {
  const me = await auth();
  if (!me?.user) return { ok: false, error: "Not authorized" };
  const view = await prisma.jobView.findUnique({ where: { id } });
  if (!view) return { ok: false, error: "View not found" };
  if (!(await canEditView(me.user.id, me.user.role as Role, view.ownerId))) {
    return { ok: false, error: "Not authorized to delete this view" };
  }
  await prisma.jobView.delete({ where: { id } });
  revalidatePath("/jobs/board");
  return listJobViews();
}

// Drag persistence: writes the underlying Project field. CEO/Office only —
// Hub-local write, no JobTread write-back (parked pending Nick's call).
export async function setProjectGroupField(
  projectId: string,
  axis: string,
  value: string | null,
): Promise<{ ok: boolean; error?: string }> {
  const me = await auth();
  if (!me?.user) return { ok: false, error: "Not authorized" };
  const role = me.user.role as Role;
  if (role !== "CEO" && role !== "OFFICE") return { ok: false, error: "Read-only for your role" };
  if (!isAxis(axis)) return { ok: false, error: `Unknown axis: ${axis}` };
  if (axis === "status" && value === null) {
    return { ok: false, error: "Status cannot be cleared" };
  }
  if (value !== null && !(GROUP_AXES[axis] as readonly string[]).includes(value)) {
    return { ok: false, error: `"${value}" is not a canonical ${axis} value` };
  }
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return { ok: false, error: "Project not found" };
  await prisma.project.update({ where: { id: projectId }, data: { [axis]: value } });
  {
    const { emitNotification } = await import("@/lib/notifications/dispatch");
    await emitNotification({
      eventType: "JOB_STAGE_CHANGED",
      actorId: me.user.id,
      jobId: projectId,
      payload: { axis, value },
    });
  }
  revalidatePath("/jobs/board");
  revalidatePath("/jobs");
  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

// Free-text job meta (PM / sales rep / customer PO / type) — CEO/Office only.
export async function setProjectMeta(
  projectId: string,
  input: { projectManager?: string; salesRep?: string; customerPO?: string; projectType?: string },
): Promise<{ ok: boolean; error?: string }> {
  const me = await auth();
  if (!me?.user) return { ok: false, error: "Not authorized" };
  const role = me.user.role as Role;
  if (role !== "CEO" && role !== "OFFICE") return { ok: false, error: "Not authorized" };
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return { ok: false, error: "Project not found" };

  const data: Record<string, string | null> = {};
  for (const k of ["projectManager", "salesRep", "customerPO", "projectType"] as const) {
    if (input[k] !== undefined) data[k] = input[k]!.trim() || null;
  }
  if (Object.keys(data).length === 0) return { ok: true };
  await prisma.project.update({ where: { id: projectId }, data });
  revalidatePath(`/jobs/${projectId}`);
  revalidatePath("/jobs/list");
  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}
