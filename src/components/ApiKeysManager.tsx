"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { createApiKey, rotateApiKey, revokeApiKey, updateApiKeyScopes } from "@/app/(app)/settings/apiKeyActions";

export type KeyActivity = {
  id: string;
  ts: string;
  method: string;
  path: string;
  status: number;
  scopeUsed: string | null;
  durationMs: number;
};
export type KeyAudit = { id: string; ts: string; action: string; actorName: string; detail: string | null };
export type ApiKeyRow = {
  id: string;
  name: string;
  hashPrefix: string;
  scopes: string[];
  createdByName: string;
  createdAt: string;
  lastUsedAt: string | null;
  revoked: boolean;
  activity: KeyActivity[];
  audits: KeyAudit[];
};
export type ScopeGroup = { resource: string; scopes: string[] };

function rel(iso: string | null): string {
  if (!iso) return "never";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export default function ApiKeysManager({
  keys,
  scopeGroups,
  isCeo,
}: {
  keys: ApiKeyRow[];
  scopeGroups: ScopeGroup[];
  isCeo: boolean;
}) {
  const [pending, start] = useTransition();
  const [detailId, setDetailId] = useState<string | null>(null);
  const [tab, setTab] = useState<"overview" | "activity" | "audit">("overview");
  const [createOpen, setCreateOpen] = useState(false);
  const [reveal, setReveal] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [editScopes, setEditScopes] = useState<Set<string> | null>(null);

  const detail = keys.find((k) => k.id === detailId) ?? null;

  function toggle(set: Set<string>, scope: string): Set<string> {
    const next = new Set(set);
    if (next.has(scope)) next.delete(scope);
    else next.add(scope);
    return next;
  }

  function onCreate(formData: FormData) {
    setErr(null);
    start(async () => {
      const r = await createApiKey(String(formData.get("name") || ""), [...picked]);
      if (!r.ok) return setErr(r.error ?? "Could not create key");
      setCreateOpen(false);
      setPicked(new Set());
      setReveal(r.key ?? null);
    });
  }

  // ---- Detail view ----
  if (detail) {
    return (
      <div className="flex flex-col gap-4">
        <button className="btn-ghost text-xs self-start" onClick={() => { setDetailId(null); setEditScopes(null); }}>
          ← Back to keys
        </button>
        <div className="flex items-center justify-between">
          <span className="hh-primary">{detail.name}</span>
          <span className={`hh-badge ${detail.revoked ? "hh-badge--danger" : "hh-badge--success"}`}>
            {detail.revoked ? "revoked" : "active"}
          </span>
        </div>

        <div className="flex gap-4 border-b border-glass-border">
          {(["overview", "activity", "audit"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`border-b-2 py-2 text-sm capitalize ${tab === t ? "border-accent text-accent font-semibold" : "border-transparent text-ink-muted"}`}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === "overview" && (
          <div className="flex flex-col gap-3 text-sm">
            <Row k="Key" v={`${detail.hashPrefix}••••••`} />
            <Row k="Created by" v={detail.createdByName} />
            <Row k="Created" v={rel(detail.createdAt)} />
            <Row k="Last used" v={rel(detail.lastUsedAt)} />
            <div>
              <div className="hh-label mb-1.5">Scopes</div>
              {isCeo && !detail.revoked ? (
                <>
                  <div className="flex flex-col gap-2">
                    {scopeGroups.map((g) => (
                      <div key={g.resource} className="flex flex-wrap gap-1.5">
                        {g.scopes.map((s) => {
                          const set = editScopes ?? new Set(detail.scopes);
                          return (
                            <button
                              key={s}
                              onClick={() => setEditScopes(toggle(editScopes ?? new Set(detail.scopes), s))}
                              className={`hh-chip ${set.has(s) ? "hh-badge--success" : "opacity-60"}`}
                            >
                              {s}
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                  {editScopes && (
                    <button
                      className="btn-secondary text-xs mt-2"
                      disabled={pending}
                      onClick={() =>
                        start(async () => {
                          const r = await updateApiKeyScopes(detail.id, [...editScopes]);
                          if (r.ok) setEditScopes(null);
                          else setErr(r.error ?? "Could not update scopes");
                        })
                      }
                    >
                      Save scopes
                    </button>
                  )}
                </>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {detail.scopes.map((s) => (
                    <span key={s} className="hh-chip">{s}</span>
                  ))}
                </div>
              )}
            </div>
            {isCeo && !detail.revoked && (
              <div className="flex gap-2 mt-2">
                <button
                  className="btn-secondary text-xs inline-flex items-center gap-1.5"
                  disabled={pending}
                  onClick={() => start(async () => { const r = await rotateApiKey(detail.id); if (r.ok) setReveal(r.key ?? null); else setErr(r.error ?? "Rotate failed"); })}
                >
                  {pending && <Loader2 size={12} className="animate-spin" />} Rotate
                </button>
                <button
                  className="btn-ghost text-xs"
                  disabled={pending}
                  onClick={() => start(async () => { const r = await revokeApiKey(detail.id); if (!r.ok) setErr(r.error ?? "Revoke failed"); else setDetailId(null); })}
                >
                  Revoke
                </button>
              </div>
            )}
            {err && <span className="hh-secondary text-status-error">{err}</span>}
          </div>
        )}

        {tab === "activity" && <ActivityTable rows={detail.activity} />}
        {tab === "audit" && <AuditTable rows={detail.audits} />}

        {reveal && <RevealModal keyValue={reveal} onClose={() => setReveal(null)} />}
      </div>
    );
  }

  // ---- List view ----
  return (
    <div className="flex flex-col gap-3">
      {isCeo && (
        <div className="flex justify-end">
          <button className="btn-primary text-xs" onClick={() => { setCreateOpen(true); setErr(null); }}>
            Create key
          </button>
        </div>
      )}

      {keys.length === 0 ? (
        <p className="hh-secondary">No API keys yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b border-glass-border">
              <tr>
                <th className="hh-label px-3 py-2 text-left">Name</th>
                <th className="hh-label px-3 py-2 text-left">Scopes</th>
                <th className="hh-label px-3 py-2 text-left">Created by</th>
                <th className="hh-label px-3 py-2 text-left">Last used</th>
                <th className="hh-label px-3 py-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-glass-border">
              {keys.map((k) => (
                <tr key={k.id} className="hh-row--flat cursor-pointer" onClick={() => { setDetailId(k.id); setTab("overview"); }}>
                  <td className="px-3 py-2.5 hh-primary">{k.name}</td>
                  <td className="px-3 py-2.5 hh-secondary">{k.scopes.length} · view</td>
                  <td className="px-3 py-2.5 hh-secondary">{k.createdByName}</td>
                  <td className="px-3 py-2.5 hh-secondary">{rel(k.lastUsedAt)}</td>
                  <td className="px-3 py-2.5">
                    <span className={`hh-badge ${k.revoked ? "hh-badge--danger" : "hh-badge--success"}`}>
                      {k.revoked ? "revoked" : "active"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {createOpen && (
        <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/55" onClick={() => setCreateOpen(false)} />
          <div className="hh-panel relative w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-b-none sm:rounded-[20px]">
            <div className="flex items-center justify-between">
              <h3 className="hh-label">Create API key</h3>
              <button className="hh-close" onClick={() => setCreateOpen(false)}>×</button>
            </div>
            <form action={onCreate} className="mt-4 flex flex-col gap-3">
              <div>
                <label className="hh-label block mb-1.5">Name</label>
                <input name="name" className="input" maxLength={100} required placeholder="e.g. Reporting service" />
              </div>
              <div>
                <label className="hh-label block mb-1.5">Scopes</label>
                <div className="flex flex-col gap-2">
                  {scopeGroups.map((g) => (
                    <div key={g.resource}>
                      <div className="hh-caption mb-1">{g.resource}</div>
                      <div className="flex flex-wrap gap-1.5">
                        {g.scopes.map((s) => (
                          <button
                            type="button"
                            key={s}
                            onClick={() => setPicked(toggle(picked, s))}
                            className={`hh-chip ${picked.has(s) ? "hh-badge--success" : "opacity-60"}`}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {err && <span className="hh-secondary text-status-error">{err}</span>}
              <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end mt-1">
                <button type="button" className="btn-secondary w-full sm:w-auto" onClick={() => setCreateOpen(false)}>Cancel</button>
                <button type="submit" className="btn-primary w-full sm:w-auto inline-flex items-center justify-center gap-1.5" disabled={pending}>
                  {pending && <Loader2 size={14} className="animate-spin" />} Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {reveal && <RevealModal keyValue={reveal} onClose={() => setReveal(null)} />}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="hh-secondary">{k}</span>
      <span className="hh-primary text-right break-all">{v}</span>
    </div>
  );
}

function RevealModal({ keyValue, onClose }: { keyValue: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" />
      <div className="hh-panel relative w-full max-w-md">
        <h3 className="hh-label">Copy your API key now</h3>
        <p className="hh-secondary mt-2">This is the only time you&apos;ll see this key. Store it somewhere safe.</p>
        <code className="hh-chip break-all block mt-3 p-3">{keyValue}</code>
        <div className="flex gap-2 justify-end mt-4">
          <button
            className="btn-secondary text-xs"
            onClick={() => { navigator.clipboard?.writeText(keyValue); setCopied(true); }}
          >
            {copied ? "Copied" : "Copy"}
          </button>
          <button className="btn-primary text-xs" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}

function ActivityTable({ rows }: { rows: KeyActivity[] }) {
  if (rows.length === 0) return <p className="hh-secondary">No API calls yet.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="border-b border-glass-border">
          <tr>
            <th className="hh-label px-3 py-2 text-left">When</th>
            <th className="hh-label px-3 py-2 text-left">Method</th>
            <th className="hh-label px-3 py-2 text-left">Path</th>
            <th className="hh-label px-3 py-2 text-right">Status</th>
            <th className="hh-label px-3 py-2 text-left">Scope</th>
            <th className="hh-label px-3 py-2 text-right">ms</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-glass-border">
          {rows.map((r) => (
            <tr key={r.id} className="hh-row--flat">
              <td className="px-3 py-2 hh-secondary">{rel(r.ts)}</td>
              <td className="px-3 py-2 hh-secondary">{r.method}</td>
              <td className="px-3 py-2 hh-secondary break-all">{r.path}</td>
              <td className="px-3 py-2 text-right hh-primary">{r.status}</td>
              <td className="px-3 py-2 hh-secondary">{r.scopeUsed ?? "—"}</td>
              <td className="px-3 py-2 text-right hh-secondary">{r.durationMs}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AuditTable({ rows }: { rows: KeyAudit[] }) {
  if (rows.length === 0) return <p className="hh-secondary">No audit entries.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="border-b border-glass-border">
          <tr>
            <th className="hh-label px-3 py-2 text-left">When</th>
            <th className="hh-label px-3 py-2 text-left">Action</th>
            <th className="hh-label px-3 py-2 text-left">Actor</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-glass-border">
          {rows.map((r) => (
            <tr key={r.id} className="hh-row--flat">
              <td className="px-3 py-2 hh-secondary">{rel(r.ts)}</td>
              <td className="px-3 py-2 hh-primary">{r.action}</td>
              <td className="px-3 py-2 hh-secondary">{r.actorName}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
