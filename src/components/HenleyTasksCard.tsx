"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import {
  saveHenleyTasksConfig,
  testHenleyTasksConnection,
  disconnectHenleyTasks,
} from "@/app/(app)/settings/henleyTasksActions";

export type HenleyTasksCardData = {
  configured: boolean;
  connected: boolean;
  apiKeyMasked: string | null;
  apiBaseUrl: string | null;
  lastTestAt: string | null;
  lastTestOk: boolean | null;
  lastTestResult: string | null;
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

export default function HenleyTasksCard({
  data,
  isCeo,
  canTest,
}: {
  data: HenleyTasksCardData;
  isCeo: boolean;
  canTest: boolean;
}) {
  const [pending, start] = useTransition();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);
  const [sheetError, setSheetError] = useState<string | null>(null);

  function flash(ok: boolean, msg: string) {
    setToast({ ok, msg });
    setTimeout(() => setToast(null), 6000);
  }

  function openSheet() {
    setSheetError(null);
    setSheetOpen(true);
  }

  function onSave(formData: FormData) {
    setSheetError(null);
    start(async () => {
      const r = await saveHenleyTasksConfig(formData);
      if (!r.ok) {
        setSheetError(r.error ?? "Could not save");
        return;
      }
      setSheetOpen(false);
      flash(true, "Henley Tasks connected");
    });
  }

  const badge = data.connected ? (
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
        <span className="hh-primary">Henley Tasks (push)</span>
        {badge}
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
            Push tasks from the Hub into Henley Tasks. Requires an API key from{" "}
            <code className="hh-chip">tasks.henleycontracting.com</code>.
          </span>
          {isCeo && (
            <button className="btn-secondary text-xs" onClick={openSheet}>
              Configure
            </button>
          )}
        </>
      ) : (
        <>
          <span className="hh-secondary">
            key {data.apiKeyMasked} · {data.apiBaseUrl}
          </span>
          <span className="hh-secondary">
            {data.connected
              ? `Last successful test ${relative(data.lastTestAt)}.`
              : data.lastTestResult
              ? `Last test: ${data.lastTestResult}`
              : "Not tested yet."}
          </span>
          <span className="flex flex-wrap gap-2 mt-1">
            {canTest && (
              <button
                className="btn-secondary text-xs inline-flex items-center gap-1.5"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const r = await testHenleyTasksConnection();
                    flash(r.ok, r.ok ? "Connection test passed" : r.error ?? "Test failed");
                  })
                }
              >
                {pending && <Loader2 size={12} className="animate-spin" />}
                Test connection
              </button>
            )}
            {isCeo && (
              <button className="btn-secondary text-xs" onClick={openSheet}>
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
              <h3 className="hh-label">
                {data.configured ? "Edit Henley Tasks" : "Configure Henley Tasks"}
              </h3>
              <button className="hh-close" onClick={() => setSheetOpen(false)} aria-label="Close">
                ×
              </button>
            </div>
            <p className="hh-caption mt-2">
              Generate an API key in Henley Tasks and paste it here. Tasks pushed from the Hub will
              appear in Henley Tasks in real time. The Hub stores no task data locally.
            </p>
            <form action={onSave} className="mt-4 flex flex-col gap-3">
              <div>
                <label className="hh-label block mb-1.5">API key</label>
                <input
                  name="apiKey"
                  type="password"
                  className="input"
                  autoComplete="new-password"
                  placeholder="Paste your Henley Tasks API key"
                  required={!data.configured}
                />
                {data.configured && (
                  <p className="hh-caption mt-1">Leave blank to keep the existing key. Type to replace.</p>
                )}
              </div>
              <div>
                <label className="hh-label block mb-1.5">API base URL (optional override)</label>
                <input
                  name="apiBaseUrl"
                  className="input"
                  defaultValue={data.apiBaseUrl ?? ""}
                  placeholder="https://tasks.henleycontracting.com/api"
                />
                <p className="hh-caption mt-1">Leave blank to use the default.</p>
              </div>
              {sheetError && (
                <div className="flex items-center gap-2">
                  <span className="hh-dot hh-dot--red" />
                  <span className="hh-secondary">{sheetError}</span>
                </div>
              )}
              <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end mt-1">
                <button
                  type="button"
                  className="btn-secondary w-full sm:w-auto"
                  onClick={() => setSheetOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary w-full sm:w-auto inline-flex items-center justify-center gap-1.5"
                  disabled={pending}
                >
                  {pending && <Loader2 size={14} className="animate-spin" />}
                  Save &amp; test
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Disconnect confirm */}
      {confirmDisconnect && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/55"
            onClick={() => setConfirmDisconnect(false)}
          />
          <div className="hh-panel relative w-full max-w-sm">
            <h3 className="hh-label">Disconnect Henley Tasks?</h3>
            <p className="hh-secondary mt-2">
              The stored API key will be cleared. No task data is held in the Hub so nothing is
              deleted.
            </p>
            <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end mt-4">
              <button
                className="btn-secondary w-full sm:w-auto"
                onClick={() => setConfirmDisconnect(false)}
              >
                Cancel
              </button>
              <button
                className="btn-destructive w-full sm:w-auto inline-flex items-center justify-center gap-1.5"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const r = await disconnectHenleyTasks();
                    setConfirmDisconnect(false);
                    flash(
                      r.ok,
                      r.ok ? "Henley Tasks disconnected" : r.error ?? "Could not disconnect",
                    );
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
