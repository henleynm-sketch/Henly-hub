"use client";

import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { Loader2 } from "lucide-react";
import { syncAllJobTread, type JobTreadSyncSummary } from "@/lib/actions/jobtreadSync";
import {
  saveJobTreadConfig,
  testJobTread,
  rediscoverJobTreadFields,
  overrideJobTreadField,
  disconnectJobTread,
  type JobTreadActionResult,
} from "@/app/(app)/settings/jobtreadActions";

export type JobTreadFieldMapView = {
  pipelineStage: string | null;
  constructionPhase: string | null;
  warrantyPhase: string | null;
  division: string | null;
  fields: { id: string; name: string }[];
};

export type JobTreadCardData = {
  configured: boolean;
  connected: boolean; // configured AND last test passed
  grantKeyMasked: string | null;
  hasKey: boolean;
  organizationId: string;
  fieldMap: JobTreadFieldMapView | null;
  lastTestAt: string | null;
  lastTestOk: boolean | null;
  lastTestResult: string | null;
  lastSyncAt: string | null;
  lastSyncSummary: JobTreadSyncSummary | null;
};

const AXES: { key: keyof Omit<JobTreadFieldMapView, "fields">; label: string }[] = [
  { key: "pipelineStage", label: "Sales Pipeline" },
  { key: "constructionPhase", label: "Construction Phase" },
  { key: "warrantyPhase", label: "Warranty Phase" },
  { key: "division", label: "Division" },
];

function relative(iso: string | null): string {
  if (!iso) return "never";
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.round(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

function SyncSummaryView({ s }: { s: JobTreadSyncSummary }) {
  const row = (label: string, c?: { created: number; updated: number; skipped: number; [k: string]: number }) =>
    c ? (
      <div className="flex items-center justify-between w-full">
        <span className="hh-secondary">{label}</span>
        <span className="hh-secondary tabular-nums">
          {c.created} new · {c.updated} updated · {c.skipped} unchanged
          {"noClient" in c && c.noClient > 0 ? ` · ${c.noClient} no client` : ""}
          {"noProject" in c && c.noProject > 0 ? ` · ${c.noProject} no project` : ""}
        </span>
      </div>
    ) : null;
  const unmatched = s.unmatchedTaxonomy
    ? Object.entries(s.unmatchedTaxonomy).filter(([, n]) => n > 0)
    : [];
  return (
    <div className="w-full flex flex-col gap-1 mt-1">
      <span className="hh-label">Last sync</span>
      {row("Customers", s.customers)}
      {row("Vendors", s.vendors)}
      {row("Jobs", s.jobs)}
      {row("Daily logs", s.dailyLogs)}
      {s.catalog && (
        <>
          {row("Cost types", s.catalog.costTypes)}
          {row("Cost codes", s.catalog.costCodes)}
          {row("Cost items", s.catalog.costItems)}
        </>
      )}
      {s.todos && (
        <div className="flex items-center justify-between w-full">
          <span className="hh-secondary">To-dos (display-only, not stored)</span>
          <span className="hh-secondary tabular-nums">{s.todos.count}</span>
        </div>
      )}
      {unmatched.length > 0 && (
        <div className="flex items-center justify-between w-full">
          <span className="hh-secondary">Unmatched taxonomy values</span>
          <span className="hh-secondary tabular-nums">
            {unmatched.map(([k, n]) => `${k}: ${n}`).join(" · ")}
          </span>
        </div>
      )}
      {s.error && (
        <div className="flex items-start gap-2">
          <span className="hh-dot hh-dot--red mt-1" />
          <span className="hh-secondary break-all">{s.error}</span>
        </div>
      )}
    </div>
  );
}

export default function JobTreadCard({
  data,
  isCeo,
  canTest,
}: {
  data: JobTreadCardData;
  isCeo: boolean;
  canTest: boolean;
}) {
  const [pending, start] = useTransition();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [replaceKey, setReplaceKey] = useState(!data.hasKey);

  function flash(ok: boolean, msg: string) {
    setToast({ ok, msg });
    setTimeout(() => setToast(null), 8000);
  }

  function run(fn: () => Promise<JobTreadActionResult>, onDone?: (r: JobTreadActionResult) => void) {
    start(async () => {
      const r = await fn();
      onDone?.(r);
    });
  }

  function onSave(formData: FormData) {
    setSheetError(null);
    start(async () => {
      const r = await saveJobTreadConfig(formData);
      if (!r.ok) {
        // Raw Pave error shown verbatim in the sheet (Quo/M365 precedent).
        setSheetError(r.error ?? "Could not save");
        return;
      }
      setSheetOpen(false);
      const unmatched = r.fieldMap
        ? AXES.filter((a) => !r.fieldMap![a.key]).map((a) => a.label)
        : [];
      flash(
        true,
        `Connected to ${r.orgName} — ${r.jobCount} jobs` +
          (r.error ? ` · ${r.error}` : "") +
          (unmatched.length ? ` · unmatched axes: ${unmatched.join(", ")} (set below)` : ""),
      );
    });
  }

  const statusBadge = data.connected ? (
    <span className="hh-badge hh-badge--success">connected</span>
  ) : data.configured ? (
    data.lastTestOk === false ? (
      <span className="hh-badge hh-badge--warning">last test failed</span>
    ) : (
      <span className="hh-badge">configured</span>
    )
  ) : (
    <span className="hh-badge hh-badge--warning">not configured</span>
  );

  return (
    <div className="hh-row hh-row--flat flex-col !items-start !gap-2">
      <div className="flex items-center justify-between w-full">
        <span className="hh-primary">JobTread</span>
        {statusBadge}
      </div>

      {toast && (
        <div className="flex items-center gap-2">
          <span className={`hh-dot ${toast.ok ? "hh-dot--green" : "hh-dot--red"}`} />
          <span className="hh-secondary">{toast.msg}</span>
        </div>
      )}

      {!data.configured ? (
        <>
          <span className="hh-secondary">
            Pull jobs, customers, vendors and daily logs from JobTread (read-only).
          </span>
          {isCeo && (
            <button
              className="btn-secondary text-xs"
              onClick={() => {
                setReplaceKey(true);
                setSheetError(null);
                setSheetOpen(true);
              }}
            >
              Configure
            </button>
          )}
        </>
      ) : (
        <>
          <span className="hh-secondary">
            Grant key {data.grantKeyMasked} · org {data.organizationId}
          </span>
          <span className="hh-secondary">
            {data.connected
              ? `Last successful test ${relative(data.lastTestAt)}. ${data.lastTestResult ?? ""}`
              : data.lastTestResult
              ? `Last test: ${data.lastTestResult}`
              : "Not tested yet."}
          </span>

          {/* Field map — the four board axes resolved from JobTread custom fields */}
          {data.fieldMap && (
            <div className="w-full flex flex-col gap-1.5 mt-1">
              <span className="hh-label">Board axes → JobTread custom fields</span>
              {AXES.map((axis) => {
                const fieldId = data.fieldMap![axis.key];
                const field = data.fieldMap!.fields.find((f) => f.id === fieldId) ?? null;
                return (
                  <div key={axis.key} className="flex items-center justify-between w-full gap-2">
                    <span className="hh-secondary">{axis.label}</span>
                    {isCeo ? (
                      <select
                        className="input !w-auto text-xs"
                        value={fieldId ?? ""}
                        disabled={pending}
                        onChange={(e) =>
                          run(
                            () => overrideJobTreadField(axis.key, e.target.value),
                            (r) => flash(r.ok, r.ok ? `${axis.label} mapping updated` : r.error ?? "Update failed"),
                          )
                        }
                      >
                        <option value="">— not mapped —</option>
                        {data.fieldMap!.fields.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.name}
                          </option>
                        ))}
                      </select>
                    ) : field ? (
                      <span className="hh-secondary">{field.name}</span>
                    ) : (
                      <span className="hh-badge hh-badge--warning">not mapped</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {data.lastSyncSummary && <SyncSummaryView s={data.lastSyncSummary} />}

          <span className="flex flex-wrap gap-2 mt-1">
            {isCeo && data.connected && (
              <button
                className="btn-secondary text-xs inline-flex items-center gap-1.5"
                disabled={pending}
                onClick={() =>
                  run(syncAllJobTread, (r) =>
                    flash(r.ok, r.ok ? "Sync complete — see summary below" : r.error ?? "Sync failed"),
                  )
                }
              >
                {pending && <Loader2 size={12} className="animate-spin" />}
                Sync now
              </button>
            )}
            {canTest && (
              <button
                className="btn-secondary text-xs inline-flex items-center gap-1.5"
                disabled={pending}
                onClick={() =>
                  run(testJobTread, (r) =>
                    flash(
                      r.ok,
                      r.ok ? `Connected to ${r.orgName} — ${r.jobCount} jobs` : r.error ?? "Test failed",
                    ),
                  )
                }
              >
                {pending && <Loader2 size={12} className="animate-spin" />}
                Test connection
              </button>
            )}
            {isCeo && data.connected && (
              <button
                className="btn-secondary text-xs inline-flex items-center gap-1.5"
                disabled={pending}
                onClick={() =>
                  run(rediscoverJobTreadFields, (r) =>
                    flash(r.ok, r.ok ? "Field map re-discovered" : r.error ?? "Discovery failed"),
                  )
                }
              >
                {pending && <Loader2 size={12} className="animate-spin" />}
                Re-discover fields
              </button>
            )}
            {isCeo && (
              <button
                className="btn-secondary text-xs"
                onClick={() => {
                  setReplaceKey(false);
                  setSheetError(null);
                  setSheetOpen(true);
                }}
              >
                Edit
              </button>
            )}
            {isCeo && (
              <button className="btn-ghost text-xs" onClick={() => setConfirmDisconnect(true)}>
                Disconnect
              </button>
            )}
          </span>
        </>
      )}

      {/* Configure / Edit sheet — portaled: hh-panel/hh-row ancestors carry
          hover transforms + backdrop-filter, which trap position:fixed. */}
      {sheetOpen &&
        createPortal(
        <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/55" onClick={() => setSheetOpen(false)} />
          <div className="hh-panel relative w-full sm:max-w-md max-h-[92vh] overflow-y-auto rounded-b-none sm:rounded-[20px]">
            <div className="flex items-center justify-between">
              <h3 className="hh-label">{data.configured ? "Edit JobTread" : "Configure JobTread"}</h3>
              <button className="hh-close" onClick={() => setSheetOpen(false)} aria-label="Close">×</button>
            </div>
            <p className="hh-caption mt-2">
              Create a grant key in JobTread under Settings → API. Saving runs a live
              connection test and discovers the custom fields backing the four board axes.
            </p>
            <form action={onSave} className="mt-4 flex flex-col gap-3">
              <div>
                <label className="hh-label block mb-1.5">Grant key</label>
                {data.hasKey && !replaceKey ? (
                  <div className="flex items-center justify-between">
                    <span className="hh-secondary">Stored key kept ({data.grantKeyMasked})</span>
                    <button type="button" className="btn-ghost text-xs" onClick={() => setReplaceKey(true)}>
                      Replace key
                    </button>
                  </div>
                ) : (
                  <input
                    name="grantKey"
                    type="password"
                    className="input"
                    autoComplete="new-password"
                    placeholder="Paste the JobTread grant key"
                    required={!data.hasKey}
                  />
                )}
              </div>
              <div>
                <label className="hh-label block mb-1.5">Organization ID</label>
                <input
                  name="organizationId"
                  className="input"
                  defaultValue={data.organizationId}
                  required
                />
              </div>
              {sheetError && (
                <div className="flex items-start gap-2">
                  <span className="hh-dot hh-dot--red mt-1" />
                  <span className="hh-secondary break-all">{sheetError}</span>
                </div>
              )}
              <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end mt-1">
                <button type="button" className="btn-secondary w-full sm:w-auto" onClick={() => setSheetOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary w-full sm:w-auto inline-flex items-center justify-center gap-1.5" disabled={pending}>
                  {pending && <Loader2 size={14} className="animate-spin" />}
                  Save & test
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body,
      )}

      {/* Disconnect confirm — portaled for the same reason */}
      {confirmDisconnect &&
        createPortal(
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/55" onClick={() => setConfirmDisconnect(false)} />
          <div className="hh-panel relative w-full max-w-sm">
            <h3 className="hh-label">Disconnect JobTread?</h3>
            <p className="hh-secondary mt-2">
              The stored grant key will be cleared. Synced data and the field map are preserved.
            </p>
            <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end mt-4">
              <button className="btn-secondary w-full sm:w-auto" onClick={() => setConfirmDisconnect(false)}>
                Cancel
              </button>
              <button
                className="btn-destructive w-full sm:w-auto inline-flex items-center justify-center gap-1.5"
                disabled={pending}
                onClick={() =>
                  run(disconnectJobTread, (r) => {
                    setConfirmDisconnect(false);
                    flash(r.ok, r.ok ? "JobTread disconnected" : r.error ?? "Could not disconnect");
                  })
                }
              >
                {pending && <Loader2 size={14} className="animate-spin" />}
                Disconnect
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
