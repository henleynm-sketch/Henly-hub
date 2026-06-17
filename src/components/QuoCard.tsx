"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import {
  saveQuoCredentials,
  saveQuoPhoneNumber,
  testQuo,
  disconnectQuo,
  syncQuoNow,
} from "@/app/(app)/settings/quoActions";
import type { PhoneNumber } from "@/lib/quo";

export type QuoCardData = {
  configured: boolean;
  connected: boolean;
  defaultPhoneNumberName: string | null; // already "Name · +E.164"
  apiKeyMasked: string | null;
  hasKey: boolean;
  apiBase: string | null;
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

// Henley's main line; used to default-select the right phone number.
const HENLEY_LINE = "705242";

export default function QuoCard({
  data,
  isCeo,
  canTest,
}: {
  data: QuoCardData;
  isCeo: boolean;
  canTest: boolean;
}) {
  const [pending, start] = useTransition();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [step, setStep] = useState<"creds" | "number">("creds");
  const [numbers, setNumbers] = useState<PhoneNumber[]>([]);
  const [picked, setPicked] = useState<string>("");

  function flash(ok: boolean, msg: string) {
    setToast({ ok, msg });
    setTimeout(() => setToast(null), 6000);
  }
  function openSheet() {
    setStep("creds");
    setNumbers([]);
    setSheetError(null);
    setSheetOpen(true);
  }

  function onSaveCreds(formData: FormData) {
    setSheetError(null);
    start(async () => {
      const r = await saveQuoCredentials(formData);
      if (!r.ok) {
        setSheetError(`Quo says: ${r.error ?? "request failed"}`);
        return;
      }
      const list = r.phoneNumbers ?? [];
      setNumbers(list);
      const henley = list.find(
        (p) => p.number?.replace(/\D/g, "").includes(HENLEY_LINE) || p.name?.includes("Henley")
      );
      setPicked(henley?.id ?? list[0]?.id ?? "");
      setStep("number");
    });
  }
  function onSaveNumber() {
    start(async () => {
      const pn = numbers.find((p) => p.id === picked);
      const displayName = pn ? `${pn.name} · ${pn.number}` : "";
      const r = await saveQuoPhoneNumber(picked, displayName);
      if (!r.ok) {
        setSheetError(r.error ?? "Could not save phone number");
        return;
      }
      setSheetOpen(false);
      flash(true, "Quo connected");
    });
  }

  const badge = data.connected ? (
    <span className="hh-badge hh-badge--success">connected</span>
  ) : data.configured ? (
    data.lastSyncOk === false ? (
      <span className="hh-badge hh-badge--warning">last sync failed</span>
    ) : (
      <span className="hh-badge">configured</span>
    )
  ) : (
    <span className="hh-badge hh-badge--warning">not configured</span>
  );

  return (
    <div className="hh-row hh-row--flat flex-col !items-start !gap-2">
      <div className="flex items-center justify-between w-full">
        <span className="hh-primary">Quo (SMS & voice)</span>
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
            Pulls SMS and call activity from your Quo line into the unified inbox.
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
            {data.defaultPhoneNumberName ?? "Phone number not selected"} · key {data.apiKeyMasked}
          </span>
          <span className="hh-secondary">
            {data.connected
              ? `Last successful sync ${relative(data.lastSyncAt)}.`
              : data.lastSyncMsg
              ? `Last sync: ${data.lastSyncMsg}`
              : "Not synced yet."}
          </span>
          <span className="flex flex-wrap gap-2 mt-1">
            {isCeo && data.connected && (
              <button
                className="btn-secondary text-xs inline-flex items-center gap-1.5"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const r = await syncQuoNow();
                    if (!r.ok) flash(false, r.error ?? "Sync failed");
                    else if (r.partial) flash(false, `Synced ${r.sms ?? r.calls ?? 0} new. ${r.partial}`);
                    else flash(true, `Synced ${r.sms ?? 0} new SMS, ${r.calls ?? 0} new calls`);
                  })
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
                  start(async () => {
                    const r = await testQuo();
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
              <h3 className="hh-label">{data.configured ? "Edit Quo" : "Configure Quo"}</h3>
              <button className="hh-close" onClick={() => setSheetOpen(false)} aria-label="Close">×</button>
            </div>

            {step === "creds" ? (
              <>
                <p className="hh-caption mt-2">
                  Generate an API key in Quo → Workspace settings → API (workspace owner or admin only).
                  Paste it here. We&apos;ll fetch your phone numbers and ask which one to sync. Quo calls
                  these &ldquo;inboxes&rdquo; in the app — same thing.
                </p>
                <form action={onSaveCreds} className="mt-4 flex flex-col gap-3">
                  <div>
                    <label className="hh-label block mb-1.5">API key</label>
                    <input
                      name="apiKey"
                      type="password"
                      className="input"
                      autoComplete="new-password"
                      placeholder="Paste your Quo API key"
                      required={!data.hasKey}
                    />
                    {data.hasKey && (
                      <p className="hh-caption mt-1">Leave blank to keep the existing key. Type to replace.</p>
                    )}
                  </div>
                  <div>
                    <label className="hh-label block mb-1.5">API base (optional)</label>
                    <input name="apiBase" className="input" defaultValue={data.apiBase ?? ""} placeholder="https://api.openphone.com" />
                    <p className="hh-caption mt-1">Quo&apos;s API still uses openphone.com — this is correct, not a typo.</p>
                  </div>
                  {sheetError && (
                    <div className="flex items-center gap-2">
                      <span className="hh-dot hh-dot--red" />
                      <span className="hh-secondary">{sheetError}</span>
                    </div>
                  )}
                  <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end mt-1">
                    <button type="button" className="btn-secondary w-full sm:w-auto" onClick={() => setSheetOpen(false)}>Cancel</button>
                    <button type="submit" className="btn-primary w-full sm:w-auto inline-flex items-center justify-center gap-1.5" disabled={pending}>
                      {pending && <Loader2 size={14} className="animate-spin" />}
                      Save &amp; test
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <>
                <p className="hh-caption mt-2">Connection works. Pick the phone number to sync into the Hub.</p>
                <div className="mt-4 flex flex-col gap-3">
                  <div>
                    <label className="hh-label block mb-1.5">Phone number to sync</label>
                    <select className="input" value={picked} onChange={(e) => setPicked(e.target.value)}>
                      {numbers.length === 0 && <option value="">No phone numbers returned</option>}
                      {numbers.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}{p.number ? ` · ${p.number}` : ""}
                        </option>
                      ))}
                    </select>
                    <p className="hh-caption mt-1">Quo calls these &ldquo;inboxes&rdquo; in the app; the API calls them phone numbers.</p>
                  </div>
                  {sheetError && (
                    <div className="flex items-center gap-2">
                      <span className="hh-dot hh-dot--red" />
                      <span className="hh-secondary">{sheetError}</span>
                    </div>
                  )}
                  <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end mt-1">
                    <button type="button" className="btn-secondary w-full sm:w-auto" onClick={() => setStep("creds")}>Back</button>
                    <button type="button" className="btn-primary w-full sm:w-auto inline-flex items-center justify-center gap-1.5" disabled={pending || !picked} onClick={onSaveNumber}>
                      {pending && <Loader2 size={14} className="animate-spin" />}
                      Save
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Disconnect confirm */}
      {confirmDisconnect && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/55" onClick={() => setConfirmDisconnect(false)} />
          <div className="hh-panel relative w-full max-w-sm">
            <h3 className="hh-label">Disconnect Quo?</h3>
            <p className="hh-secondary mt-2">Your stored API key will be cleared. Synced conversations are preserved.</p>
            <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end mt-4">
              <button className="btn-secondary w-full sm:w-auto" onClick={() => setConfirmDisconnect(false)}>Cancel</button>
              <button
                className="btn-destructive w-full sm:w-auto inline-flex items-center justify-center gap-1.5"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const r = await disconnectQuo();
                    setConfirmDisconnect(false);
                    flash(r.ok, r.ok ? "Quo disconnected" : r.error ?? "Could not disconnect");
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
