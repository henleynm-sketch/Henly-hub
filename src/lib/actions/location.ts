"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/roles";
import { revalidatePath } from "next/cache";
import { geocodeAddress, GeocodeError } from "@/lib/geocode";

export type LocationActionResult = { ok: boolean; error?: string; lat?: number; lng?: number };

async function office() {
  const me = await auth();
  if (!me?.user) return null;
  const role = me.user.role as Role;
  if (role !== "CEO" && role !== "OFFICE") return null;
  return me;
}

// On-demand geocode via Nominatim (1 req/sec policy — user-triggered only,
// result persisted; re-runs allowed after address fixes).
export async function geocodeProject(projectId: string): Promise<LocationActionResult> {
  const me = await office();
  if (!me) return { ok: false, error: "Not authorized" };

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return { ok: false, error: "Project not found" };
  const address = [project.address, project.city].filter(Boolean).join(", ");
  if (!address) return { ok: false, error: "Project has no address to geocode" };

  try {
    const hit = await geocodeAddress(address);
    if (!hit) return { ok: false, error: `No result for "${address}"` };
    await prisma.project.update({
      where: { id: projectId },
      data: {
        latitude: hit.lat,
        longitude: hit.lng,
        geocodedAt: new Date(),
        geocodeSource: "nominatim",
      },
    });
    revalidatePath(`/jobs/${projectId}`);
    revalidatePath(`/projects/${projectId}`);
    return { ok: true, lat: hit.lat, lng: hit.lng };
  } catch (err) {
    // Raw error surfaced verbatim (card precedent).
    return { ok: false, error: err instanceof GeocodeError ? err.message : String(err) };
  }
}

// Display-only tax rate chip. Bounded 0–3000 bps.
export async function setProjectTaxRate(
  projectId: string,
  ratePct: number,
): Promise<LocationActionResult> {
  const me = await office();
  if (!me) return { ok: false, error: "Not authorized" };
  if (isNaN(ratePct) || ratePct < 0 || ratePct > 30) {
    return { ok: false, error: "Tax rate must be between 0 and 30%" };
  }
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return { ok: false, error: "Project not found" };
  await prisma.project.update({
    where: { id: projectId },
    data: { taxRateBps: Math.round(ratePct * 100) },
  });
  revalidatePath(`/jobs/${projectId}`);
  return { ok: true };
}
