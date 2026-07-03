import { apiRoute } from "@/lib/api/handler";
import { prisma } from "@/lib/prisma";
import { resolveSiteId, listDrives, listItems } from "@/lib/sharepoint";

/**
 * GET /api/v1/sharepoint/files
 * Query params:
 *   driveId   — omit to list libraries; provide to list files in that drive root
 *   folderId  — optionally scope to a specific folder within the drive
 * Scope required: sharepoint:read
 */
export const GET = apiRoute("sharepoint:read", async ({ url }) => {
  const driveId = url.searchParams.get("driveId") ?? undefined;
  const folderId = url.searchParams.get("folderId") ?? undefined;

  const config = await prisma.m365Config.findFirst();
  if (!config?.sharePointSiteUrl) {
    throw new Error(
      "SharePoint site URL is not configured. Set it in Settings → Integrations → SharePoint."
    );
  }

  let siteId = config.sharePointSiteId ?? "";
  if (!siteId) {
    siteId = await resolveSiteId(config.sharePointSiteUrl);
    await prisma.m365Config.update({
      where: { id: config.id },
      data: { sharePointSiteId: siteId },
    });
  }

  if (!driveId) {
    const libraries = await listDrives(siteId);
    return { data: { libraries } };
  }

  const items = await listItems(driveId, folderId);
  return { data: { items } };
});