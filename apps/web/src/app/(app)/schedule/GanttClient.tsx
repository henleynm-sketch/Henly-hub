"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, X, Flag, CalendarDays, AlertTriangle, ChevronDown, LayoutTemplate,
} from "lucide-react";
import {
  createTask, updateTask, deleteTask, publishBaseline, updateProgress,
  applyTemplateToSchedule,
} from "./scheduleActions";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type GanttTask = {
  id: string;
  projectId: string;
  name: string;
  startDate: string;
  endDate: string;
  baselineStartDate: string | null;
  baselineEndDate: string | null;
  progress: number;
  assigneeId: string | null;
  assigneeName: string | null;
  dependsOnId: string | null;
  dependsOnName: string | null;
  order: number;
};

type GanttProject = { id: string; name: string; client: { name: string } };
type TeamMember   = { id: string; name: string; role: string };
type TemplateOption = { id: string; name: string; jobType: string; phaseCount: number };

type TaskFormState = {
  name: string;
  startDate: string;
  endDate: string;
  assigneeId: string;
  dependsOnId: string;
  progress: number; // 0–100
};

const EMPTY_FORM: TaskFormState = {
  name: "", startDate: "", endDate: "", assigneeId: "", dependsOnId: "", progress: 0,
};

// ─── Date helpers ──────────────────────────────────────────────────────────────

function isoToInput(iso: string) {
  return iso.slice(0, 10);
}

function getRange(tasks: GanttTask[]) {
  if (!tasks.length) return null;
  const ms = tasks.flatMap((t) => {
    const arr = [+new Date(t.startDate), +new Date(t.endDate)];
    if (t.baselineStartDate) arr.push(+new Date(t.baselineStartDate));
    if (t.baselineEndDate)   arr.push(+new Date(t.baselineEndDate));
    return arr;
  });
  const rawMin = new Date(Math.min(...ms));
  const rawMax = new Date(Math.max(...ms));
  // Snap min to month start; pad 2 weeks after then snap to next month start
  const min = new Date(rawMin.getFullYear(), rawMin.getMonth(), 1);
  const padded = new Date(rawMax);
  padded.setDate(padded.getDate() + 14);
  const max = new Date(padded.getFullYear(), padded.getMonth() + 1, 1);
  return { min, max, totalMs: max.getTime() - min.getTime() };
}

function toPct(
  iso: string | Date,
  min: Date,
  totalMs: number
): number {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return ((d.getTime() - min.getTime()) / totalMs) * 100;
}

function widPct(
  startIso: string,
  endIso: string,
  min: Date,
  totalMs: number
): number {
  return Math.max(
    toPct(endIso, min, totalMs) - toPct(startIso, min, totalMs),
    0.4
  );
}

function getMonths(min: Date, max: Date, totalMs: number) {
  const out: { label: string; left: number; width: number }[] = [];
  const cur = new Date(min);
  while (cur < max) {
    const start = new Date(cur);
    const end   = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
    const eff   = end > max ? max : end;
    out.push({
      label: start.toLocaleDateString("en-CA", { month: "short", year: "2-digit" }),
      left:  ((start.getTime() - min.getTime()) / totalMs) * 100,
      width: ((eff.getTime()   - start.getTime()) / totalMs) * 100,
    });
    cur.setMonth(cur.getMonth() + 1);
  }
  return out;
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function GanttClient({
  projects,
  selectedProjectId,
  tasks,
  teamMembers,
  templates,
  role,
  userId,
}: {
  projects: GanttProject[];
  selectedProjectId: string | null;
  tasks: GanttTask[];
  teamMembers: TeamMember[];
  templates: TemplateOption[];
  role: string;
  userId: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const [modal,   setModal]   = useState<"create" | "edit" | "progress" | "baseline" | "apply" | null>(null);
  const [active,  setActive]  = useState<GanttTask | null>(null);
  const [form,    setForm]    = useState<TaskFormState>(EMPTY_FORM);
  const [toast,   setToast]   = useState<{ ok: boolean; msg: string } | null>(null);
  const [applyForm, setApplyForm] = useState<{ templateId: string; startDate: string }>({ templateId: "", startDate: "" });
  const [needsOverwrite, setNeedsOverwrite] = useState(false);

  const isManager = role === "CEO" || role === "OFFICE";
  const isField   = role === "FIELD" || role === "SUB";

  function flash(ok: boolean, msg: string) {
    setToast({ ok, msg });
    setTimeout(() => setToast(null), 4000);
  }

  function closeModal() { setModal(null); setActive(null); setNeedsOverwrite(false); }

  function openApply() {
    setApplyForm({
      templateId: templates[0]?.id ?? "",
      startDate: new Date().toISOString().slice(0, 10),
    });
    setNeedsOverwrite(false);
    setModal("apply");
  }

  function handleApply(overwrite: boolean) {
    if (!selectedProjectId || !applyForm.templateId || !applyForm.startDate) return;
    start(async () => {
      const r = await applyTemplateToSchedule(
        selectedProjectId,
        applyForm.templateId,
        applyForm.startDate,
        overwrite,
      );
      if (r.ok) {
        closeModal();
        flash(true, "Template applied");
        router.refresh();
      } else if (r.existed) {
        setNeedsOverwrite(true);
      } else {
        flash(false, r.error ?? "Failed");
      }
    });
  }

  function openCreate() {
    setForm(EMPTY_FORM);
    setModal("create");
  }

  function openEdit(t: GanttTask) {
    setForm({
      name:        t.name,
      startDate:   isoToInput(t.startDate),
      endDate:     isoToInput(t.endDate),
      assigneeId:  t.assigneeId ?? "",
      dependsOnId: t.dependsOnId ?? "",
      progress:    Math.round(t.progress * 100),
    });
    setActive(t);
    setModal("edit");
  }

  function openProgress(t: GanttTask) {
    setForm({ ...EMPTY_FORM, progress: Math.round(t.progress * 100) });
    setActive(t);
    setModal("progress");
  }

  // ── Server action wrappers ────────────────────────────────────────────────────

  function handleCreate() {
    if (!selectedProjectId) return;
    const fd = new FormData();
    fd.set("projectId",   selectedProjectId);
    fd.set("name",        form.name);
    fd.set("startDate",   form.startDate);
    fd.set("endDate",     form.endDate);
    fd.set("assigneeId",  form.assigneeId);
    fd.set("dependsOnId", form.dependsOnId);
    start(async () => {
      const r = await createTask(fd);
      if (r.ok) { closeModal(); flash(true, "Task added"); router.refresh(); }
      else flash(false, r.error ?? "Failed");
    });
  }

  function handleUpdate() {
    if (!active) return;
    const fd = new FormData();
    fd.set("name",        form.name);
    fd.set("startDate",   form.startDate);
    fd.set("endDate",     form.endDate);
    fd.set("assigneeId",  form.assigneeId);
    fd.set("dependsOnId", form.dependsOnId);
    fd.set("progress",    String(form.progress / 100));
    start(async () => {
      const r = await updateTask(active.id, fd);
      if (r.ok) { closeModal(); flash(true, "Saved"); router.refresh(); }
      else flash(false, r.error ?? "Failed");
    });
  }

  function handleProgress() {
    if (!active) return;
    start(async () => {
      const r = await updateProgress(active.id, form.progress / 100);
      if (r.ok) { closeModal(); flash(true, "Progress updated"); router.refresh(); }
      else flash(false, r.error ?? "Failed");
    });
  }

  function handleDelete(taskId: string) {
    if (!confirm("Delete this task? This cannot be undone.")) return;
    start(async () => {
      const r = await deleteTask(taskId);
      if (r.ok) { flash(true, "Deleted"); router.refresh(); }
      else flash(false, r.error ?? "Failed");
    });
  }

  function handleBaseline() {
    if (!selectedProjectId) return;
    start(async () => {
      const r = await publishBaseline(selectedProjectId);
      closeModal();
      if (r.ok) { flash(true, "Baseline published"); router.refresh(); }
      else flash(false, r.error ?? "Failed");
    });
  }

  // ── Gantt geometry ────────────────────────────────────────────────────────────

  const range  = getRange(tasks);
  const months = range ? getMonths(range.min, range.max, range.totalMs) : [];

  function lPct(iso: string)                   { return range ? toPct(iso,      range.min, range.totalMs) : 0; }
  function wPct(s: string, e: string)          { return range ? widPct(s, e, range.min, range.totalMs)   : 0; }
  function todayPct()                          { return range ? toPct(new Date().toISOString(), range.min, range.totalMs) : 0; }

  const canEdit = (t: GanttTask) =>
    isManager || (isField && t.assigneeId === userId);

  // ─── Render ───────────────────────────────────────────────────────────────────

  const LABEL_W = "w-52 shrink-0";

  return (
    <div className="space-y-4">

      {/* ── Toolbar ── */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Project picker */}
        {projects.length > 0 ? (
          <div className="relative inline-flex items-center">
            <select
              className="hh-chip appearance-none pr-7 cursor-pointer"
              value={selectedProjectId ?? ""}
              onChange={(e) => router.push(`/schedule?projectId=${e.target.value}`)}
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.client.name} — {p.name}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 w-3.5 h-3.5 text-ink-muted" />
          </div>
        ) : (
          <span className="hh-caption">No projects available</span>
        )}

        <div className="flex-1" />

        {isManager && selectedProjectId && (
          <>
            {templates.length > 0 && (
              <button
                className="btn-secondary text-xs flex items-center gap-1.5"
                onClick={openApply}
              >
                <LayoutTemplate className="w-3.5 h-3.5" />
                Apply template
              </button>
            )}
            <button
              className="btn-secondary text-xs flex items-center gap-1.5"
              onClick={() => setModal("baseline")}
            >
              <Flag className="w-3.5 h-3.5" />
              Publish baseline
            </button>
            <button
              className="btn-primary text-xs flex items-center gap-1.5"
              onClick={openCreate}
            >
              <Plus className="w-3.5 h-3.5" />
              Add task
            </button>
          </>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <p
          className="hh-caption text-center px-3 py-2 rounded-lg border"
          style={{
            color:       toast.ok ? "var(--hh-dot-green)" : "var(--hh-dot-red)",
            borderColor: toast.ok ? "var(--hh-dot-green)" : "var(--hh-dot-red)",
          }}
        >
          {toast.msg}
        </p>
      )}

      {/* Empty state — a call to action, not a dead end */}
      {!tasks.length && (
        <div className="hh-panel p-16 flex flex-col items-center gap-3 text-center">
          <CalendarDays className="w-10 h-10 text-ink-muted" />
          <p className="hh-primary">
            {!selectedProjectId ? "Select a project" : "No schedule yet"}
          </p>
          <p className="hh-secondary">
            {!selectedProjectId
              ? "Choose a project above to see its timeline."
              : isManager
              ? "Start from a standard template, or add phases yourself."
              : "Tasks assigned to you will appear here once added."}
          </p>
          {selectedProjectId && isManager && (
            <div className="flex flex-wrap gap-2 justify-center mt-1">
              {templates.length > 0 && (
                <button
                  className="btn-primary text-sm flex items-center gap-1.5"
                  onClick={openApply}
                >
                  <LayoutTemplate className="w-4 h-4" />
                  Apply a template
                </button>
              )}
              <button
                className="btn-secondary text-sm flex items-center gap-1.5"
                onClick={openCreate}
              >
                <Plus className="w-4 h-4" />
                Add your first phase
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Gantt chart ── */}
      {tasks.length > 0 && range && (
        <div className="hh-panel !p-0 overflow-hidden">

          {/* Date-axis header */}
          <div className="flex border-b border-glass-border bg-row-bg shrink-0">
            <div className={`${LABEL_W} border-r border-glass-border px-4 py-2`}>
              <span className="hh-caption uppercase tracking-wider">Task</span>
            </div>
            <div className="flex-1 relative h-8 overflow-hidden">
              {months.map((m) => (
                <div
                  key={m.label}
                  className="absolute top-0 h-full border-l border-glass-border flex items-center pl-2 overflow-hidden"
                  style={{ left: `${m.left}%`, width: `${m.width}%` }}
                >
                  <span className="hh-caption uppercase tracking-wider whitespace-nowrap">
                    {m.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Task rows */}
          <div className="divide-y divide-glass-border overflow-x-auto">
            {tasks.map((t) => {
              const slippage = !!(
                t.baselineEndDate &&
                new Date(t.endDate) > new Date(t.baselineEndDate)
              );
              const pctDone = Math.round(t.progress * 100);
              const editable = canEdit(t);

              return (
                <div
                  key={t.id}
                  className="flex items-stretch min-h-[56px] hover:bg-row-hover transition-colors group"
                >
                  {/* Label column */}
                  <div
                    className={`${LABEL_W} border-r border-glass-border px-4 py-3 flex flex-col justify-center gap-0.5`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="hh-primary text-sm font-medium truncate">{t.name}</span>
                      {slippage && (
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {t.assigneeName && (
                        <span className="hh-caption truncate">{t.assigneeName}</span>
                      )}
                      <span className="hh-caption text-accent font-medium">{pctDone}%</span>
                    </div>
                    {/* Hover actions */}
                    <div className="flex items-center gap-2 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      {editable && (
                        <button
                          className="hh-caption text-accent hover:underline"
                          onClick={() => isManager ? openEdit(t) : openProgress(t)}
                        >
                          {isManager ? "Edit" : "Update progress"}
                        </button>
                      )}
                      {isManager && (
                        <button
                          className="hh-caption text-red-400 hover:underline"
                          onClick={() => handleDelete(t.id)}
                          disabled={pending}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Bar track */}
                  <div className="flex-1 relative py-3 min-w-[400px]">

                    {/* Today line */}
                    {todayPct() >= 0 && todayPct() <= 100 && (
                      <div
                        className="absolute inset-y-0 w-px z-10 pointer-events-none"
                        style={{
                          left: `${todayPct()}%`,
                          backgroundColor: "var(--hh-accent, #5c7cfa)",
                          opacity: 0.35,
                        }}
                      />
                    )}

                    {/* Baseline bar (faint underlay) */}
                    {t.baselineStartDate && t.baselineEndDate && (
                      <div
                        className="absolute bottom-2 h-2 rounded border border-glass-border"
                        style={{
                          left:             `${lPct(t.baselineStartDate)}%`,
                          width:            `${wPct(t.baselineStartDate, t.baselineEndDate)}%`,
                          backgroundColor:  "var(--hh-chip-bg, rgba(128,128,128,0.12))",
                        }}
                        title={`Baseline: ${isoToInput(t.baselineStartDate)} → ${isoToInput(t.baselineEndDate)}`}
                      />
                    )}

                    {/* Current bar (background track) */}
                    <div
                      className="absolute top-3 h-6 rounded overflow-hidden border border-accent/30"
                      style={{
                        left:  `${lPct(t.startDate)}%`,
                        width: `${wPct(t.startDate, t.endDate)}%`,
                        backgroundColor: "rgba(92,124,250,0.10)",
                      }}
                    >
                      {/* Progress fill */}
                      <div
                        className="h-full transition-all duration-300"
                        style={{
                          width:           `${pctDone}%`,
                          backgroundColor: "rgba(92,124,250,0.55)",
                        }}
                      />
                    </div>

                    {/* Task name label on bar (only if bar is wide enough) */}
                    {wPct(t.startDate, t.endDate) > 10 && (
                      <div
                        className="absolute top-3 h-6 flex items-center px-2 pointer-events-none overflow-hidden"
                        style={{
                          left:  `${lPct(t.startDate)}%`,
                          width: `${wPct(t.startDate, t.endDate)}%`,
                        }}
                      >
                        <span className="text-[11px] font-semibold truncate text-accent">
                          {t.name}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="border-t border-glass-border px-4 py-2 flex flex-wrap items-center gap-5 bg-row-bg">
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-3 rounded border border-accent/30"
                style={{ backgroundColor: "rgba(92,124,250,0.10)" }}
              />
              <span className="hh-caption">Scheduled</span>
            </div>
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-2 rounded border border-glass-border"
                style={{ backgroundColor: "var(--hh-chip-bg)" }}
              />
              <span className="hh-caption">Baseline</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-px h-4 opacity-40" style={{ backgroundColor: "var(--hh-accent, #5c7cfa)" }} />
              <span className="hh-caption">Today</span>
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
              <span className="hh-caption">Slippage vs baseline</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Modals ── */}

      {/* Create task */}
      {modal === "create" && (
        <Overlay title="Add Task" onClose={closeModal}>
          <TaskForm
            form={form}
            onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
            showProgress={false}
            teamMembers={teamMembers}
            otherTasks={tasks}
            submitLabel="Add task"
            onSubmit={handleCreate}
            onCancel={closeModal}
            pending={pending}
          />
        </Overlay>
      )}

      {/* Edit task */}
      {modal === "edit" && active && (
        <Overlay title="Edit Task" onClose={closeModal}>
          <TaskForm
            form={form}
            onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
            showProgress={true}
            teamMembers={teamMembers}
            otherTasks={tasks.filter((t) => t.id !== active.id)}
            submitLabel="Save changes"
            onSubmit={handleUpdate}
            onCancel={closeModal}
            pending={pending}
          />
        </Overlay>
      )}

      {/* Progress update (field/sub) */}
      {modal === "progress" && active && (
        <Overlay title="Update Progress" onClose={closeModal}>
          <div className="space-y-4">
            <p className="hh-primary font-medium">{active.name}</p>
            <div className="space-y-2">
              <div className="flex justify-between hh-caption mb-1">
                <span>Progress</span>
                <span className="text-accent font-semibold">{form.progress}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={form.progress}
                onChange={(e) => setForm((f) => ({ ...f, progress: +e.target.value }))}
                className="w-full"
                style={{ accentColor: "var(--hh-accent, #5c7cfa)" }}
              />
              <div className="flex justify-between hh-caption">
                <span>0%</span>
                <span>50%</span>
                <span>100%</span>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                className="btn-primary text-sm flex-1"
                onClick={handleProgress}
                disabled={pending}
              >
                Save
              </button>
              <button className="btn-secondary text-sm" onClick={closeModal}>
                Cancel
              </button>
            </div>
          </div>
        </Overlay>
      )}

      {/* Confirm baseline */}
      {modal === "baseline" && (
        <Overlay title="Publish Baseline" onClose={closeModal}>
          <div className="space-y-4">
            <p className="hh-secondary">
              Snapshot all current task dates as the baseline. Future date changes will
              appear as slippage against this baseline.
            </p>
            <p className="hh-secondary">
              If a baseline already exists for any task it will be overwritten.
            </p>
            <div className="flex gap-2 pt-1">
              <button
                className="btn-primary text-sm flex-1 flex items-center justify-center gap-1.5"
                onClick={handleBaseline}
                disabled={pending}
              >
                <Flag className="w-3.5 h-3.5" />
                Publish baseline
              </button>
              <button className="btn-secondary text-sm" onClick={closeModal}>
                Cancel
              </button>
            </div>
          </div>
        </Overlay>
      )}

      {/* Apply template */}
      {modal === "apply" && (
        <Overlay title="Apply a template" onClose={closeModal}>
          {needsOverwrite ? (
            <div className="space-y-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                <p className="hh-secondary">
                  This job already has a schedule. Applying a template will replace all
                  existing schedule items — this cannot be undone.
                </p>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  className="btn-primary text-sm flex-1"
                  onClick={() => handleApply(true)}
                  disabled={pending}
                >
                  Replace schedule
                </button>
                <button className="btn-secondary text-sm" onClick={closeModal}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="hh-caption uppercase tracking-wider block mb-1">Template</label>
                <select
                  className="input w-full"
                  value={applyForm.templateId}
                  onChange={(e) => setApplyForm((f) => ({ ...f, templateId: e.target.value }))}
                >
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.phaseCount} phase{t.phaseCount === 1 ? "" : "s"})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="hh-caption uppercase tracking-wider block mb-1">Project start date</label>
                <input
                  type="date"
                  className="input w-full"
                  value={applyForm.startDate}
                  onChange={(e) => setApplyForm((f) => ({ ...f, startDate: e.target.value }))}
                />
              </div>
              <p className="hh-caption">
                Phases lay out sequentially from the start date with placeholder durations —
                drag or edit each bar afterward to set real dates.
              </p>
              <div className="flex gap-2 pt-1">
                <button
                  className="btn-primary text-sm flex-1"
                  onClick={() => handleApply(false)}
                  disabled={pending || !applyForm.templateId || !applyForm.startDate}
                >
                  Apply template
                </button>
                <button className="btn-secondary text-sm" onClick={closeModal}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </Overlay>
      )}
    </div>
  );
}

// ─── Overlay modal ─────────────────────────────────────────────────────────────

function Overlay({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="hh-panel w-full max-w-md mx-4 p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h3 className="hh-primary font-semibold">{title}</h3>
          <button
            onClick={onClose}
            className="text-ink-muted hover:text-ink transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── Task form ─────────────────────────────────────────────────────────────────

function TaskForm({
  form,
  onChange,
  showProgress,
  teamMembers,
  otherTasks,
  submitLabel,
  onSubmit,
  onCancel,
  pending,
}: {
  form: TaskFormState;
  onChange: (patch: Partial<TaskFormState>) => void;
  showProgress: boolean;
  teamMembers: TeamMember[];
  otherTasks: GanttTask[];
  submitLabel: string;
  onSubmit: () => void;
  onCancel: () => void;
  pending: boolean;
}) {
  return (
    <div className="space-y-3">
      {/* Name */}
      <div>
        <label className="hh-caption uppercase tracking-wider block mb-1">Task name</label>
        <input
          type="text"
          className="input w-full"
          placeholder="e.g. Foundation pour"
          value={form.name}
          onChange={(e) => onChange({ name: e.target.value })}
        />
      </div>

      {/* Dates */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="hh-caption uppercase tracking-wider block mb-1">Start</label>
          <input
            type="date"
            className="input w-full"
            value={form.startDate}
            onChange={(e) => onChange({ startDate: e.target.value })}
          />
        </div>
        <div>
          <label className="hh-caption uppercase tracking-wider block mb-1">End</label>
          <input
            type="date"
            className="input w-full"
            value={form.endDate}
            onChange={(e) => onChange({ endDate: e.target.value })}
          />
        </div>
      </div>

      {/* Assignee */}
      {teamMembers.length > 0 && (
        <div>
          <label className="hh-caption uppercase tracking-wider block mb-1">Assignee</label>
          <select
            className="input w-full"
            value={form.assigneeId}
            onChange={(e) => onChange({ assigneeId: e.target.value })}
          >
            <option value="">— None —</option>
            {teamMembers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.role})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Dependency */}
      {otherTasks.length > 0 && (
        <div>
          <label className="hh-caption uppercase tracking-wider block mb-1">Depends on</label>
          <select
            className="input w-full"
            value={form.dependsOnId}
            onChange={(e) => onChange({ dependsOnId: e.target.value })}
          >
            <option value="">— None —</option>
            {otherTasks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Progress (edit mode only) */}
      {showProgress && (
        <div>
          <div className="flex justify-between hh-caption mb-1">
            <span className="uppercase tracking-wider">Progress</span>
            <span className="text-accent font-semibold">{form.progress}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={form.progress}
            onChange={(e) => onChange({ progress: +e.target.value })}
            className="w-full"
            style={{ accentColor: "var(--hh-accent, #5c7cfa)" }}
          />
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-2">
        <button
          className="btn-primary text-sm flex-1"
          onClick={onSubmit}
          disabled={pending || !form.name || !form.startDate || !form.endDate}
        >
          {submitLabel}
        </button>
        <button className="btn-secondary text-sm" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
