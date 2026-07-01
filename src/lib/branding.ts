import { prisma } from "@/lib/prisma";

export type HubBranding = {
  id: string;
  backgroundEnabled: boolean;
  backgroundData: string | null;
  backgroundMime: string | null;
  scrim: number;
  mode: string;
  updatedAt: Date;
};

const FALLBACK: HubBranding = {
  id: "singleton",
  backgroundEnabled: true,
  backgroundData: null,
  backgroundMime: null,
  scrim: 40,
  mode: "light",
  updatedAt: new Date(0),
};

// Singleton branding row, created on first read. Server-only (uses Prisma).
// Falls back to a safe in-memory default if the table isn't migrated yet, so
// the app never crashes before `prisma db push`.
export async function getBrandingConfig(): Promise<HubBranding> {
  try {
    const existing = await prisma.brandingConfig.findUnique({ where: { id: "singleton" } });
    if (existing) return existing as HubBranding;
    return (await prisma.brandingConfig.create({ data: { id: "singleton" } })) as HubBranding;
  } catch {
    return FALLBACK;
  }
}
