"use client";

/**
 * /documents — Read-only SharePoint document browser.
 *
 * Flow: site libraries → drive root items → subfolder items
 *
 * Role-gate: enforced server-side in the actions; this page renders for
 * any authenticated user but will surface an error for Field/Sub/Client roles.
 */

import { useEffect, useState, useCallback } from "react";
import {
  listSharePointLibraries,
  listSharePointFiles,
  getSharePointDownloadUrl,
} from "@/lib/actions/sharepointActions";
import type { SpDrive, SpItem } from "@/lib/sharepoint";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes?: number): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function FileIcon({ item }: { item: SpItem }) {
  if (item.folder) {
    return <span aria-hidden className="text-lg leading-none">📁</span>;
  }
  const mime = item.file?.mimeType ?? "";
  if (mime.includes("pdf")) return <span aria-hidden className="text-lg leading-none">📄</span>;
  if (mime.includes("image")) return <span aria-hidden className="text-lg leading-none">🖼️</span>;
  if (
    mime.includes("spreadsheet") ||
    mime.includes("excel") ||
    item.name.endsWith(".xlsx") ||
    item.name.endsWith(".xls")
  ) {
    return <span aria-hidden className="text-lg leading-none">📊</span>;
  }
  if (
    mime.includes("word") ||
    mime.includes("document") ||
    item.name.endsWith(".docx") ||
    item.name.endsWith(".doc")
  ) {
    return <span aria-hidden className="text-lg leading-none">📝</span>;
  }
  return <span aria-hidden className="text-lg leading-none">📎</span>;
}

// ─── Breadcrumb types ──────────────────────────────────────────────────────────

interface BreadcrumbEntry {
  label: string;
  driveId: string;
  folderId?: string;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DocumentsPage() {
  // Libraries (drives)
  const [libraries, setLibraries] = useState<SpDrive[]>([]);
  const [libError, setLibError] = useState<string | null>(null);
  const [libLoading, setLibLoading] = useState(true);

  // Active drive + items
  const [activeDriveId, setActiveDriveId] = useState<string | null>(null);
  const [items, setItems] = useState<SpItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [itemsError, setItemsError] = useState<string | null>(null);

  // Download in-flight
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // Breadcrumb trail for folder navigation
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbEntry[]>([]);

  // ── Load libraries on mount ──────────────────────────────────────────────

  useEffect(() => {
    (async () => {
      setLibLoading(true);
      const result = await listSharePointLibraries();
      setLibLoading(false);

      if (result.ok) {
        setLibraries(result.data.drives);
      } else {
        setLibError(result.error);
      }
    })();
  }, []);

  // ── Load items when drive/folder changes ─────────────────────────────────

  const loadItems = useCallback(
    async (driveId: string, folderId?: string, label?: string) => {
      setActiveDriveId(driveId);
      setItemsLoading(true);
      setItemsError(null);

      // Update breadcrumbs
      if (!folderId) {
        // Navigating to a drive root — reset breadcrumbs
        const drive = libraries.find((d) => d.id === driveId);
        setBreadcrumbs([
          { label: drive?.name ?? "Library", driveId },
        ]);
      } else {
        // Navigating into a folder — push to breadcrumbs
        setBreadcrumbs((prev) => [
          ...prev,
          { label: label ?? "Folder", driveId, folderId },
        ]);
      }

      const result = await listSharePointFiles(driveId, folderId);
      setItemsLoading(false);

      if (result.ok) {
        setItems(result.items);
      } else {
        setItemsError(result.error);
        setItems([]);
      }
    },
    [libraries]
  );

  // ── Breadcrumb navigation ─────────────────────────────────────────────────

  async function navigateTo(entry: BreadcrumbEntry, index: number) {
    // Trim breadcrumbs to the clicked entry
    setBreadcrumbs((prev) => prev.slice(0, index + 1));
    setItemsLoading(true);
    setItemsError(null);

    const result = await listSharePointFiles(entry.driveId, entry.folderId);
    setItemsLoading(false);

    if (result.ok) {
      setItems(result.items);
      setActiveDriveId(entry.driveId);
    } else {
      setItemsError(result.error);
    }
  }

  // ── Download / open a file ────────────────────────────────────────────────

  async function handleDownload(item: SpItem) {
    if (item.folder || !activeDriveId) return;
    setDownloadingId(item.id);

    const result = await getSharePointDownloadUrl(activeDriveId, item.id);
    setDownloadingId(null);

    if (result.ok) {
      window.open(result.url, "_blank", "noopener,noreferrer");
    } else {
      alert(`Could not get download URL: ${result.error}`);
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6 p-6 max-w-5xl mx-auto">
      {/* Page header */}
      <div>
        <h1 className="hh-heading text-2xl font-semibold">Documents</h1>
        <p className="hh-text-muted text-sm mt-1">
          Read-only view of your SharePoint document libraries.
        </p>
      </div>

      {/* Libraries sidebar + items panel */}
      <div className="flex gap-4 min-h-[60vh]">
        {/* ── Left: library list ─────────────────────────────────────────── */}
        <aside className="w-56 shrink-0 flex flex-col gap-2">
          <p className="hh-label text-xs mb-1">Libraries</p>

          {libLoading && (
            <div className="hh-text-muted text-sm animate-pulse">
              Loading…
            </div>
          )}

          {libError && (
            <div className="hh-callout hh-callout-error text-xs p-3 rounded-lg">
              {libError}
            </div>
          )}

          {!libLoading && !libError && libraries.length === 0 && (
            <div className="hh-text-muted text-sm">
              No libraries found. Configure SharePoint in{" "}
              <a
                href="/settings"
                className="hh-link underline"
              >
                Settings → Integrations
              </a>
              .
            </div>
          )}

          {libraries.map((drive) => (
            <button
              key={drive.id}
              type="button"
              onClick={() => loadItems(drive.id)}
              className={[
                "flex items-center gap-2 w-full text-left rounded-lg px-3 py-2 text-sm transition-colors",
                activeDriveId === drive.id
                  ? "hh-nav-item-active"
                  : "hh-nav-item",
              ].join(" ")}
            >
              <span aria-hidden>📚</span>
              <span className="truncate">{drive.name}</span>
            </button>
          ))}
        </aside>

        {/* ── Right: items panel ─────────────────────────────────────────── */}
        <div className="flex-1 hh-card rounded-lg overflow-hidden">
          {/* Breadcrumb bar */}
          {breadcrumbs.length > 0 && (
            <div className="flex items-center gap-1 px-4 py-2 border-b border-[var(--hh-border)] text-sm hh-text-muted flex-wrap">
              <button
                type="button"
                className="hh-link text-xs"
                onClick={() => {
                  setBreadcrumbs([]);
                  setItems([]);
                  setActiveDriveId(null);
                }}
              >
                Libraries
              </button>
              {breadcrumbs.map((bc, i) => (
                <span key={i} className="flex items-center gap-1">
                  <span aria-hidden>/</span>
                  <button
                    type="button"
                    className={[
                      "hh-link text-xs",
                      i === breadcrumbs.length - 1
                        ? "font-semibold text-[var(--hh-text)]"
                        : "",
                    ].join(" ")}
                    onClick={() => navigateTo(bc, i)}
                    disabled={i === breadcrumbs.length - 1}
                  >
                    {bc.label}
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Empty state — no drive selected */}
          {!activeDriveId && !itemsLoading && (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center p-8">
              <span className="text-4xl" aria-hidden>📂</span>
              <p className="hh-text-muted text-sm">
                Select a library on the left to browse files.
              </p>
            </div>
          )}

          {/* Loading */}
          {itemsLoading && (
            <div className="flex items-center justify-center h-48">
              <span className="hh-text-muted text-sm animate-pulse">
                Loading…
              </span>
            </div>
          )}

          {/* Error */}
          {itemsError && !itemsLoading && (
            <div className="m-4 hh-callout hh-callout-error text-sm p-4 rounded-lg">
              <p className="font-medium mb-1">Failed to load files</p>
              <p className="hh-text-muted text-xs">{itemsError}</p>
            </div>
          )}

          {/* Empty folder */}
          {!itemsLoading &&
            !itemsError &&
            activeDriveId &&
            items.length === 0 && (
              <div className="flex flex-col items-center justify-center h-48 gap-2 text-center p-8">
                <span className="text-3xl" aria-hidden>🗂️</span>
                <p className="hh-text-muted text-sm">This folder is empty.</p>
              </div>
            )}

          {/* Items table */}
          {!itemsLoading && !itemsError && items.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--hh-border)]">
                  <th className="hh-th px-4 py-2 text-left w-full">Name</th>
                  <th className="hh-th px-4 py-2 text-right whitespace-nowrap hidden sm:table-cell">
                    Modified
                  </th>
                  <th className="hh-th px-4 py-2 text-right whitespace-nowrap hidden sm:table-cell">
                    Size
                  </th>
                  <th className="hh-th px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b border-[var(--hh-border)] last:border-0 hover:bg-[var(--hh-surface-2)] transition-colors"
                  >
                    {/* Name */}
                    <td className="px-4 py-2">
                      <button
                        type="button"
                        className="flex items-center gap-2 text-left w-full group"
                        onClick={() => {
                          if (item.folder && activeDriveId) {
                            loadItems(activeDriveId, item.id, item.name);
                          } else {
                            handleDownload(item);
                          }
                        }}
                        disabled={downloadingId === item.id}
                      >
                        <FileIcon item={item} />
                        <span className="group-hover:hh-link truncate max-w-xs">
                          {item.name}
                        </span>
                        {downloadingId === item.id && (
                          <span className="hh-text-muted text-xs animate-pulse ml-1">
                            Fetching…
                          </span>
                        )}
                      </button>
                    </td>

                    {/* Modified */}
                    <td className="px-4 py-2 text-right hh-text-muted text-xs whitespace-nowrap hidden sm:table-cell">
                      {formatDate(item.lastModifiedDateTime)}
                    </td>

                    {/* Size */}
                    <td className="px-4 py-2 text-right hh-text-muted text-xs whitespace-nowrap hidden sm:table-cell">
                      {item.folder
                        ? `${item.folder.childCount} item${item.folder.childCount !== 1 ? "s" : ""}`
                        : formatBytes(item.size)}
                    </td>

                    {/* Action */}
                    <td className="px-4 py-2 text-right">
                      {!item.folder && (
                        <button
                          type="button"
                          className="hh-btn hh-btn-ghost text-xs px-2 py-1"
                          onClick={() => handleDownload(item)}
                          disabled={downloadingId === item.id}
                          title={`Open ${item.name}`}
                        >
                          Open ↗
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
