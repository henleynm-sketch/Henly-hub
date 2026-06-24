"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, Trash2, Pencil, CalendarDays, DollarSign,
  ChevronDown, ChevronRight, Check, X,
} from "lucide-react";
import {
  createTemplate, updateTemplate, deleteTemplate,
  addScheduleItem, updateScheduleItem, deleteScheduleItem,
  addBudgetItem, updateBudgetItem, deleteBudgetItem,
} from "./templateActions";

// ─── Types ────────────────────────────────────────────────────────────────────

type ScheduleItem = {
  id: string;
  name: string;
  offsetStartDays: number;
  durationDays: number;
  order: number;
};

type BudgetItem = {
  id: string;
  category: string;
  budgetCents: number;
};

type Template = {
  id: string;
  name: string;
  jobType: string;
  createdAt: string;
  scheduleItems: ScheduleItem[];
  budgetItems: BudgetItem[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(cents: number) {
  return "$" + (cents / 100).toLocaleString("en-CA", { minimumFractionDigits: 0 });
}

function Toast({
  msg,
  ok,
  onDone,
}: {
  msg: string;
  ok: boolean;
  onDone: () => void;
}) {
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
        background: ok
          ? "var(--hh-dot-green, #22c55e)"
          : "var(--hh-dot-red,   #ef4444)",
        boxShadow: "0 4px 16px rgba(0,0,0,0.18)",
      }}
      onAnimationEnd={onDone}
    >
      {msg}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function TemplatesClient({
  templates: initial,
  jobTypes,
}: {
  templates: Template[];
  jobTypes: string[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(
    initial[0]?.id ?? null
  );
  const [showNewTemplate, setShowNewTemplate] = useState(false);
  const [editTemplateId, setEditTemplateId] = useState<string | null>(null);
  const [editSched, setEditSched] = useState<string | null>(null);
  const [editBudget, setEditBudget] = useState<string | null>(null);
  const [expandSched, setExpandSched] = useState(true);
  const [expandBudget, setExpandBudget] = useState(true);

  function flash(ok: boolean, msg: string) {
    setToast({ ok, msg });
    setTimeout(() => setToast(null), 3000);
  }

  const selected = initial.find((t) => t.id === selectedId) ?? null;

  // ── New / edit template header ─────────────────────────────────────────────

  function handleCreateTemplate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const r = await createTemplate(fd);
      if (r.ok) {
        flash(true, "Template created");
        setShowNewTemplate(false);
        router.refresh();
      } else flash(false, r.error ?? "Failed");
    });
  }

  function handleUpdateTemplate(
    templateId: string,
    e: React.FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const r = await updateTemplate(templateId, fd);
      if (r.ok) {
        flash(true, "Saved");
        setEditTemplateId(null);
        router.refresh();
      } else flash(false, r.error ?? "Failed");
    });
  }

  function handleDeleteTemplate(templateId: string) {
    if (!confirm("Delete this template and all its items?")) return;
    start(async () => {
      const r = await deleteTemplate(templateId);
      if (r.ok) {
        if (selectedId === templateId) setSelectedId(null);
        flash(true, "Deleted");
        router.refresh();
      } else flash(false, r.error ?? "Failed");
    });
  }

  // ── Schedule items ──────────────────────────────────────────────────────────

  function handleAddSched(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selected) return;
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const r = await addScheduleItem(selected.id, fd);
      if (r.ok) {
        flash(true, "Item added");
        (e.target as HTMLFormElement).reset();
        router.refresh();
      } else flash(false, r.error ?? "Failed");
    });
  }

  function handleUpdateSched(
    itemId: string,
    e: React.FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const r = await updateScheduleItem(itemId, fd);
      if (r.ok) {
        flash(true, "Saved");
        setEditSched(null);
        router.refresh();
      } else flash(false, r.error ?? "Failed");
    });
  }

  function handleDeleteSched(itemId: string) {
    start(async () => {
      const r = await deleteScheduleItem(itemId);
      if (r.ok) { flash(true, "Removed"); router.refresh(); }
      else flash(false, r.error ?? "Failed");
    });
  }

  // ── Budget items ────────────────────────────────────────────────────────────

  function handleAddBudget(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selected) return;
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const r = await addBudgetItem(selected.id, fd);
      if (r.ok) {
        flash(true, "Item added");
        (e.target as HTMLFormElement).reset();
        router.refresh();
      } else flash(false, r.error ?? "Failed");
    });
  }

  function handleUpdateBudget(
    itemId: string,
    e: React.FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const r = await updateBudgetItem(itemId, fd);
      if (r.ok) {
        flash(true, "Saved");
        setEditBudget(null);
        router.refresh();
      } else flash(false, r.error ?? "Failed");
    });
  }

  function handleDeleteBudget(itemId: string) {
    start(async () => {
      const r = await deleteBudgetItem(itemId);
      if (r.ok) { flash(true, "Removed"); router.refresh(); }
      else flash(false, r.error ?? "Failed");
    });
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex gap-4 h-[calc(100vh-140px)]">
      {/* ── Left: template list ──────────────────────────────────────── */}
      <div
        className="w-64 shrink-0 flex flex-col gap-2 overflow-y-auto"
        style={{ borderRight: "1px solid var(--glass-border)", paddingRight: 12 }}
      >
        <button
          onClick={() => { setShowNewTemplate(true); setSelectedId(null); }}
          className="btn-primary flex items-center gap-1.5 text-sm justify-center"
          disabled={pending}
        >
          <Plus size={14} /> New template
        </button>

        {initial.length === 0 && (
          <p className="text-xs text-ink-muted mt-4 text-center">No templates yet</p>
        )}

        {/* Group by jobType */}
        {[...new Set(initial.map((t) => t.jobType))].map((jt) => (
          <div key={jt}>
            <div
              className="text-[10px] font-bold uppercase tracking-widest text-ink-muted px-2 py-1 mt-2"
              style={{ letterSpacing: "0.08em" }}
            >
              {jt}
            </div>
            {initial
              .filter((t) => t.jobType === jt)
              .map((t) => (
                <button
                  key={t.id}
                  onClick={() => { setSelectedId(t.id); setShowNewTemplate(false); }}
                  className="w-full text-left px-3 py-2 rounded-lg text-sm transition-colors"
                  style={{
                    background:
                      selectedId === t.id
                        ? "var(--accent-10, rgba(92,124,250,0.1))"
                        : "transparent",
                    color: selectedId === t.id ? "var(--accent)" : "var(--ink-soft)",
                    fontWeight: selectedId === t.id ? 600 : 400,
                    border:
                      selectedId === t.id
                        ? "1px solid var(--accent-20, rgba(92,124,250,0.2))"
                        : "1px solid transparent",
                  }}
                >
                  {t.name}
                  <span className="block text-[10px] text-ink-muted font-normal">
                    {t.scheduleItems.length} tasks · {t.budgetItems.length} budget lines
                  </span>
                </button>
              ))}
          </div>
        ))}
      </div>

      {/* ── Right: template editor ───────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto space-y-4">

        {/* ── New template form ──────────────────────────────────────── */}
        {showNewTemplate && (
          <div className="card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-ink">New template</span>
              <button onClick={() => setShowNewTemplate(false)}>
                <X size={16} className="text-ink-muted" />
              </button>
            </div>
            <form onSubmit={handleCreateTemplate} className="space-y-3">
              <div>
                <label className="label">Template name</label>
                <input className="input mt-1" name="name" required placeholder="e.g. Standard Bathroom Reno" />
              </div>
              <div>
                <label className="label">Job type</label>
                <select className="input mt-1" name="jobType" required>
                  <option value="">Select…</option>
                  {jobTypes.map((jt) => (
                    <option key={jt} value={jt}>{jt}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setShowNewTemplate(false)} className="btn-ghost text-sm">
                  Cancel
                </button>
                <button type="submit" className="btn-primary text-sm" disabled={pending}>
                  {pending ? "Creating…" : "Create"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── Selected template ──────────────────────────────────────── */}
        {selected && (
          <>
            {/* Header card */}
            <div className="card p-5">
              {editTemplateId === selected.id ? (
                <form
                  onSubmit={(e) => handleUpdateTemplate(selected.id, e)}
                  className="space-y-3"
                >
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">Template name</label>
                      <input
                        className="input mt-1"
                        name="name"
                        defaultValue={selected.name}
                        required
                      />
                    </div>
                    <div>
                      <label className="label">Job type</label>
                      <select
                        className="input mt-1"
                        name="jobType"
                        defaultValue={selected.jobType}
                        required
                      >
                        {jobTypes.map((jt) => (
                          <option key={jt} value={jt}>{jt}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button type="button" onClick={() => setEditTemplateId(null)} className="btn-ghost text-sm">
                      Cancel
                    </button>
                    <button type="submit" className="btn-primary text-sm" disabled={pending}>
                      <Check size={13} className="mr-1" /> Save
                    </button>
                  </div>
                </form>
              ) : (
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-semibold text-ink text-base">{selected.name}</div>
                    <span
                      className="inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{
                        background: "var(--accent-10, rgba(92,124,250,0.1))",
                        color: "var(--accent)",
                        border: "1px solid var(--accent-20, rgba(92,124,250,0.2))",
                      }}
                    >
                      {selected.jobType}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditTemplateId(selected.id)}
                      className="btn-ghost text-sm flex items-center gap-1"
                    >
                      <Pencil size={13} /> Edit
                    </button>
                    <button
                      onClick={() => handleDeleteTemplate(selected.id)}
                      className="btn-ghost text-sm flex items-center gap-1 text-red-500"
                      disabled={pending}
                    >
                      <Trash2 size={13} /> Delete
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* ── Schedule items card ──────────────────────────────── */}
            <div className="card">
              <button
                onClick={() => setExpandSched((v) => !v)}
                className="w-full flex items-center justify-between px-5 py-3 text-sm font-semibold text-ink"
              >
                <span className="flex items-center gap-2">
                  <CalendarDays size={14} className="text-accent" />
                  Schedule items
                  <span className="text-ink-muted font-normal">
                    ({selected.scheduleItems.length})
                  </span>
                </span>
                {expandSched ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>

              {expandSched && (
                <div className="px-5 pb-4 space-y-3">
                  {selected.scheduleItems.length === 0 && (
                    <p className="text-xs text-ink-muted">No schedule items yet.</p>
                  )}

                  {selected.scheduleItems.map((item) => (
                    <div key={item.id}>
                      {editSched === item.id ? (
                        <form
                          onSubmit={(e) => handleUpdateSched(item.id, e)}
                          className="flex gap-2 items-end"
                        >
                          <div className="flex-1">
                            <label className="label text-[10px]">Name</label>
                            <input
                              className="input mt-0.5 text-sm"
                              name="name"
                              defaultValue={item.name}
                              required
                            />
                          </div>
                          <div className="w-20">
                            <label className="label text-[10px]">Start+days</label>
                            <input
                              className="input mt-0.5 text-sm"
                              name="offsetStartDays"
                              type="number"
                              min="0"
                              defaultValue={item.offsetStartDays}
                            />
                          </div>
                          <div className="w-20">
                            <label className="label text-[10px]">Duration</label>
                            <input
                              className="input mt-0.5 text-sm"
                              name="durationDays"
                              type="number"
                              min="1"
                              defaultValue={item.durationDays}
                            />
                          </div>
                          <button type="submit" className="btn-primary text-xs px-2 py-1.5" disabled={pending}>
                            <Check size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditSched(null)}
                            className="btn-ghost text-xs px-2 py-1.5"
                          >
                            <X size={12} />
                          </button>
                        </form>
                      ) : (
                        <div className="flex items-center justify-between rounded-lg px-3 py-2 text-sm"
                          style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}
                        >
                          <span className="font-medium text-ink">{item.name}</span>
                          <span className="text-xs text-ink-muted mr-4">
                            +{item.offsetStartDays}d start · {item.durationDays}d duration
                          </span>
                          <div className="flex gap-1 shrink-0">
                            <button onClick={() => setEditSched(item.id)} className="p-1 text-ink-muted hover:text-ink">
                              <Pencil size={12} />
                            </button>
                            <button
                              onClick={() => handleDeleteSched(item.id)}
                              className="p-1 text-ink-muted hover:text-red-500"
                              disabled={pending}
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Add item form */}
                  <form onSubmit={handleAddSched} className="flex gap-2 items-end pt-1">
                    <div className="flex-1">
                      <label className="label text-[10px]">Task name</label>
                      <input
                        className="input mt-0.5 text-sm"
                        name="name"
                        placeholder="e.g. Demo"
                        required
                      />
                    </div>
                    <div className="w-20">
                      <label className="label text-[10px]">Start+days</label>
                      <input
                        className="input mt-0.5 text-sm"
                        name="offsetStartDays"
                        type="number"
                        min="0"
                        defaultValue="0"
                      />
                    </div>
                    <div className="w-20">
                      <label className="label text-[10px]">Duration</label>
                      <input
                        className="input mt-0.5 text-sm"
                        name="durationDays"
                        type="number"
                        min="1"
                        defaultValue="1"
                      />
                    </div>
                    <button type="submit" className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1" disabled={pending}>
                      <Plus size={12} /> Add
                    </button>
                  </form>
                </div>
              )}
            </div>

            {/* ── Budget items card ────────────────────────────────── */}
            <div className="card">
              <button
                onClick={() => setExpandBudget((v) => !v)}
                className="w-full flex items-center justify-between px-5 py-3 text-sm font-semibold text-ink"
              >
                <span className="flex items-center gap-2">
                  <DollarSign size={14} className="text-accent" />
                  Budget lines
                  <span className="text-ink-muted font-normal">
                    ({selected.budgetItems.length})
                  </span>
                </span>
                {expandBudget ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>

              {expandBudget && (
                <div className="px-5 pb-4 space-y-3">
                  {selected.budgetItems.length === 0 && (
                    <p className="text-xs text-ink-muted">No budget lines yet.</p>
                  )}

                  {selected.budgetItems.map((item) => (
                    <div key={item.id}>
                      {editBudget === item.id ? (
                        <form
                          onSubmit={(e) => handleUpdateBudget(item.id, e)}
                          className="flex gap-2 items-end"
                        >
                          <div className="flex-1">
                            <label className="label text-[10px]">Category</label>
                            <input
                              className="input mt-0.5 text-sm"
                              name="category"
                              defaultValue={item.category}
                              required
                            />
                          </div>
                          <div className="w-28">
                            <label className="label text-[10px]">Budget ($)</label>
                            <input
                              className="input mt-0.5 text-sm"
                              name="budget"
                              type="number"
                              min="0"
                              step="100"
                              defaultValue={(item.budgetCents / 100).toFixed(0)}
                            />
                          </div>
                          <button type="submit" className="btn-primary text-xs px-2 py-1.5" disabled={pending}>
                            <Check size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditBudget(null)}
                            className="btn-ghost text-xs px-2 py-1.5"
                          >
                            <X size={12} />
                          </button>
                        </form>
                      ) : (
                        <div
                          className="flex items-center justify-between rounded-lg px-3 py-2 text-sm"
                          style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}
                        >
                          <span className="font-medium text-ink">{item.category}</span>
                          <span className="text-xs text-ink-muted mr-4 tabular-nums">
                            {fmt(item.budgetCents)}
                          </span>
                          <div className="flex gap-1 shrink-0">
                            <button onClick={() => setEditBudget(item.id)} className="p-1 text-ink-muted hover:text-ink">
                              <Pencil size={12} />
                            </button>
                            <button
                              onClick={() => handleDeleteBudget(item.id)}
                              className="p-1 text-ink-muted hover:text-red-500"
                              disabled={pending}
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Add budget item form */}
                  <form onSubmit={handleAddBudget} className="flex gap-2 items-end pt-1">
                    <div className="flex-1">
                      <label className="label text-[10px]">Category</label>
                      <input
                        className="input mt-0.5 text-sm"
                        name="category"
                        placeholder="e.g. Demo"
                        required
                      />
                    </div>
                    <div className="w-28">
                      <label className="label text-[10px]">Budget ($)</label>
                      <input
                        className="input mt-0.5 text-sm"
                        name="budget"
                        type="number"
                        min="0"
                        step="100"
                        defaultValue="0"
                      />
                    </div>
                    <button type="submit" className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1" disabled={pending}>
                      <Plus size={12} /> Add
                    </button>
                  </form>
                </div>
              )}
            </div>
          </>
        )}

        {!selected && !showNewTemplate && (
          <div className="card p-10 text-center text-ink-muted text-sm">
            Select a template on the left, or create a new one.
          </div>
        )}
      </div>

      {toast && (
        <Toast msg={toast.msg} ok={toast.ok} onDone={() => setToast(null)} />
      )}
    </div>
  );
}
