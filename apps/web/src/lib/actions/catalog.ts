"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/roles";
import { revalidatePath } from "next/cache";

export type CatalogActionResult = { ok: boolean; error?: string };

async function office() {
  const me = await auth();
  if (!me?.user) return null;
  const role = me.user.role as Role;
  if (role !== "CEO" && role !== "OFFICE") return null;
  return me;
}

const toCents = (v: FormDataEntryValue | null): number => {
  const n = parseFloat(String(v ?? "0"));
  return isNaN(n) ? 0 : Math.round(n * 100);
};

// ── Cost items ───────────────────────────────────────────────────────────────

export async function saveCostItem(formData: FormData): Promise<CatalogActionResult> {
  const me = await office();
  if (!me) return { ok: false, error: "Not authorized" };

  const id = String(formData.get("id") || "");
  const name = String(formData.get("name") || "").trim();
  if (!name) return { ok: false, error: "Name is required" };
  const costTypeId = String(formData.get("costTypeId") || "") || null;
  const costCodeId = String(formData.get("costCodeId") || "") || null;
  if (costTypeId && !(await prisma.costType.findUnique({ where: { id: costTypeId } }))) {
    return { ok: false, error: "Unknown cost type" };
  }
  if (costCodeId && !(await prisma.costCode.findUnique({ where: { id: costCodeId } }))) {
    return { ok: false, error: "Unknown cost code" };
  }

  const data = {
    name,
    description: String(formData.get("description") || "").trim() || null,
    unit: String(formData.get("unit") || "").trim() || null,
    unitCostCents: toCents(formData.get("unitCost")),
    unitPriceCents: toCents(formData.get("unitPrice")),
    taxable: formData.get("taxable") === "on",
    costTypeId,
    costCodeId,
    active: formData.get("active") !== "off",
  };

  if (id) await prisma.costItem.update({ where: { id }, data });
  else await prisma.costItem.create({ data });
  revalidatePath("/jobs/catalog");
  return { ok: true };
}

// ── Cost codes ───────────────────────────────────────────────────────────────

export async function saveCostCode(formData: FormData): Promise<CatalogActionResult> {
  const me = await office();
  if (!me) return { ok: false, error: "Not authorized" };

  const id = String(formData.get("id") || "");
  const name = String(formData.get("name") || "").trim();
  const number = String(formData.get("number") || "").trim();
  if (!name || !number) return { ok: false, error: "Number and name are required" };
  const parentId = String(formData.get("parentId") || "") || null;
  if (parentId) {
    if (parentId === id) return { ok: false, error: "A code cannot be its own parent" };
    if (!(await prisma.costCode.findUnique({ where: { id: parentId } }))) {
      return { ok: false, error: "Unknown parent code" };
    }
  }

  const data = { name, number, parentId };
  if (id) await prisma.costCode.update({ where: { id }, data });
  else await prisma.costCode.create({ data });
  revalidatePath("/jobs/catalog");
  return { ok: true };
}

// ── Cost types ───────────────────────────────────────────────────────────────

export async function saveCostType(formData: FormData): Promise<CatalogActionResult> {
  const me = await office();
  if (!me) return { ok: false, error: "Not authorized" };

  const id = String(formData.get("id") || "");
  const name = String(formData.get("name") || "").trim();
  if (!name) return { ok: false, error: "Name is required" };
  const marginPct = parseFloat(String(formData.get("marginPct") || "0"));
  if (isNaN(marginPct) || marginPct < 0 || marginPct >= 100) {
    return { ok: false, error: "Margin must be between 0 and 99.99" };
  }
  const marginBps = Math.round(marginPct * 100);
  const markupBps =
    marginBps > 0 && marginBps < 10000
      ? Math.round((marginBps / (10000 - marginBps)) * 10000)
      : 0;

  const data = {
    name,
    defaultMarginPct: marginBps,
    defaultMarkupPct: markupBps,
    taxable: formData.get("taxable") === "on",
  };
  if (id) await prisma.costType.update({ where: { id }, data });
  else await prisma.costType.create({ data });
  revalidatePath("/jobs/catalog");
  return { ok: true };
}

// ── Estimate line (manual or from catalog) ───────────────────────────────────

export async function addEstimateLine(
  estimateId: string,
  formData: FormData,
): Promise<CatalogActionResult> {
  const me = await office();
  if (!me) return { ok: false, error: "Not authorized" };

  const estimate = await prisma.estimate.findUnique({
    where: { id: estimateId },
    include: { lineItems: true },
  });
  if (!estimate) return { ok: false, error: "Estimate not found" };
  if (estimate.status !== "DRAFT") {
    return { ok: false, error: "Lines can only be added to draft estimates" };
  }

  const costItemId = String(formData.get("costItemId") || "") || null;
  let costCodeId: string | null = null;
  if (costItemId) {
    const item = await prisma.costItem.findUnique({ where: { id: costItemId } });
    if (!item) return { ok: false, error: "Unknown catalog item" };
    costCodeId = item.costCodeId;
  }

  const description = String(formData.get("description") || "").trim();
  const quantity = parseFloat(String(formData.get("quantity") || "1"));
  const unitCents = toCents(formData.get("unit"));
  if (!description) return { ok: false, error: "Description is required" };
  if (isNaN(quantity) || quantity <= 0) return { ok: false, error: "Quantity must be positive" };
  if (unitCents <= 0) return { ok: false, error: "Unit price must be positive" };

  const totalCents = Math.round(quantity * unitCents);

  // Recompute totals preserving the estimate's effective tax rate.
  const newSubtotal = estimate.subtotalCents + totalCents;
  const taxRate = estimate.subtotalCents > 0 ? estimate.taxCents / estimate.subtotalCents : 0;
  const newTax = Math.round(newSubtotal * taxRate);

  await prisma.$transaction([
    prisma.estimateLine.create({
      data: {
        estimateId,
        description,
        quantity,
        unitCents,
        totalCents,
        category: String(formData.get("category") || "").trim() || null,
        costItemId,
        costCodeId,
      },
    }),
    prisma.estimate.update({
      where: { id: estimateId },
      data: { subtotalCents: newSubtotal, taxCents: newTax, totalCents: newSubtotal + newTax },
    }),
  ]);

  revalidatePath(`/estimates/${estimateId}`);
  revalidatePath("/estimates");
  return { ok: true };
}
