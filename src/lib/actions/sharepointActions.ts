"use server";

/**
 * SharePoint server actions for Henley Hub.
 *
 * Role-gate: CEO and Office only — matching the gate style used elsewhere
 * in the app. All authorization is server-side.
 *
 * These actions read from and write to M365Config (the singleton row that
 * already holds the Microsoft 365 tenant / client creds).
 */

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  resolveSiteId,
  listDrives,
  listItems,
  getDownloadUrl,
  type SpDrive,
  type SpItem,
} from "@/lib/sharepoint";

// ─── Auth helper ─────────────────────────────────────────────────────────────
// Hoisted to module scope — do NOT define inside a component or action body.

async function requireOfficeOrCeo() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const role = ((session.user as { role?: string }).role ?? "").toLowerCase();
  if (role !== "ceo" && role !== "office") {
    throw new Error("Forbidden: office or CEO access required");
  }
  return session;
}

// ─── Config actions ───────────────────────────────────────────────────────────

/** Persist the SharePoint site URL (and clear any cached site ID). */
export async function saveSharePointSite(
  siteUrl: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requireOfficeOrCeo();

    const trimmed = siteUrl.trim();
    if (trimmed) {
      // Validate it looks like a URL before saving.
      new URL(trimmed);
    }

    const existing = await prisma.m365Config.findFirst();
    if (!existing) {
      return {
        ok: false,
        error:
          "Microsoft 365 is not configured. Set up the M365 integration first.",
      };
    }

    await prisma.m365Config.update({
      where: { id: existing.id },
      data: {
        sharePointSiteUrl: trimmed,
        // Clear cached site ID whenever the URL changes.
        sharePointSiteId: "",
      },
    });

    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}

/**
 * Test the SharePoint connection: resolve the site ID and list drives.
 * Returns the drive list on success so the UI can preview them immediately.
 */
export async function testSharePointSite(siteUrl: string): Promise<
  | { ok: true; siteId: string; drives: SpDrive[] }
  | { ok: false; error: string }
> {
  try {
    await requireOfficeOrCeo();

    const trimmed = siteUrl.trim();
    if (!trimmed) {
      return { ok: false, error: "Enter a SharePoint site URL first." };
    }

    const siteId = await resolveSiteId(trimmed);
    const drives = await listDrives(siteId);

    // Cache the resolved site ID so the document browser doesn't need to
    // re-resolve on every load.
    const existing = await prisma.m365Config.findFirst();
    if (existing) {
      await prisma.m365Config.update({
        where: { id: existing.id },
        data: { sharePointSiteId: siteId },
      });
    }

    return { ok: true, siteId, drives };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}

// ─── Document browser actions ─────────────────────────────────────────────────

export interface SharePointLibraryResult {
  siteId: string;
  drives: SpDrive[];
}

/** List document libraries for the configured site. */
export async function listSharePointLibraries(): Promise<
  | { ok: true; data: SharePointLibraryResult }
  | { ok: false; error: string }
> {
  try {
    await requireOfficeOrCeo();

    const config = await prisma.m365Config.findFirst();
    if (!config?.sharePointSiteUrl) {
      return {
        ok: false,
        error:
          "SharePoint site not configured. Go to Settings → Integrations → SharePoint to set it up.",
      };
    }

    // Use cached site ID when available; re-resolve otherwise.
    let siteId = config.sharePointSiteId ?? "";
    if (!siteId) {
      siteId = await resolveSiteId(config.sharePointSiteUrl);
      await prisma.m365Config.update({
        where: { id: config.id },
        data: { sharePointSiteId: siteId },
      });
    }

    const drives = await listDrives(siteId);
    return { ok: true, data: { siteId, drives } };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}

/** List files and folders inside a drive root or a specific folder. */
export async function listSharePointFiles(
  driveId: string,
  folderId?: string
): Promise<{ ok: true; items: SpItem[] } | { ok: false; error: string }> {
  try {
    await requireOfficeOrCeo();

    if (!driveId) {
      return { ok: false, error: "driveId is required." };
    }

    const items = await listItems(driveId, folderId);
    return { ok: true, items };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}

/** Get a pre-authenticated download URL for a file. */
export async function getSharePointDownloadUrl(
  driveId: string,
  itemId: string
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  try {
    await requireOfficeOrCeo();

    const url = await getDownloadUrl(driveId, itemId);
    if (!url) {
      return {
        ok: false,
        error: "This item does not have a downloadable URL (it may be a folder).",
      };
    }
    return { ok: true, url };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}
