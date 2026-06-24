"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import type { Role } from "@/lib/roles";
import { isValidVendorTrade, isValidVendorType, isValidDivision } from "@/lib/taxonomy";

export type VendorResult = { ok: boolean; error?: string };

async function getMe() {
  const session = await auth();
  if (!session?.user) return null;
  return session.user as { id: string; role: string };
}

function isManager(role: Role) {
  return role === "CEO" || role === "OFFICE";
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseFormData(fd: FormData) {
  const name         = String(fd.get("name")        || "").trim();
  const trade        = String(fd.get("trade")        || "").trim() || null;
  const type         = String(fd.get("type")         || "").trim() || null;
  const email        = String(fd.get("email")        || "").trim() || null;
  const officePhone  = String(fd.get("officePhone")  || "").trim() || null;
  const fax          = String(fd.get("fax")          || "").trim() || null;
  const division     = String(fd.get("division")     || "").trim() || null;
  const w9OnFile     = fd.get("w9OnFile") === "true";
  const coiRaw       = String(fd.get("coiExpiresAt") || "").trim();
  const coiExpiresAt = coiRaw ? new Date(coiRaw) : null;
  const notes        = String(fd.get("notes")        || "").trim() || null;
  return { name, trade, type, email, officePhone, fax, division, w9OnFile, coiExpiresAt, notes };
}

function validateFields(fields: ReturnType<typeof parseFormData>): string | null {
  if (!fields.name) return "Vendor name is required";
  if (fields.trade && !isValidVendorTrade(fields.trade)) return "Invalid trade";
  if (fields.type  && !isValidVendorType(fields.type))   return "Invalid vendor type";
  if (fields.division && !isValidDivision(fields.division)) return "Invalid division";
  if (fields.coiExpiresAt && isNaN(fields.coiExpiresAt.getTime())) return "Invalid COI expiry date";
  return null;
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export async function createVendor(formData: FormData): Promise<VendorResult> {
  const me = await getMe();
  if (!me || !isManager(me.role as Role)) return { ok: false, error: "Not authorized" };

  const fields = parseFormData(formData);
  const err = validateFields(fields);
  if (err) return { ok: false, error: err };

  await prisma.vendor.create({ data: fields });
  revalidatePath("/vendors");
  return { ok: true };
}

export async function updateVendor(
  vendorId: string,
  formData: FormData
): Promise<VendorResult> {
  const me = await getMe();
  if (!me || !isManager(me.role as Role)) return { ok: false, error: "Not authorized" };

  const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } });
  if (!vendor) return { ok: false, error: "Vendor not found" };

  const fields = parseFormData(formData);
  const err = validateFields(fields);
  if (err) return { ok: false, error: err };

  await prisma.vendor.update({ where: { id: vendorId }, data: fields });
  revalidatePath("/vendors");
  return { ok: true };
}

export async function deleteVendor(vendorId: string): Promise<VendorResult> {
  const me = await getMe();
  if (!me || !isManager(me.role as Role)) return { ok: false, error: "Not authorized" };

  const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } });
  if (!vendor) return { ok: false, error: "Vendor not found" };

  await prisma.vendor.delete({ where: { id: vendorId } });
  revalidatePath("/vendors");
  return { ok: true };
}

// ─── Compliance queries ───────────────────────────────────────────────────────

/**
 * Returns vendors whose COI has already expired or expires within `withinDays` days.
 * Ordered: expired first, then soonest-expiring.
 */
export async function listExpiringCoi(withinDays = 30) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + withinDays);

  return prisma.vendor.findMany({
    where: {
      coiExpiresAt: { lte: cutoff },
    },
    orderBy: { coiExpiresAt: "asc" },
    select: {
      id:           true,
      name:         true,
      trade:        true,
      email:        true,
      coiExpiresAt: true,
    },
  });
}

/**
 * Returns vendors missing W-9 on file.
 */
export async function listMissingW9() {
  return prisma.vendor.findMany({
    where: { w9OnFile: false },
    orderBy: { name: "asc" },
    select: { id: true, name: true, trade: true, email: true },
  });
}
