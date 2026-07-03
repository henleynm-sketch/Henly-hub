"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import {
  saveM365Config,
  testM365,
  disconnectM365,
  syncM365,
  type ActionResult,
} from "@/app/(app)/settings/m365Actions";

export type M365CardData = {
  configured: boolean;
  connected: boolean; // configured AND last test passed
  mailbox: string | null;
  tenantId: string | null; // full value, prefill only (not a secret)
  clientId: string | null;
  tenantIdMasked: string | null;
  hasSecret: boolean;
  lastSyncAt: string | null;
  lastSyncOk: boolean | null;
  lastSyncMsg: string | null;
};

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

export default function M365Card({
  data,
  isCeo,
  canTest,
}: {
  data: M365CardData;
  isCeo: boolean;
  canTest: boolean;
}) {
  const [pending, start] = useTransition();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [replaceSecret, setReplaceSecret] = useState(!data.hasSecret);

  function flash(ok: boolean, msg: string) {
    setToast({ ok, msg });
    setTimeout(() => setToast(null), 5000);
  }

  function run(fn: () => Promise<ActionResult>, onDone?: (r: ActionResult) => void) {
    start(async () => {
      const r = await fn();
      onDone?.(r);
    });
  }

  function onSave(formData: FormData) {
    setSheetError(null);
    start(async () => {
      const r = await saveM365Config(formData);
      if (!r.ok) {
        setSheetError(r.error ?? "Could not save");
        return;
      }
      setSheetOpen(false);
      flash(true, "Microsoft 365 connected");
    });
  }

  const statusBadge = data.connected ? (
    <span className="hh-badge hh-badge--success">connected</span>
  ) : data.configured ? (
    data.lastSyncOk === false ? (
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
        <span className="hh-primary">Microsoft 365</span>
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
            Pull the shared company mailbox into the unified inbox.
          </span>
          {isCeo && (
            <button
              className="btn-secondary text-xs"
              onClick={() => {
                setReplaceSecret(true);
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
            {data.mailbox} · tenant {data.tenantIdMasked}
          </span>
          <span className="hh-secondary">
            {data.connected
              ? `Last successful test ${relative(data.lastSyncAt)}.`
              : data.lastSyncMsg
              ? `Last test: ${data.lastSyncMsg}`
              : "Not tested yet."}
          </span>
          <span className="flex flex-wrap gap-2 mt-1">
            {isCeo && data.connected && (
              <button
                className="btn-secondary text-xs inline-flex items-center gap-1.5"
                disabled={pending}
                onClick={() => run(syncM365, (r) => flash(r.ok, r.ok ? `Synced ${r.created ?? 0} new messages from inbox` : r.error ?? "Sync failed"))}
              >
                {pending && <Loader2 size={12} className="animate-spin" />}
                Sync inbox now
              </button>
            )}
            {canTest && (
              <button
                className="btn-secondary text-xs inline-flex items-center gap-1.5"
                disabled={pending}
                onClick={() => run(testM365, (r) => flash(r.ok, r.ok ? "Connection test passed" : r.error ?? "Test failed"))}
              >
                {pending && <Loader2 size={12} className="animate-spin" />}
                Test connection
              </button>
            )}
            {isCeo && (
              <button
                className="btn-secondary text-xs"
                onClick={() => {
                  setReplaceSecret(false);
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

      {/* Configure / Edit sheet */}
      {sheetOpen && (
        <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/55" onClick={() => setSheetOpen(false)} />
          <div className="hh-panel relative w-full sm:max-w-md max-h-[92vh] overflow-y-auto rounded-b-none sm:rounded-[20px]">
            <div className="flex items-center justify-between">
              <h3 className="hh-label">{data.configured ? "Edit Microsoft 365" : "Configure Microsoft 365"}</h3>
              <button className="hh-close" onClick={() => setSheetOpen(false)} aria-label="Close">×</button>
            </div>
            <p className="hh-caption mt-2">
              Use an Azure AD app registration with application permission <code className="hh-chip">Mail.Read</code> and admin consent.
            </p>
            <form action={onSave} className="mt-4 flex flex-col gap-3">
              <div>
                <label className="hh-label block mb-1.5">Tenant ID</label>
                <input name="tenantId" className="input" defaultValue={data.tenantId ?? ""} required />
              </div>
              <div>
                <label className="hh-label block mb-1.5">Client ID</label>
                <input name="clientId" className="input" defaultValue={data.clientId ?? ""} required />
              </div>
              <div>
                <label className="hh-label block mb-1.5">Client secret</label>
                {data.hasSecret && !replaceSecret ? (
                  <div className="flex items-center justify-between">
                    <span className="hh-secondary">Stored secret kept</span>
                    <button type="button" className="btn-ghost text-xs" onClick={() => setReplaceSecret(true)}>
                      Replace secret
                    </button>
                  </div>
                ) : (
                  <input
                    name="clientSecret"
                    type="password"
                    className="input"
                    autoComplete="new-password"
                    placeholder="Paste the app secret value"
                    required={!data.hasSecret}
                  />
                )}
              </div>
              <div>
                <label className="hh-label block mb-1.5">Mailbox</label>
                <input name="mailbox" type="email" className="input" defaultValue={data.mailbox ?? ""} placeholder="info@henleycontracting.com" required />
              </div>
              {sheetError && (
                <div className="flex items-center gap-2">
                  <span className="hh-dot hh-dot--red" />
                  <span className="hh-secondary">{sheetError}</span>
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
        </div>
      )}

      {/* Disconnect confirm */}
      {confirmDisconnect && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/55" onClick={() => setConfirmDisconnect(false)} />
          <div className="hh-panel relative w-full max-w-sm">
            <h3 className="hh-label">Disconnect Microsoft 365?</h3>
            <p className="hh-secondary mt-2">
              Stored credentials will be cleared. Synced inbox data is preserved.
            </p>
            <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end mt-4">
              <button className="btn-secondary w-full sm:w-auto" onClick={() => setConfirmDisconnect(false)}>
                Cancel
              </button>
              <button
                className="btn-destructive w-full sm:w-auto inline-flex items-center justify-center gap-1.5"
                disabled={pending}
                onClick={() =>
                  run(disconnectM365, (r) => {
                    setConfirmDisconnect(false);
                    flash(r.ok, r.ok ? "Microsoft 365 disconnected" : r.error ?? "Could not disconnect");
                  })
                }
              >
                {pending && <Loader2 size={14} className="animate-spin" />}
                Disconnect
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
