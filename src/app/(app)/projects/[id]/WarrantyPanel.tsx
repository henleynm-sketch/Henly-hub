"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Circle, ChevronRight, Plus, Pencil, Trash2, Check, X, RotateCcw } from "lucide-react";
import {
  advanceWarrantyPhase,
  setWarrantyPhase,
  createDeficiency,
  updateDeficiency,
  resolveDeficiency,
  reopenDeficiency,
  deleteDeficiency,
  flagDeficiency,
} from "./warrantyActions";
import { WARRANTY_PHASE } from "@/lib/taxonomy";

// ─── Types ────────────────────────────────────────────────────────────────────

type WarrantyItem = {
  id: string;
  title: string;
  description: string | null;
  status: string;        // "open" | "resolved"
  reportedAt: string;
  resolvedAt: string | null;
  clientVisible: boolean;
};

type Props = {
  projectId: string;
  warrantyPhase: string | null;
  items: WarrantyItem[];
  role: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PHASES: string[] = [...WARRANTY_PHASE];

function StatusBadge({ status }: { status: string }) {
  const resolved = status === "resolved";
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
      style={{
        background: resolved
          ? "rgba(34,197,94,0.12)"
          : "rgba(239,68,68,0.10)",
        color: resolved
          ? "var(--hh-dot-green, #22c55e)"
          : "var(--hh-dot-red, #ef4444)",
        border: resolved
          ? "1px solid rgba(34,197,94,0.25)"
          : "1px solid rgba(239,68,68,0.20)",
      }}
    >
      {resolved ? <CheckCircle2 size={10} /> : <Circle size={10} />}
      {resolved ? "Resolved" : "Open"}
    </span>
  );
}

function Toast({ msg, ok, onDone }: { msg: string; ok: boolean; onDone: () => void }) {
  return (
    <div
      role="status"
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        zIndex: 9999,
        padding: "10px 18px",
        borderRadius: 8,
        fontSize: 13,
        fontWeight: 600,
        color: "#fff",
        background: ok ? "var(--hh-dot-green, #22c55e)" : "var(--hh-dot-red, #ef4444)",
        boxShadow: "0 4px 16px rgba(0,0,0,0.18)",
      }}
    >
      {msg}
      <button onClick={onDone} style={{ marginLeft: 10, opacity: 0.7 }}>✕</button>
    </div>
  );
}

// ─── Phase tracker ────────────────────────────────────────────────────────────

function PhaseTracker({
  current,
  role,
  projectId,
  onAction,
}: {
  current: string | null;
  role: string;
  projectId: string;
  onAction: (ok: boolean, msg: string) => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [showPicker, setShowPicker] = useState(false);
  const isManager = role === "CEO" || role === "OFFICE";

  const currentIdx = current ? PHASES.indexOf(current) : -1;
  const atEnd = currentIdx >= PHASES.length - 1;
  const notStarted = currentIdx === -1;

  function handleAdvance() {
    start(async () => {
      const r = await advanceWarrantyPhase(projectId);
      onAction(r.ok, r.ok ? "Phase advanced" : (r.error ?? "Failed"));
      if (r.ok) router.refresh();
    });
  }

  function handleSetPhase(phase: string) {
    start(async () => {
      const r = await setWarrantyPhase(projectId, phase);
      onAction(r.ok, r.ok ? "Phase updated" : (r.error ?? "Failed"));
      if (r.ok) { setShowPicker(false); router.refresh(); }
    });
  }

  return (
    <div className="space-y-3">
      {/* Stepper */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {PHASES.map((phase, idx) => {
          const done    = idx < currentIdx;
          const active  = idx === currentIdx;
          const future  = idx > currentIdx;
          return (
            <div key={phase} className="flex items-center gap-1 shrink-0">
              <div className="flex flex-col items-center gap-1">
                <div
                  className="grid h-6 w-6 place-items-center rounded-full text-[10px] font-bold transition-all"
                  style={{
                    background: done
                      ? "var(--hh-dot-green, #22c55e)"
                      : active
                      ? "var(--accent)"
                      : "var(--glass-bg)",
                    color: done || active ? "#fff" : "var(--ink-muted)",
                    border: future ? "1.5px solid var(--glass-border)" : "none",
                  }}
                >
                  {done ? <Check size={10} /> : idx + 1}
                </div>
                <span
                  className="text-[9px] font-medium text-center w-16 leading-tight"
                  style={{
                    color: active
                      ? "var(--accent)"
                      : done
                      ? "var(--hh-dot-green, #22c55e)"
                      : "var(--ink-muted)",
                  }}
                >
                  {phase}
                </span>
              </div>
              {idx < PHASES.length - 1 && (
                <ChevronRight size={10} className="text-ink-muted shrink-0 mb-4" />
              )}
            </div>
          );
        })}
      </div>

      {/* Current phase label */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-ink-soft">Current phase:</span>
        <span
          className="text-sm font-semibold"
          style={{ color: notStarted ? "var(--ink-muted)" : "var(--accent)" }}
        >
          {current ?? "Not started"}
        </span>
      </div>

      {/* Manager controls */}
      {isManager && (
        <div className="flex gap-2 flex-wrap">
          {!atEnd && (
            <button
              onClick={handleAdvance}
              className="btn-primary text-xs flex items-center gap-1"
              disabled={pending}
            >
              <ChevronRight size={12} />
              {notStarted ? "Start warranty" : "Advance phase"}
            </button>
          )}
          <button
            onClick={() => setShowPicker((v) => !v)}
            className="btn-ghost text-xs"
            disabled={pending}
          >
            Set phase manually
          </button>
        </div>
      )}

      {/* Phase picker */}
      {showPicker && isManager && (
        <div
          className="rounded-lg p-3 space-y-1"
          style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}
        >
          {PHASES.map((phase) => (
            <button
              key={phase}
              onClick={() => handleSetPhase(phase)}
              disabled={pending}
              className="w-full text-left px-3 py-1.5 rounded text-sm transition-colors"
              style={{
                background: phase === current ? "var(--accent-10, rgba(92,124,250,0.1))" : "transparent",
                color: phase === current ? "var(--accent)" : "var(--ink-soft)",
                fontWeight: phase === current ? 600 : 400,
              }}
            >
              {phase}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Deficiency list (manager view) ──────────────────────────────────────────

function DeficiencyManager({
  projectId,
  items,
  onAction,
}: {
  projectId: string;
  items: WarrantyItem[];
  onAction: (ok: boolean, msg: string) => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [showAddForm, setShowAddForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const r = await createDeficiency(projectId, fd);
      onAction(r.ok, r.ok ? "Deficiency added" : (r.error ?? "Failed"));
      if (r.ok) { setShowAddForm(false); router.refresh(); }
    });
  }

  function handleUpdate(itemId: string, e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const r = await updateDeficiency(itemId, fd);
      onAction(r.ok, r.ok ? "Saved" : (r.error ?? "Failed"));
      if (r.ok) { setEditId(null); router.refresh(); }
    });
  }

  function handleResolve(itemId: string) {
    start(async () => {
      const r = await resolveDeficiency(itemId);
      onAction(r.ok, r.ok ? "Marked resolved" : (r.error ?? "Failed"));
      if (r.ok) router.refresh();
    });
  }

  function handleReopen(itemId: string) {
    start(async () => {
      const r = await reopenDeficiency(itemId);
      onAction(r.ok, r.ok ? "Reopened" : (r.error ?? "Failed"));
      if (r.ok) router.refresh();
    });
  }

  function handleDelete(itemId: string) {
    if (!confirm("Delete this deficiency?")) return;
    start(async () => {
      const r = await deleteDeficiency(itemId);
      onAction(r.ok, r.ok ? "Deleted" : (r.error ?? "Failed"));
      if (r.ok) router.refresh();
    });
  }

  const open     = items.filter((i) => i.status === "open");
  const resolved = items.filter((i) => i.status === "resolved");

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-ink">
          Deficiency items
          {open.length > 0 && (
            <span
              className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full font-bold"
              style={{ background: "rgba(239,68,68,0.10)", color: "var(--hh-dot-red, #ef4444)" }}
            >
              {open.length} open
            </span>
          )}
        </span>
        <button
          onClick={() => setShowAddForm((v) => !v)}
          className="btn-ghost text-xs flex items-center gap-1"
        >
          <Plus size={12} /> Add deficiency
        </button>
      </div>

      {/* Add form */}
      {showAddForm && (
        <form
          onSubmit={handleCreate}
          className="rounded-lg p-4 space-y-3"
          style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}
        >
          <div>
            <label className="label text-xs">Title</label>
            <input className="input mt-0.5 text-sm" name="title" required placeholder="e.g. Door doesn't latch" />
          </div>
          <div>
            <label className="label text-xs">Description</label>
            <textarea className="input mt-0.5 text-sm" name="description" rows={2} placeholder="Details…" />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="cv-new" name="clientVisible" value="true" className="rounded" />
            <label htmlFor="cv-new" className="text-xs text-ink-soft">Visible to client</label>
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setShowAddForm(false)} className="btn-ghost text-xs">Cancel</button>
            <button type="submit" className="btn-primary text-xs" disabled={pending}>Add</button>
          </div>
        </form>
      )}

      {items.length === 0 && (
        <p className="text-xs text-ink-muted">No deficiency items yet.</p>
      )}

      {/* Open items */}
      {open.map((item) => (
        <div
          key={item.id}
          className="rounded-lg p-3 space-y-2"
          style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}
        >
          {editId === item.id ? (
            <form onSubmit={(e) => handleUpdate(item.id, e)} className="space-y-2">
              <input className="input text-sm" name="title" defaultValue={item.title} required />
              <textarea className="input text-sm" name="description" rows={2} defaultValue={item.description ?? ""} />
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id={`cv-${item.id}`}
                  name="clientVisible"
                  value="true"
                  defaultChecked={item.clientVisible}
                  className="rounded"
                />
                <label htmlFor={`cv-${item.id}`} className="text-xs text-ink-soft">Visible to client</label>
              </div>
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setEditId(null)} className="btn-ghost text-xs"><X size={12} /></button>
                <button type="submit" className="btn-primary text-xs" disabled={pending}><Check size={12} /></button>
              </div>
            </form>
          ) : (
            <>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-ink">{item.title}</div>
                  {item.description && (
                    <div className="text-xs text-ink-muted mt-0.5">{item.description}</div>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <StatusBadge status={item.status} />
                  {item.clientVisible && (
                    <span
                      className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold"
                      style={{
                        background: "rgba(92,124,250,0.1)",
                        color: "var(--accent)",
                        border: "1px solid rgba(92,124,250,0.2)",
                      }}
                    >
                      Client
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-ink-muted">
                  Reported {new Date(item.reportedAt).toLocaleDateString("en-CA")}
                </span>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleResolve(item.id)}
                    className="text-xs px-2 py-0.5 rounded font-medium transition-colors"
                    style={{ color: "var(--hh-dot-green, #22c55e)", background: "rgba(34,197,94,0.08)" }}
                    disabled={pending}
                  >
                    Resolve
                  </button>
                  <button onClick={() => setEditId(item.id)} className="p-1 text-ink-muted hover:text-ink">
                    <Pencil size={11} />
                  </button>
                  <button onClick={() => handleDelete(item.id)} className="p-1 text-ink-muted hover:text-red-500" disabled={pending}>
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      ))}

      {/* Resolved items (collapsed summary) */}
      {resolved.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-xs text-ink-muted select-none list-none flex items-center gap-1">
            <ChevronRight size={10} className="group-open:rotate-90 transition-transform" />
            {resolved.length} resolved {resolved.length === 1 ? "item" : "items"}
          </summary>
          <div className="mt-2 space-y-2">
            {resolved.map((item) => (
              <div
                key={item.id}
                className="rounded-lg p-3 opacity-70"
                style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm text-ink line-through">{item.title}</span>
                  <div className="flex items-center gap-1">
                    <StatusBadge status={item.status} />
                    <button
                      onClick={() => handleReopen(item.id)}
                      className="p-1 text-ink-muted hover:text-ink"
                      title="Reopen"
                      disabled={pending}
                    >
                      <RotateCcw size={11} />
                    </button>
                    <button onClick={() => handleDelete(item.id)} className="p-1 text-ink-muted hover:text-red-500" disabled={pending}>
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>
                {item.resolvedAt && (
                  <span className="text-[10px] text-ink-muted">
                    Resolved {new Date(item.resolvedAt).toLocaleDateString("en-CA")}
                  </span>
                )}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

// ─── Client portal view ───────────────────────────────────────────────────────

function ClientWarrantyView({
  projectId,
  warrantyPhase,
  items,
  onAction,
}: {
  projectId: string;
  warrantyPhase: string | null;
  items: WarrantyItem[];
  onAction: (ok: boolean, msg: string) => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [showFlag, setShowFlag] = useState(false);

  const currentIdx = warrantyPhase
    ? PHASES.indexOf(warrantyPhase)
    : -1;

  function handleFlag(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const r = await flagDeficiency(projectId, fd);
      onAction(r.ok, r.ok ? "Submitted — your team will follow up" : (r.error ?? "Failed"));
      if (r.ok) { setShowFlag(false); router.refresh(); }
    });
  }

  return (
    <div className="space-y-4">
      {/* Phase status */}
      <div
        className="rounded-lg p-4"
        style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}
      >
        <div className="text-xs font-bold uppercase tracking-widest text-ink-muted mb-2">
          Warranty Status
        </div>
        {warrantyPhase ? (
          <>
            <div className="text-base font-semibold" style={{ color: "var(--accent)" }}>
              {warrantyPhase}
            </div>
            <div className="text-xs text-ink-muted mt-1">
              Step {currentIdx + 1} of {PHASES.length}
            </div>
            {/* Simple progress bar */}
            <div
              className="mt-2 h-1.5 rounded-full"
              style={{ background: "var(--glass-border)" }}
            >
              <div
                className="h-1.5 rounded-full transition-all"
                style={{
                  width: `${((currentIdx + 1) / PHASES.length) * 100}%`,
                  background: "var(--accent)",
                }}
              />
            </div>
          </>
        ) : (
          <div className="text-sm text-ink-muted">Warranty not yet started.</div>
        )}
      </div>

      {/* Deficiency items visible to client */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-ink">Deficiency items</span>
          <button
            onClick={() => setShowFlag((v) => !v)}
            className="btn-ghost text-xs flex items-center gap-1"
          >
            <Plus size={12} /> Report an issue
          </button>
        </div>

        {showFlag && (
          <form
            onSubmit={handleFlag}
            className="rounded-lg p-4 space-y-3 mb-3"
            style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}
          >
            <div>
              <label className="label text-xs">What needs attention?</label>
              <input className="input mt-0.5 text-sm" name="title" required placeholder="e.g. Bathroom door sticking" />
            </div>
            <div>
              <label className="label text-xs">Details (optional)</label>
              <textarea className="input mt-0.5 text-sm" name="description" rows={2} />
            </div>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setShowFlag(false)} className="btn-ghost text-xs">Cancel</button>
              <button type="submit" className="btn-primary text-xs" disabled={pending}>Submit</button>
            </div>
          </form>
        )}

        {items.length === 0 ? (
          <p className="text-xs text-ink-muted">No open items.</p>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <div
                key={item.id}
                className="rounded-lg p-3"
                style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-ink">{item.title}</div>
                    {item.description && (
                      <div className="text-xs text-ink-muted mt-0.5">{item.description}</div>
                    )}
                  </div>
                  <StatusBadge status={item.status} />
                </div>
                <span className="text-[10px] text-ink-muted mt-1 block">
                  Reported {new Date(item.reportedAt).toLocaleDateString("en-CA")}
                  {item.resolvedAt && ` · Resolved ${new Date(item.resolvedAt).toLocaleDateString("en-CA")}`}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Root export ──────────────────────────────────────────────────────────────

export default function WarrantyPanel({ projectId, warrantyPhase, items, role }: Props) {
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  function flash(ok: boolean, msg: string) {
    setToast({ ok, msg });
    setTimeout(() => setToast(null), 4000);
  }

  const isManager = role === "CEO" || role === "OFFICE";
  const isClient  = role === "CLIENT";
  // FIELD and SUB don't see warranty admin — return null
  if (!isManager && !isClient) return null;

  if (isClient) {
    return (
      <div className="card p-5 space-y-4">
        <div className="text-sm font-semibold text-ink">Your Warranty</div>
        <ClientWarrantyView
          projectId={projectId}
          warrantyPhase={warrantyPhase}
          items={items}
          onAction={flash}
        />
        {toast && <Toast msg={toast.msg} ok={toast.ok} onDone={() => setToast(null)} />}
      </div>
    );
  }

  // Manager view
  return (
    <div className="card p-5 space-y-5">
      <div className="text-sm font-semibold text-ink">Warranty</div>

      <PhaseTracker
        current={warrantyPhase}
        role={role}
        projectId={projectId}
        onAction={flash}
      />

      <div style={{ borderTop: "1px solid var(--glass-border)", paddingTop: 16 }}>
        <DeficiencyManager
          projectId={projectId}
          items={items}
          onAction={flash}
        />
      </div>

      {toast && <Toast msg={toast.msg} ok={toast.ok} onDone={() => setToast(null)} />}
    </div>
  );
}
