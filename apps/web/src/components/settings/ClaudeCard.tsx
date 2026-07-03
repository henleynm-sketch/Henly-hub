"use client";

import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { Loader2 } from "lucide-react";
import {
  saveAnthropicConfig,
  setAssistantEnabled,
  disconnectAssistant,
} from "@/app/(app)/settings/assistantActions";

export type ClaudeCardData = {
  configured: boolean;
  enabled: boolean;
  apiKeyMasked: string | null;
  hasKey: boolean;
  model: string;
  provider: string;
  providerLabel: string;
};

export default function ClaudeCard({ data, isCeo }: { data: ClaudeCardData; isCeo: boolean }) {
  const [pending, start] = useTransition();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [replaceKey, setReplaceKey] = useState(!data.hasKey);

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 5000);
  }

  function onSave(fd: FormData) {
    setSheetError(null);
    start(async () => {
      const r = await saveAnthropicConfig(fd);
      if (!r.ok) {
        setSheetError(r.error ?? "Could not save");
        return;
      }
      setSheetOpen(false);
      flash(r.providerLabel ? `${r.providerLabel} connected (${r.model ?? "auto"}) — assistant enabled` : "Assistant enabled");
    });
  }

  return (
    <div className="hh-row hh-row--flat flex-col !items-start !gap-2">
      <div className="flex items-center justify-between w-full">
        <span className="hh-primary">
          AI assistant
          {data.configured && <span className="hh-badge ml-2">{data.providerLabel}</span>}
        </span>
        {data.enabled ? (
          <span className="hh-badge hh-badge--success">enabled</span>
        ) : data.configured ? (
          <span className="hh-badge hh-badge--warning">disabled</span>
        ) : (
          <span className="hh-badge hh-badge--warning">not configured</span>
        )}
      </div>

      {toast && (
        <div className="flex items-center gap-2">
          <span className="hh-dot hh-dot--green" />
          <span className="hh-secondary">{toast}</span>
        </div>
      )}

      <span className="hh-secondary">
        One universal key box: paste an Anthropic, OpenAI, or Google Gemini API key —
        the Hub detects the provider, verifies it live, and the assistant pill goes
        live app-wide. Actions run as the signed-in user with UI role limits;
        mutations always confirm.
      </span>
      <span className="hh-caption">
        Two directions, honestly: (1) this card = Hub calls the Anthropic API with the org
        key — there is no &quot;Sign in with Claude&quot; for this, subscription accounts cannot pay
        for API traffic. (2) Coming once the Hub is hosted publicly: add Henley Hub as a
        connector inside your own Claude app and sign in with your Hub account — your
        Claude subscription covers that usage.
      </span>
      {data.configured && (
        <span className="hh-secondary">
          {data.providerLabel} key {data.apiKeyMasked} · model {data.model}
        </span>
      )}

      <span className="flex flex-wrap gap-2 mt-1">
        {isCeo && (
          <button
            className="btn-secondary text-xs"
            onClick={() => {
              setReplaceKey(!data.hasKey);
              setSheetError(null);
              setSheetOpen(true);
            }}
          >
            {data.configured ? "Edit" : "Configure"}
          </button>
        )}
        {isCeo && data.configured && (
          <button
            className="btn-secondary text-xs inline-flex items-center gap-1.5"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await setAssistantEnabled(!data.enabled);
                flash(r.ok ? (data.enabled ? "Assistant disabled — launcher hidden" : "Assistant enabled") : r.error ?? "Failed");
              })
            }
          >
            {pending && <Loader2 size={12} className="animate-spin" />}
            {data.enabled ? "Disable" : "Enable"}
          </button>
        )}
        {isCeo && data.configured && (
          <button
            className="btn-ghost text-xs"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await disconnectAssistant();
                flash(r.ok ? "Key cleared" : r.error ?? "Failed");
              })
            }
          >
            Disconnect
          </button>
        )}
      </span>

      {sheetOpen &&
        createPortal(
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/55" onClick={() => setSheetOpen(false)} />
            <div className="hh-panel relative w-full max-w-md">
              <div className="flex items-center justify-between">
                <h3 className="hh-label">{data.configured ? "Edit AI assistant" : "Configure AI assistant"}</h3>
                <button className="hh-close" onClick={() => setSheetOpen(false)} aria-label="Close">×</button>
              </div>
              <p className="hh-caption mt-2">
                Anthropic (sk-ant-…), OpenAI (sk-…) or Gemini (AIza… or AQ.…) — provider is
                detected automatically and the key is verified before enabling. Stored
                in the Hub database only, never in source or env files.
              </p>
              <form action={onSave} className="mt-4 flex flex-col gap-3">
                <div>
                  <label className="hh-label block mb-1.5">API key</label>
                  {data.hasKey && !replaceKey ? (
                    <div className="flex items-center justify-between">
                      <span className="hh-secondary">Stored key kept ({data.apiKeyMasked})</span>
                      <button type="button" className="btn-ghost text-xs" onClick={() => setReplaceKey(true)}>
                        Replace key
                      </button>
                    </div>
                  ) : (
                    <input
                      name="apiKey"
                      type="password"
                      className="input"
                      autoComplete="new-password"
                      placeholder="sk-ant-… / sk-… / AIza… / AQ.…"
                      required={!data.hasKey}
                    />
                  )}
                </div>
                <div>
                  <label className="hh-label block mb-1.5">Model (blank = provider default)</label>
                  <input name="model" className="input" defaultValue={data.model} placeholder="auto" />
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
                    Save &amp; enable
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
