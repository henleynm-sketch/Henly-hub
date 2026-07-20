"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, ChevronDown, CheckCircle2, RotateCcw } from "lucide-react";
import { setErrorResolved } from "./diagnosticsAdminActions";

export type ErrorRow = {
  id: string;
  level: string;
  source: string;
  message: string;
  stack: string | null;
  context: string | null;
  route: string | null;
  userId: string | null;
  resolved: boolean;
  createdLabel: string;
  createdIso: string;
  resolvedLabel: string | null;
};

export type HealthRow = {
  key: string;
  label: string;
  status: "green" | "amber" | "red" | "neutral";
  detail: string;
};

const REFRESH_MS = 15_000;

function levelBadgeClass(level: string): string {
  if (level === "error") return "badge-red";
  if (level === "warning") return "badge-amber";
  if (level === "info") return "badge-blue";
  return "badge-slate";
}

function healthDotClass(status: HealthRow["status"]): string {
  if (status === "green") return "hh-dot hh-dot--green";
  if (status === "amber") return "hh-dot hh-dot--orange";
  if (status === "red") return "hh-dot hh-dot--red";
  return "hh-dot bg-slate-400/70";
}

export default function DiagnosticsClient({
  rows,
  health,
  openCount,
}: {
  rows: ErrorRow[];
  health: HealthRow[];
  openCount: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [level, setLevel] = useState("all");
  const [source, setSource] = useState("all");
  const [status, setStatus] = useState<"open" | "resolved" | "all">("open");
  const [expanded, setExpanded] = useState<string | null>(null);

  // Poll: re-run the server component every 15s so new errors + health surface
  // without a manual reload. Local filter state is preserved across refreshes.
  useEffect(() => {
    const t = setInterval(() => router.refresh(), REFRESH_MS);
    return () => clearInterval(t);
  }, [router]);

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        if (level !== "all" && r.level !== level) return false;
        if (source !== "all" && r.source !== source) return false;
        if (status === "open" && r.resolved) return false;
        if (status === "resolved" && !r.resolved) return false;
        return true;
      }),
    [rows, level, source, status],
  );

  function toggleResolved(row: ErrorRow) {
    startTransition(async () => {
      await setErrorResolved(row.id, !row.resolved);
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      {/* Health strip */}
      <div className="hh-panel p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="hh-label">Integration health</h2>
          <button
            type="button"
            onClick={() => router.refresh()}
            className="btn-ghost inline-flex items-center gap-1.5 text-xs"
            aria-label="Refresh now"
          >
            <RefreshCw size={13} className={pending ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {health.map((h) => (
            <div
              key={h.key}
              className="inline-flex items-center gap-2 rounded-lg border border-glass-border bg-glass-bg px-3 py-2"
              title={h.detail}
            >
              <span className={healthDotClass(h.status)} aria-hidden="true" />
              <span className="text-sm font-medium text-ink">{h.label}</span>
              <span className="text-xs text-ink-soft">· {h.detail}</span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-ink-soft">Auto-refreshes every 15s. Integration status is read-only.</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="label" htmlFor="diag-level">Level</label>
          <select id="diag-level" className="input" value={level} onChange={(e) => setLevel(e.target.value)}>
            <option value="all">All levels</option>
            <option value="error">Error</option>
            <option value="warning">Warning</option>
            <option value="info">Info</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="diag-source">Source</label>
          <select id="diag-source" className="input" value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="all">All sources</option>
            <option value="server-action">Server action</option>
            <option value="api">API</option>
            <option value="client">Client</option>
            <option value="integration">Integration</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="diag-status">Status</label>
          <select
            id="diag-status"
            className="input"
            value={status}
            onChange={(e) => setStatus(e.target.value as "open" | "resolved" | "all")}
          >
            <option value="open">Unresolved</option>
            <option value="resolved">Resolved</option>
            <option value="all">All</option>
          </select>
        </div>
        <div className="ml-auto flex items-center gap-2 pb-1 text-sm text-ink-soft">
          <span className="badge-amber">{openCount} open</span>
          <span>{filtered.length} shown</span>
        </div>
      </div>

      {/* List */}
      <div className="hh-panel divide-y divide-glass-border">
        {filtered.length === 0 ? (
          <div className="p-8 text-center">
            <CheckCircle2 size={22} className="mx-auto mb-2 text-emerald-500" />
            <p className="text-sm font-medium text-ink">
              {rows.length === 0 ? "No errors logged" : "No errors match these filters"}
            </p>
            <p className="mt-1 text-xs text-ink-soft">
              {rows.length === 0
                ? "The Hub is quiet. Captured errors will appear here automatically."
                : "Try widening the level, source, or status filters."}
            </p>
          </div>
        ) : (
          filtered.map((r) => {
            const isOpen = expanded === r.id;
            return (
              <div key={r.id} className="p-3">
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    onClick={() => setExpanded(isOpen ? null : r.id)}
                    className="mt-0.5 text-ink-soft transition-transform hover:text-ink"
                    aria-label={isOpen ? "Collapse details" : "Expand details"}
                    aria-expanded={isOpen}
                  >
                    <ChevronDown size={16} className={isOpen ? "rotate-180 transition-transform" : "transition-transform"} />
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={levelBadgeClass(r.level)}>{r.level}</span>
                      <span className="badge-slate">{r.source}</span>
                      {r.resolved && <span className="badge-green">resolved</span>}
                      <span className="text-xs text-ink-soft">{r.createdLabel}</span>
                    </div>
                    <p className="mt-1 break-words text-sm text-ink">{r.message}</p>
                    {r.route && <p className="mt-0.5 font-mono text-xs text-ink-soft">{r.route}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleResolved(r)}
                    disabled={pending}
                    className="btn-secondary inline-flex shrink-0 items-center gap-1.5 text-xs disabled:opacity-50"
                  >
                    {r.resolved ? <RotateCcw size={13} /> : <CheckCircle2 size={13} />}
                    {r.resolved ? "Reopen" : "Resolve"}
                  </button>
                </div>

                {isOpen && (
                  <div className="mt-3 space-y-3 pl-7">
                    {r.stack && (
                      <div>
                        <div className="hh-label mb-1">Stack</div>
                        <pre className="max-h-64 overflow-auto rounded-lg border border-glass-border bg-black/20 p-3 font-mono text-xs text-ink-soft">
                          {r.stack}
                        </pre>
                      </div>
                    )}
                    {r.context && (
                      <div>
                        <div className="hh-label mb-1">Context (redacted)</div>
                        <pre className="max-h-48 overflow-auto rounded-lg border border-glass-border bg-black/20 p-3 font-mono text-xs text-ink-soft">
                          {r.context}
                        </pre>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-ink-soft">
                      <span>Logged: {new Date(r.createdIso).toLocaleString()}</span>
                      {r.userId && <span>User: {r.userId}</span>}
                      {r.resolved && r.resolvedLabel && <span>Resolved {r.resolvedLabel}</span>}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
