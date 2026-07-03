"use client";

/**
 * SharePoint settings card — drop into Settings → Integrations.
 *
 * Shows three states:
 *   not-configured  — M365 creds exist but no site URL saved
 *   configured      — URL saved but not yet tested
 *   connected       — last test passed; shows drive count
 *
 * Uses hh-* design tokens only; no hardcoded hex.
 */

import { useState } from "react";
import {
  saveSharePointSite,
  testSharePointSite,
} from "@/lib/actions/sharepointActions";
import type { SpDrive } from "@/lib/sharepoint";

interface Props {
  /** Currently saved site URL from M365Config (may be empty string). */
  initialSiteUrl: string;
  /** Cached site ID — truthy means a prior test passed. */
  initialSiteId: string;
}

export function SharePointCard({ initialSiteUrl, initialSiteId }: Props) {
  const [siteUrl, setSiteUrl] = useState(initialSiteUrl);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [drives, setDrives] = useState<SpDrive[] | null>(null);
  const [connected, setConnected] = useState(!!initialSiteId);

  // ── Save ──────────────────────────────────────────────────────────────────

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    setTestError(null);
    setDrives(null);
    setConnected(false);

    const result = await saveSharePointSite(siteUrl);
    setSaving(false);

    if (!result.ok) {
      setSaveError(result.error);
    }
  }

  // ── Test / Sync ───────────────────────────────────────────────────────────

  async function handleTest() {
    setTesting(true);
    setTestError(null);
    setDrives(null);
    setConnected(false);

    const result = await testSharePointSite(siteUrl);
    setTesting(false);

    if (result.ok) {
      setDrives(result.drives);
      setConnected(true);
    } else {
      setTestError(result.error);
    }
  }

  // ── Status badge ──────────────────────────────────────────────────────────

  const statusBadge = connected ? (
    <span className="hh-badge hh-badge--success">connected</span>
  ) : siteUrl ? (
    <span className="hh-badge">configured</span>
  ) : (
    <span className="hh-badge hh-badge--warning">not configured</span>
  );

  return (
    <div className="hh-row hh-row--flat flex-col !items-start !gap-3">
      {/* Header */}
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-3">
          {/* SharePoint icon — inline SVG to avoid an external dep */}
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
            style={{ background: "var(--hh-chip-bg)" }}
          >
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 0 1-2.25 2.25M16.5 7.5V18a2.25 2.25 0 0 0 2.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 0 0 2.25 2.25h13.5M6 7.5h3v3H6v-3Z"
              />
            </svg>
          </div>
          <span className="hh-primary">SharePoint</span>
        </div>
        {statusBadge}
      </div>

      <span className="hh-secondary">
        Browse document libraries from your SharePoint site.
      </span>

      {/* Site URL input */}
      <div className="flex flex-col gap-1.5 w-full">
        <label htmlFor="sp-site-url" className="hh-label block">
          Site URL
        </label>
        <input
          id="sp-site-url"
          type="url"
          className="input"
          placeholder="https://contoso.sharepoint.com/sites/HenleyHub"
          value={siteUrl}
          onChange={(e) => {
            setSiteUrl(e.target.value);
            setConnected(false);
            setDrives(null);
            setSaveError(null);
            setTestError(null);
          }}
          disabled={saving || testing}
          autoComplete="off"
          spellCheck={false}
        />
        {saveError && (
          <div className="flex items-center gap-2 mt-0.5">
            <span className="hh-dot hh-dot--red" />
            <span className="hh-caption">{saveError}</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <span className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-secondary text-xs"
          onClick={handleSave}
          disabled={saving || testing || !siteUrl.trim()}
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          className="btn-secondary text-xs"
          onClick={handleTest}
          disabled={saving || testing || !siteUrl.trim()}
        >
          {testing ? "Testing…" : "Test connection"}
        </button>
      </span>

      {/* Test error */}
      {testError && (
        <div className="flex items-start gap-2">
          <span className="hh-dot hh-dot--red mt-0.5 flex-shrink-0" />
          <div>
            <span className="hh-secondary block">Connection failed</span>
            <span className="hh-caption">{testError}</span>
          </div>
        </div>
      )}

      {/* No drives warning */}
      {drives !== null && drives.length === 0 && (
        <div className="flex items-center gap-2">
          <span className="hh-dot hh-dot--orange" />
          <span className="hh-secondary">
            Connected — but no document libraries found on this site.
          </span>
        </div>
      )}

      {/* Drives list */}
      {drives !== null && drives.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <span className="hh-dot hh-dot--green" />
            <span className="hh-secondary">
              Connected —{" "}
              {drives.length} document librar
              {drives.length === 1 ? "y" : "ies"} found
            </span>
          </div>
          <div className="flex flex-col gap-1 pl-5">
            {drives.map((d) => (
              <span key={d.id} className="hh-caption">
                {d.name}{" "}
                <span style={{ opacity: 0.5 }}>({d.driveType})</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Help text */}
      <span className="hh-caption">
        Uses the Microsoft 365 app registration above — no extra credentials
        needed. Requires <strong>Sites.Read.All</strong> and{" "}
        <strong>Files.Read.All</strong> Application permissions with admin
        consent in Azure.
      </span>
    </div>
  );
}
