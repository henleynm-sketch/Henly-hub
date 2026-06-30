"use client";

import { useState, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Check, Trash2 } from "lucide-react";
import { formatDate } from "@/lib/utils";
import type { ListTasksResult, HenleyTask } from "@/lib/henleyTasks";
import { createTaskAction, updateTaskAction, deleteTaskAction, type TaskPatch } from "./taskActions";

// Status display mapping
const STATUS_LABEL: Record<string, string> = {
  open: "To do",
  in_progress: "In progress",
  done: "Done",
};

// Badge class mapping — uses CSS classes only, no hardcoded hex
const STATUS_BADGE: Record<string, string> = {
  open: "hh-badge",
  in_progress: "hh-badge hh-badge--warning",
  done: "hh-badge hh-badge--success",
};

const PRIORITY_BADGE: Record<string, string> = {
  high: "hh-badge hh-badge--danger",
  medium: "hh-badge hh-badge--warning",
  low: "hh-badge",
};

type ActiveFilters = {
  status?: string;
  priority?: string;
  assignee?: string;
  due_before?: string;
  due_after?: string;
  q?: string;
};

export default function TaskView({
  result,
  filters,
  limit,
  offset,
  canCreate,
  writeBackEnabled,
}: {
  result: ListTasksResult;
  filters: ActiveFilters;
  limit: number;
  offset: number;
  canCreate: boolean;
  writeBackEnabled: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Local state for text/date inputs — initialised from props (component remounts on key change)
  const [assignee, setAssignee] = useState(filters.assignee ?? "");
  const [q, setQ] = useState(filters.q ?? "");

  // Create modal + detail drawer + toast
  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, startCreate] = useTransition();
  const [drawerTask, setDrawerTask] = useState<HenleyTask | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Write-back (edit/status/delete) state
  const [acting, startAct] = useTransition();
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    priority: "medium" as "low" | "medium" | "high",
    dueDate: "",
    assignee: "",
  });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [drawerError, setDrawerError] = useState<string | null>(null);
  const canWrite = canCreate && writeBackEnabled;

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 5000);
  }

  const pushFilters = useCallback(
    (patch: Partial<ActiveFilters & { offset: number }>) => {
      const merged: Record<string, string> = {};
      const next = { ...filters, assignee, q, offset: 0, ...patch };
      for (const [k, v] of Object.entries(next)) {
        if (v !== undefined && v !== "" && String(v) !== "0") {
          merged[k] = String(v);
        }
      }
      // Always preserve limit if non-default
      if (limit !== 50) merged.limit = String(limit);
      startTransition(() => {
        router.push(`/tasks?${new URLSearchParams(merged).toString()}`);
      });
    },
    [filters, assignee, q, limit, router],
  );

  function onCreate(formData: FormData) {
    setCreateError(null);
    startCreate(async () => {
      const r = await createTaskAction(formData);
      if (!r.ok) {
        setCreateError(r.error ?? "Could not create task");
        return;
      }
      setCreateOpen(false);
      flash("Sent to Tasks Inbox");
      router.refresh();
    });
  }

  function openDrawer(t: HenleyTask) {
    setDrawerError(null);
    setConfirmDelete(false);
    setEditing(false);
    setDrawerTask(t);
  }

  function startEdit() {
    if (!drawerTask) return;
    setDrawerError(null);
    setEditForm({
      title: drawerTask.title,
      description: drawerTask.description ?? "",
      priority: drawerTask.priority,
      dueDate: (drawerTask.due_date ?? "").slice(0, 10),
      assignee: drawerTask.assignee ?? "",
    });
    setEditing(true);
  }

  function afterMutation(msg: string) {
    flash(msg);
    setDrawerTask(null);
    setEditing(false);
    setConfirmDelete(false);
    router.refresh();
  }

  function saveEdits() {
    const orig = drawerTask;
    if (!orig) return;
    const patch: TaskPatch = {};
    const t = editForm.title.trim();
    if (t && t !== orig.title) patch.title = t;
    if (editForm.description !== (orig.description ?? "")) patch.description = editForm.description;
    if (editForm.priority !== orig.priority) patch.priority = editForm.priority;
    if (editForm.dueDate !== (orig.due_date ?? "").slice(0, 10)) patch.due_date = editForm.dueDate;
    if (editForm.assignee !== (orig.assignee ?? "")) patch.assignee = editForm.assignee;
    if (Object.keys(patch).length === 0) {
      setEditing(false);
      return;
    }
    setDrawerError(null);
    startAct(async () => {
      const r = await updateTaskAction(orig.id, patch);
      if (!r.ok) {
        setDrawerError(r.error ?? "Could not save changes");
        return;
      }
      afterMutation("Task updated");
    });
  }

  function applyStatus(status: "open" | "in_progress" | "done") {
    const task = drawerTask;
    if (!task || status === task.status) return;
    setDrawerError(null);
    startAct(async () => {
      const r = await updateTaskAction(task.id, { status });
      if (!r.ok) {
        setDrawerError(r.error ?? "Could not update status");
        return;
      }
      afterMutation(status === "done" ? "Marked done" : "Status updated");
    });
  }

  function doDelete() {
    const task = drawerTask;
    if (!task) return;
    setDrawerError(null);
    startAct(async () => {
      const r = await deleteTaskAction(task.id);
      if (!r.ok) {
        setDrawerError(r.error ?? "Could not delete task");
        return;
      }
      afterMutation("Task deleted");
    });
  }

  const hasFilters = !!(
    filters.status ||
    filters.priority ||
    filters.assignee ||
    filters.due_before ||
    filters.due_after ||
    filters.q
  );

  const total = result.ok ? result.total : 0;
  const tasks = result.ok ? result.tasks : [];
  const end = Math.min(offset + limit, total);
  const hasPrev = offset > 0;
  const hasNext = end < total;

  return (
    <div className="p-6 flex flex-col gap-4">
      {/* ── Action bar: toast + New task ───────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 min-h-[2rem]">
        <div>
          {toast && (
            <span className="inline-flex items-center gap-2">
              <span className="hh-dot hh-dot--green" />
              <span className="hh-secondary">{toast}</span>
            </span>
          )}
        </div>
        {canCreate && (
          <button
            type="button"
            className="btn-primary text-sm inline-flex items-center gap-1.5"
            onClick={() => {
              setCreateError(null);
              setCreateOpen(true);
            }}
          >
            <Plus size={16} />
            New task
          </button>
        )}
      </div>

      {/* ── Filter bar ─────────────────────────────────────────────────── */}
      <div className="card p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="hh-label block mb-1">Status</label>
          <select
            className="input text-sm py-1"
            value={filters.status ?? ""}
            onChange={(e) => pushFilters({ status: e.target.value || undefined })}
          >
            <option value="">All statuses</option>
            <option value="open">To do</option>
            <option value="in_progress">In progress</option>
            <option value="done">Done</option>
          </select>
        </div>

        <div>
          <label className="hh-label block mb-1">Priority</label>
          <select
            className="input text-sm py-1"
            value={filters.priority ?? ""}
            onChange={(e) => pushFilters({ priority: e.target.value || undefined })}
          >
            <option value="">All priorities</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>

        <div>
          <label className="hh-label block mb-1">Assignee</label>
          <input
            className="input text-sm py-1"
            placeholder="Name or email"
            value={assignee}
            onChange={(e) => setAssignee(e.target.value)}
            onBlur={() => pushFilters({ assignee: assignee || undefined })}
            onKeyDown={(e) => {
              if (e.key === "Enter") pushFilters({ assignee: assignee || undefined });
            }}
          />
        </div>

        <div>
          <label className="hh-label block mb-1">Due before</label>
          <input
            type="date"
            className="input text-sm py-1"
            value={filters.due_before ?? ""}
            onChange={(e) => pushFilters({ due_before: e.target.value || undefined })}
          />
        </div>

        <div>
          <label className="hh-label block mb-1">Due after</label>
          <input
            type="date"
            className="input text-sm py-1"
            value={filters.due_after ?? ""}
            onChange={(e) => pushFilters({ due_after: e.target.value || undefined })}
          />
        </div>

        <div className="flex-1 min-w-[12rem]">
          <label className="hh-label block mb-1">Search</label>
          <input
            className="input text-sm py-1 w-full"
            placeholder="Search tasks…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onBlur={() => pushFilters({ q: q || undefined })}
            onKeyDown={(e) => {
              if (e.key === "Enter") pushFilters({ q: q || undefined });
            }}
          />
        </div>

        {hasFilters && (
          <button
            type="button"
            className="btn-ghost text-xs self-end"
            onClick={() => router.push("/tasks")}
          >
            Clear filters
          </button>
        )}
      </div>

      {/* ── Error state ────────────────────────────────────────────────── */}
      {!result.ok && (
        <div className="card p-6 flex items-start gap-3">
          <span className="hh-dot hh-dot--red mt-1 shrink-0" />
          <div>
            <p className="hh-primary font-semibold mb-1">Could not load tasks</p>
            <p className="font-mono text-sm" style={{ color: "var(--hh-text)" }}>
              {result.error}
            </p>
            <p className="hh-caption mt-2">
              Check Settings → Integrations → Henley Tasks and run Test connection.
            </p>
          </div>
        </div>
      )}

      {/* ── Task table ─────────────────────────────────────────────────── */}
      {result.ok && (
        <>
          <div
            className={`card overflow-x-auto transition-opacity ${isPending ? "opacity-60" : ""}`}
            aria-busy={isPending}
          >
            {tasks.length === 0 ? (
              <div className="p-12 text-center">
                <p className="hh-secondary">
                  {hasFilters
                    ? "No tasks match the current filters."
                    : "No tasks in Henley Tasks yet."}
                </p>
              </div>
            ) : (
              <table className="min-w-full text-sm">
                <thead className="border-b border-glass-border">
                  <tr>
                    <th className="hh-label px-4 py-3 text-left">Title</th>
                    <th className="hh-label px-4 py-3 text-left">Status</th>
                    <th className="hh-label px-4 py-3 text-left">Priority</th>
                    <th className="hh-label px-4 py-3 text-left">Assignee</th>
                    <th className="hh-label px-4 py-3 text-left">Due</th>
                    <th className="hh-label px-4 py-3 text-left">Tags</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-glass-border">
                  {tasks.map((t) => (
                    <tr
                      key={t.id}
                      className="hh-row--flat cursor-pointer"
                      onClick={() => openDrawer(t)}
                    >
                      <td className="px-4 py-3 max-w-xs">
                        <span className="hh-primary font-medium truncate block">{t.title}</span>
                        {t.description && (
                          <span className="hh-secondary text-xs line-clamp-1">{t.description}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`${STATUS_BADGE[t.status] ?? "hh-badge"} !ml-0`}>
                          {STATUS_LABEL[t.status] ?? t.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`${PRIORITY_BADGE[t.priority] ?? "hh-badge"} !ml-0 capitalize`}>
                          {t.priority}
                        </span>
                      </td>
                      <td className="px-4 py-3 hh-secondary whitespace-nowrap">
                        {t.assignee ?? "—"}
                      </td>
                      <td className="px-4 py-3 hh-secondary whitespace-nowrap">
                        {t.due_date ? formatDate(new Date(t.due_date)) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {(t.tags ?? []).map((tag) => (
                            <span key={tag} className="hh-chip text-xs">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* ── Pagination ─────────────────────────────────────────────── */}
          <div className="flex items-center justify-between">
            <span className="hh-secondary text-sm">
              {isPending
                ? "Loading…"
                : total === 0
                ? "No tasks"
                : `Showing ${offset + 1}–${end} of ${total}`}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn-secondary text-xs"
                disabled={!hasPrev || isPending}
                onClick={() => pushFilters({ offset: offset - limit })}
              >
                ← Prev
              </button>
              <button
                type="button"
                className="btn-secondary text-xs"
                disabled={!hasNext || isPending}
                onClick={() => pushFilters({ offset: offset + limit })}
              >
                Next →
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Create task modal ──────────────────────────────────────────── */}
      {createOpen && (
        <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/55" onClick={() => setCreateOpen(false)} />
          <div className="hh-panel relative w-full sm:max-w-md max-h-[92vh] overflow-y-auto rounded-b-none sm:rounded-[20px]">
            <div className="flex items-center justify-between">
              <h3 className="hh-label">New task</h3>
              <button className="hh-close" onClick={() => setCreateOpen(false)} aria-label="Close">
                ×
              </button>
            </div>
            <p className="hh-caption mt-2">
              Sent straight to the Henley Tasks Inbox. The Hub stores no copy.
            </p>
            <form action={onCreate} className="mt-4 flex flex-col gap-3">
              <div>
                <label className="hh-label block mb-1.5">Title</label>
                <input name="title" className="input w-full" placeholder="What needs doing?" required />
              </div>
              <div className="flex flex-wrap gap-3">
                <div className="flex-1 min-w-[8rem]">
                  <label className="hh-label block mb-1.5">Priority</label>
                  <select name="priority" className="input w-full" defaultValue="">
                    <option value="">None</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
                <div className="flex-1 min-w-[8rem]">
                  <label className="hh-label block mb-1.5">Due date</label>
                  <input name="dueDate" type="date" className="input w-full" />
                </div>
              </div>
              <div>
                <label className="hh-label block mb-1.5">Assignee</label>
                <input name="assignee" className="input w-full" placeholder="Name or email (optional)" />
              </div>
              <div>
                <label className="hh-label block mb-1.5">Note</label>
                <textarea
                  name="note"
                  className="input w-full"
                  rows={3}
                  placeholder="Details for the Tasks Inbox (optional)"
                />
              </div>
              {createError && (
                <div className="flex items-start gap-2">
                  <span className="hh-dot hh-dot--red mt-1 shrink-0" />
                  <span className="hh-secondary font-mono text-xs">{createError}</span>
                </div>
              )}
              <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end mt-1">
                <button
                  type="button"
                  className="btn-secondary w-full sm:w-auto"
                  onClick={() => setCreateOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary w-full sm:w-auto" disabled={creating}>
                  {creating ? "Sending…" : "Create task"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Detail drawer (read-only; edit/delete gated) ───────────────── */}
      {drawerTask && (
        <div className="fixed inset-0 z-[80] flex justify-end">
          <div className="absolute inset-0 bg-black/55" onClick={() => setDrawerTask(null)} />
          <div className="hh-panel relative w-full sm:max-w-md h-full overflow-y-auto rounded-none">
            <div className="flex items-start justify-between gap-3">
              <h3 className="hh-primary font-semibold pr-6">{drawerTask.title}</h3>
              <button className="hh-close" onClick={() => setDrawerTask(null)} aria-label="Close">
                ×
              </button>
            </div>

            <div className="flex flex-wrap gap-2 mt-3">
              <span className={`${STATUS_BADGE[drawerTask.status] ?? "hh-badge"} !ml-0`}>
                {STATUS_LABEL[drawerTask.status] ?? drawerTask.status}
              </span>
              <span className={`${PRIORITY_BADGE[drawerTask.priority] ?? "hh-badge"} !ml-0 capitalize`}>
                {drawerTask.priority}
              </span>
              {drawerTask.type && <span className="hh-chip text-xs">{drawerTask.type}</span>}
            </div>

            {canWrite && editing ? (
              <div className="mt-5 flex flex-col gap-3">
                <div>
                  <label className="hh-label block mb-1.5">Title</label>
                  <input
                    className="input w-full"
                    value={editForm.title}
                    onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  />
                </div>
                <div className="flex flex-wrap gap-3">
                  <div className="flex-1 min-w-[8rem]">
                    <label className="hh-label block mb-1.5">Priority</label>
                    <select
                      className="input w-full"
                      value={editForm.priority}
                      onChange={(e) =>
                        setEditForm({ ...editForm, priority: e.target.value as "low" | "medium" | "high" })
                      }
                    >
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  </div>
                  <div className="flex-1 min-w-[8rem]">
                    <label className="hh-label block mb-1.5">Due date</label>
                    <input
                      type="date"
                      className="input w-full"
                      value={editForm.dueDate}
                      onChange={(e) => setEditForm({ ...editForm, dueDate: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <label className="hh-label block mb-1.5">Assignee</label>
                  <input
                    className="input w-full"
                    placeholder="Name or email"
                    value={editForm.assignee}
                    onChange={(e) => setEditForm({ ...editForm, assignee: e.target.value })}
                  />
                </div>
                <div>
                  <label className="hh-label block mb-1.5">Description</label>
                  <textarea
                    className="input w-full"
                    rows={4}
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  />
                </div>
                {drawerError && (
                  <div className="flex items-start gap-2">
                    <span className="hh-dot hh-dot--red mt-1 shrink-0" />
                    <span className="hh-secondary font-mono text-xs">{drawerError}</span>
                  </div>
                )}
                <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end mt-1">
                  <button
                    type="button"
                    className="btn-secondary w-full sm:w-auto"
                    onClick={() => {
                      setEditing(false);
                      setDrawerError(null);
                    }}
                    disabled={acting}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn-primary w-full sm:w-auto"
                    onClick={saveEdits}
                    disabled={acting}
                  >
                    {acting ? "Saving…" : "Save changes"}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <dl className="mt-5 flex flex-col gap-3">
                  <div>
                    <dt className="hh-label">Assignee</dt>
                    <dd className="hh-secondary mt-0.5">{drawerTask.assignee ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="hh-label">Due date</dt>
                    <dd className="hh-secondary mt-0.5">
                      {drawerTask.due_date ? formatDate(new Date(drawerTask.due_date)) : "—"}
                    </dd>
                  </div>
                  {drawerTask.tags && drawerTask.tags.length > 0 && (
                    <div>
                      <dt className="hh-label">Tags</dt>
                      <dd className="mt-1 flex flex-wrap gap-1">
                        {drawerTask.tags.map((tag) => (
                          <span key={tag} className="hh-chip text-xs">
                            {tag}
                          </span>
                        ))}
                      </dd>
                    </div>
                  )}
                  {drawerTask.description && (
                    <div>
                      <dt className="hh-label">Description</dt>
                      <dd className="hh-secondary mt-0.5 whitespace-pre-wrap">{drawerTask.description}</dd>
                    </div>
                  )}
                  <div className="flex gap-6">
                    <div>
                      <dt className="hh-label">Created</dt>
                      <dd className="hh-secondary mt-0.5">{formatDate(new Date(drawerTask.created_at))}</dd>
                    </div>
                    <div>
                      <dt className="hh-label">Updated</dt>
                      <dd className="hh-secondary mt-0.5">{formatDate(new Date(drawerTask.updated_at))}</dd>
                    </div>
                  </div>
                </dl>

                {drawerError && (
                  <div className="flex items-start gap-2 mt-4">
                    <span className="hh-dot hh-dot--red mt-1 shrink-0" />
                    <span className="hh-secondary font-mono text-xs">{drawerError}</span>
                  </div>
                )}

                {canWrite ? (
                  <div className="mt-6 flex flex-col gap-3">
                    <div className="flex items-end gap-2 flex-wrap">
                      <div>
                        <label className="hh-label block mb-1">Status</label>
                        <select
                          className="input text-sm py-1"
                          value={drawerTask.status}
                          onChange={(e) => applyStatus(e.target.value as "open" | "in_progress" | "done")}
                          disabled={acting}
                        >
                          <option value="open">To do</option>
                          <option value="in_progress">In progress</option>
                          <option value="done">Done</option>
                        </select>
                      </div>
                      {drawerTask.status !== "done" && (
                        <button
                          type="button"
                          className="btn-secondary text-sm inline-flex items-center gap-1.5"
                          onClick={() => applyStatus("done")}
                          disabled={acting}
                        >
                          <Check size={14} /> Mark done
                        </button>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="btn-secondary text-sm inline-flex items-center gap-1.5"
                        onClick={startEdit}
                        disabled={acting}
                      >
                        <Pencil size={14} /> Edit
                      </button>
                      <button
                        type="button"
                        className="btn-destructive text-sm inline-flex items-center gap-1.5"
                        onClick={() => setConfirmDelete(true)}
                        disabled={acting}
                      >
                        <Trash2 size={14} /> Delete
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="hh-caption mt-6">
                    Editing and deleting are managed in Henley Tasks. This view is read-only.
                  </p>
                )}
              </>
            )}
          </div>

          {confirmDelete && (
            <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/55" onClick={() => setConfirmDelete(false)} />
              <div className="hh-panel relative w-full max-w-sm">
                <h3 className="hh-label">Delete this task?</h3>
                <p className="hh-secondary mt-2">
                  It will be removed from Henley Tasks (recoverable there). The Hub keeps no copy.
                </p>
                {drawerError && (
                  <div className="flex items-start gap-2 mt-2">
                    <span className="hh-dot hh-dot--red mt-1 shrink-0" />
                    <span className="hh-secondary font-mono text-xs">{drawerError}</span>
                  </div>
                )}
                <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end mt-4">
                  <button
                    type="button"
                    className="btn-secondary w-full sm:w-auto"
                    onClick={() => setConfirmDelete(false)}
                    disabled={acting}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn-destructive w-full sm:w-auto"
                    onClick={doDelete}
                    disabled={acting}
                  >
                    {acting ? "Deleting…" : "Delete"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
