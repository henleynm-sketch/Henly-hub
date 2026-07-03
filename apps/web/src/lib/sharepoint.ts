/**
 * SharePoint Graph API client for Henley Hub.
 *
 * Reuses getGraphToken from ./microsoft365 — no second auth path.
 * Same app registration, same admin consent.
 *
 * Permissions required on the Azure app registration (Application, admin-consented):
 *   Sites.Read.All   — resolve site IDs and list drives
 *   Files.Read.All   — list drive items and get download URLs
 *
 * Both are tenant-wide grants. Per-site Sites.Selected is out of scope.
 */

import { getGraphToken } from "@/lib/microsoft365";

const GRAPH = "https://graph.microsoft.com/v1.0";

// ─── Error mapping ────────────────────────────────────────────────────────────
// Mirrors the pattern used by the mail client in microsoft365.ts.

function toSharePointError(err: unknown): string {
  const raw =
    err instanceof Error ? err.message : String(err ?? "Unknown error");

  if (
    raw.includes("Authorization_RequestDenied") ||
    raw.includes("Forbidden") ||
    raw.includes("403")
  ) {
    return (
      "Missing consent: ask your Azure admin to open the app registration " +
      "(client ID 1b7e8810-43d4-4dd5-a4fa-d5166c077bed), add Application " +
      "permissions Sites.Read.All and Files.Read.All under Microsoft Graph, " +
      "then click Grant admin consent."
    );
  }
  if (
    raw.includes("InvalidAuthenticationToken") ||
    raw.includes("401")
  ) {
    return (
      "Microsoft 365 authentication failed. Verify the tenant ID, client ID, " +
      "and client secret in Settings → Integrations → Microsoft 365."
    );
  }
  if (
    raw.includes("Request_ResourceNotFound") ||
    raw.includes("itemNotFound") ||
    raw.includes("404")
  ) {
    return (
      "SharePoint site or item not found. " +
      "Check the site URL and confirm the app has access to that site."
    );
  }
  return raw;
}

// ─── Internal fetch helper ────────────────────────────────────────────────────

async function gFetch<T = unknown>(path: string): Promise<T> {
  const token = await getGraphToken();

  const res = await fetch(`${GRAPH}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    // Always fetch fresh — this runs server-side in a Server Action / Route Handler.
    cache: "no-store",
  });

  if (!res.ok) {
    let code = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      const e = (body as { error?: { code?: string; message?: string } }).error;
      code = e?.code ?? e?.message ?? code;
    } catch {
      // ignore parse errors — use the status code fallback
    }
    throw new Error(code);
  }

  return res.json() as Promise<T>;
}

// ─── Public types ─────────────────────────────────────────────────────────────

export interface SpDrive {
  id: string;
  name: string;
  /** "documentLibrary" | "personal" | "business" */
  driveType: string;
  webUrl: string;
}

export interface SpItem {
  id: string;
  name: string;
  size?: number;
  webUrl: string;
  lastModifiedDateTime: string;
  /** Present when the item is a folder */
  folder?: { childCount: number };
  /** Present when the item is a file */
  file?: { mimeType: string };
  /** Pre-authenticated download URL — valid ~1 hour, included by Graph when app has Files.Read.All */
  "@microsoft.graph.downloadUrl"?: string;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Resolve a SharePoint site URL to its opaque Graph site ID.
 *
 * @example
 *   await resolveSiteId("https://contoso.sharepoint.com/sites/HenleyHub")
 *   // → "contoso.sharepoint.com,abc123...,def456..."
 */
export async function resolveSiteId(siteUrl: string): Promise<string> {
  try {
    const url = new URL(siteUrl.trim());
    const host = url.hostname; // e.g. contoso.sharepoint.com
    const path = url.pathname.replace(/\/$/, ""); // e.g. /sites/HenleyHub

    // Graph: GET /sites/{hostname}:/{path}
    // Root site (no path): GET /sites/{hostname}
    const graphPath = path ? `/sites/${host}:${path}` : `/sites/${host}`;

    const data = await gFetch<{ id: string }>(graphPath);
    return data.id;
  } catch (err) {
    throw new Error(toSharePointError(err));
  }
}

/**
 * List document libraries (drives) for a resolved site ID.
 */
export async function listDrives(siteId: string): Promise<SpDrive[]> {
  try {
    const data = await gFetch<{ value: SpDrive[] }>(
      `/sites/${siteId}/drives`
    );
    return data.value ?? [];
  } catch (err) {
    throw new Error(toSharePointError(err));
  }
}

/**
 * List items inside a drive root or a specific folder.
 *
 * @param driveId  - ID from listDrives()
 * @param folderId - Graph item ID of a folder; omit to list the drive root
 */
export async function listItems(
  driveId: string,
  folderId?: string
): Promise<SpItem[]> {
  try {
    const path = folderId
      ? `/drives/${driveId}/items/${folderId}/children`
      : `/drives/${driveId}/root/children`;

    const data = await gFetch<{ value: SpItem[] }>(path);
    return data.value ?? [];
  } catch (err) {
    throw new Error(toSharePointError(err));
  }
}

/**
 * Fetch the pre-authenticated download URL for a file item.
 *
 * Returns null for folders or items without a downloadable blob.
 * The URL is valid for approximately 1 hour — do not cache it server-side.
 */
export async function getDownloadUrl(
  driveId: string,
  itemId: string
): Promise<string | null> {
  try {
    const item = await gFetch<SpItem>(
      `/drives/${driveId}/items/${itemId}`
    );
    return item["@microsoft.graph.downloadUrl"] ?? null;
  } catch (err) {
    throw new Error(toSharePointError(err));
  }
}
