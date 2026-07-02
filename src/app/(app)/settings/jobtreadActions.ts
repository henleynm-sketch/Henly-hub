"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canManageTeam, type Role } from "@/lib/roles";
import { revalidatePath } from "next/cache";
import {
  testJobTreadConnection,
  discoverFieldMap,
  parseFieldMap,
  FIELD_MAP_AXES,
  type FieldMapAxis,
  type JobTreadFieldMap,
} from "@/lib/jobtread";

export type JobTreadActionResult = {
  ok: boolean;
  error?: string;
  orgName?: string;
  jobCount?: number;
  fieldMap?: JobTreadFieldMap;
};

// Module-scope guard (hoisting convention — see settings/page.tsx requireCeo).
async function ceo() {
  const me = await auth();
  if (!me?.user || !canManageTeam(me.user.role as Role)) return null;
  return me;
}

async function ceoOrOffice() {
  const me = await auth();
  if (!me?.user) return null;
  const role = me.user.role as Role;
  if (role !== "CEO" && role !== "OFFICE") return null;
  return me;
}

// Configure or edit: CEO only. Persists the singleton, runs a live test, and
// on a green test discovers the custom-field map for the four board axes.
// Grant key is left untouched when the field comes back empty (Edit mode).
export async function saveJobTreadConfig(formData: FormData): Promise<JobTreadActionResult> {
  const me = await ceo();
  if (!me) return { ok: false, error: "Not authorized" };

  const grantKey = String(formData.get("grantKey") || "").trim();
  const organizationId = String(formData.get("organizationId") || "").trim() || "22PVYxTzwCLW";

  const existing = await prisma.jobTreadConfig.findUnique({ where: { id: "singleton" } }).catch(() => null);
  if (!existing?.grantKey && !grantKey) {
    return { ok: false, error: "Grant key is required" };
  }

  const data: { organizationId: string; grantKey?: string } = { organizationId };
  if (grantKey) data.grantKey = grantKey;

  await prisma.jobTreadConfig.upsert({
    where: { id: "singleton" },
    update: data,
    create: { id: "singleton", organizationId, grantKey: grantKey || null },
  });

  await prisma.auditLog.create({
    data: {
      actorId: me.user.id,
      action: existing?.grantKey ? "jobtread.edit" : "jobtread.configure",
      target: organizationId,
    },
  });

  const test = await testJobTreadConnection();
  if (!test.ok) {
    revalidatePath("/settings");
    return { ok: false, error: test.error };
  }

  let fieldMap: JobTreadFieldMap | undefined;
  try {
    fieldMap = await discoverFieldMap();
  } catch (err) {
    // Connection is green but discovery failed — surface raw error, keep config.
    revalidatePath("/settings");
    return {
      ok: true,
      orgName: test.orgName,
      jobCount: test.jobCount,
      error: `Connected, but field discovery failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  revalidatePath("/settings");
  return { ok: true, orgName: test.orgName, jobCount: test.jobCount, fieldMap };
}

// Test connection: CEO or Office (matches M365/Quo card gating).
export async function testJobTread(): Promise<JobTreadActionResult> {
  const me = await ceoOrOffice();
  if (!me) return { ok: false, error: "Not authorized" };
  const result = await testJobTreadConnection();
  revalidatePath("/settings");
  return result.ok
    ? { ok: true, orgName: result.orgName, jobCount: result.jobCount }
    : { ok: false, error: result.error };
}

// Re-run custom-field discovery: CEO only.
export async function rediscoverJobTreadFields(): Promise<JobTreadActionResult> {
  const me = await ceo();
  if (!me) return { ok: false, error: "Not authorized" };
  try {
    const fieldMap = await discoverFieldMap();
    revalidatePath("/settings");
    return { ok: true, fieldMap };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Field discovery failed" };
  }
}

// Manual override for one axis: CEO only. fieldId must be one of the
// discovered fields (or empty to clear). Never invents field IDs.
export async function overrideJobTreadField(
  axis: string,
  fieldId: string,
): Promise<JobTreadActionResult> {
  const me = await ceo();
  if (!me) return { ok: false, error: "Not authorized" };
  if (!(FIELD_MAP_AXES as readonly string[]).includes(axis)) {
    return { ok: false, error: `Unknown axis: ${axis}` };
  }

  const row = await prisma.jobTreadConfig.findUnique({ where: { id: "singleton" } }).catch(() => null);
  const map = parseFieldMap(row?.fieldMap);
  if (!map) return { ok: false, error: "No discovered field map — run field discovery first" };

  const cleared = fieldId.trim() === "";
  if (!cleared && !map.fields.some((f) => f.id === fieldId)) {
    return { ok: false, error: "Field ID is not among the discovered Job custom fields" };
  }

  map[axis as FieldMapAxis] = cleared ? null : fieldId;
  await prisma.jobTreadConfig.update({
    where: { id: "singleton" },
    data: { fieldMap: JSON.stringify(map) },
  });

  await prisma.auditLog.create({
    data: { actorId: me.user.id, action: "jobtread.fieldmap.override", target: `${axis}=${cleared ? "(none)" : fieldId}` },
  });

  revalidatePath("/settings");
  return { ok: true, fieldMap: map };
}

// Disconnect: CEO only. Clears the grant key, keeps field map + sync history.
export async function disconnectJobTread(): Promise<JobTreadActionResult> {
  const me = await ceo();
  if (!me) return { ok: false, error: "Not authorized" };
  await prisma.jobTreadConfig
    .update({ where: { id: "singleton" }, data: { grantKey: null } })
    .catch(() => {});
  await prisma.auditLog.create({
    data: { actorId: me.user.id, action: "jobtread.disconnect", target: "jobtread" },
  });
  revalidatePath("/settings");
  return { ok: true };
}
