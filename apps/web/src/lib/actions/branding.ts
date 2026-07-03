"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canManageTeam, type Role } from "@/lib/roles";
import { revalidatePath } from "next/cache";

// Module-scope guard (same pattern as settings) — never closes over component state.
async function requireCeo() {
  const me = await auth();
  if (!me?.user || !canManageTeam(me.user.role as Role)) {
    throw new Error("Not authorized");
  }
  return me;
}

const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"];
const ALLOWED_MODE = ["light", "dark", "both"];
const MAX_BYTES = 4 * 1024 * 1024;

export async function updateHubBackground(input: {
  dataBase64?: string | null;
  mime?: string | null;
  scrim: number;
  mode: string;
  enabled: boolean;
}) {
  const me = await requireCeo();

  const scrim = Math.max(0, Math.min(70, Math.round(Number(input.scrim) || 0)));
  if (!ALLOWED_MODE.includes(input.mode)) throw new Error("Invalid mode");

  const data: {
    backgroundEnabled: boolean;
    scrim: number;
    mode: string;
    backgroundData?: string | null;
    backgroundMime?: string | null;
  } = { backgroundEnabled: !!input.enabled, scrim, mode: input.mode };

  if (input.dataBase64) {
    if (!input.mime || !ALLOWED_MIME.includes(input.mime)) {
      throw new Error("Unsupported image type — use JPG, PNG, or WebP.");
    }
    if (Buffer.byteLength(input.dataBase64, "base64") > MAX_BYTES) {
      throw new Error("Image too large — max 4 MB.");
    }
    data.backgroundData = input.dataBase64;
    data.backgroundMime = input.mime;
  }

  await prisma.brandingConfig.upsert({
    where: { id: "singleton" },
    update: data,
    create: { id: "singleton", ...data },
  });
  await prisma.auditLog.create({
    data: { actorId: me.user.id, action: "branding.background.update", target: "singleton" },
  });

  revalidatePath("/", "layout");
  return { ok: true as const };
}

export async function removeHubBackground() {
  const me = await requireCeo();
  await prisma.brandingConfig.upsert({
    where: { id: "singleton" },
    update: { backgroundData: null, backgroundMime: null },
    create: { id: "singleton", backgroundData: null, backgroundMime: null },
  });
  await prisma.auditLog.create({
    data: { actorId: me.user.id, action: "branding.background.remove", target: "singleton" },
  });

  revalidatePath("/", "layout");
  return { ok: true as const };
}
