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

  // ── Status pill ───────────────────────────────────────────────────────────

  function StatusPill() {
    if (connected) {
      return (
        <span className="hh-badge hh-badge-success text-xs">Connected</span>
      );
    }
    if (siteUrl) {
      return (
        <span className="hh-badge hh-badge-warning text-xs">Configured</span>
      );
    }
    return (
      <span className="hh-badge hh-badge-neutral text-xs">Not configured</span>
    );
  }

  return (
    <div className="hh-card p-6 flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          {/* SharePoint icon — inline SVG to avoid an external dep */}
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--hh-surface-2)]">
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5"
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

          <div>
            <h3 className="hh-heading text-sm font-semibold">SharePoint</h3>
            <p className="hh-text-muted text-xs mt-0.5">
              Browse document libraries from your SharePoint site.
            </p>
          </div>
        </div>

        <StatusPill />
      </div>

      {/* Site URL input */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="sp-site-url" className="hh-label text-xs">
          Site URL
        </label>
        <input
          id="sp-site-url"
          type="url"
          className="hh-input text-sm"
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
          <p className="hh-text-error text-xs mt-1">{saveError}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="hh-btn hh-btn-primary text-sm"
          onClick={handleSave}
          disabled={saving || testing || !siteUrl.trim()}
        >
          {saving ? "Saving…" : "Save"}
        </button>

        <button
          type="button"
          className="hh-btn hh-btn-secondary text-sm"
          onClick={handleTest}
          disabled={saving || testing || !siteUrl.trim()}
        >
          {testing ? "Testing…" : "Test Connection"}
        </button>
      </div>

      {/* Test result */}
      {testError && (
        <div className="hh-callout hh-callout-error text-sm rounded-lg p-3">
          <p className="font-medium mb-0.5">Connection failed</p>
          <p className="hh-text-muted text-xs">{testError}</p>
        </div>
      )}

      {drives !== null && drives.length === 0 && (
        <div className="hh-callout hh-callout-warning text-sm rounded-lg p-3">
          <p>Connected — but no document libraries found on this site.</p>
        </div>
      )}

      {drives !== null && drives.length > 0 && (
        <div className="hh-callout hh-callout-success rounded-lg p-3">
          <p className="text-sm font-medium mb-2">
            Connected — {drives.length} document librar
            {drives.length === 1 ? "y" : "ies"} found
          </p>
          <ul className="flex flex-col gap-1">
            {drives.map((d) => (
              <li key={d.id} className="flex items-center gap-2 text-xs hh-text-muted">
                <span aria-hidden>📁</span>
                <span>{d.name}</span>
                <span className="opacity-50">({d.driveType})</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Help text */}
      <p className="hh-text-muted text-xs leading-relaxed">
        Uses the Microsoft 365 app registration above — no extra credentials
        needed. Requires{" "}
        <strong>Sites.Read.All</strong> and{" "}
        <strong>Files.Read.All</strong> Application permissions with admin
        consent in Azure.
      </p>
    </div>
  );
}
