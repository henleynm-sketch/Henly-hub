"use client";

import { useState, useTransition } from "react";
import { Loader2, Send } from "lucide-react";
import { sendTaskToHenleyTasks } from "./sendToTasksAction";

const PRIORITY_OPTIONS = [
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

export default function SendToTasksButton({ projectName }: { projectName: string }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  function flash(ok: boolean, msg: string) {
    setToast({ ok, msg });
    setTimeout(() => setToast(null), 6000);
  }

  function onSubmit(formData: FormData) {
    setFormError(null);
    start(async () => {
      const r = await sendTaskToHenleyTasks(formData);
      if (!r.ok) {
        setFormError(r.error ?? "Failed to send task");
        return;
      }
      setOpen(false);
      flash(true, r.taskId ? `Task sent (id: ${r.taskId})` : "Task sent to Henley Tasks");
    });
  }

  return (
    <>
      <button
        type="button"
        className="btn-secondary inline-flex items-center gap-1.5"
        onClick={() => {
          setFormError(null);
          setOpen(true);
        }}
      >
        <Send size={14} />
        Send to Tasks
      </button>

      {toast && (
        <div className="!fixed bottom-6 right-6 z-[90] hh-panel px-4 py-3 flex items-center gap-2 shadow-lg">
          <span className={`hh-dot ${toast.ok ? "hh-dot--green" : "hh-dot--red"}`} />
          <span className="hh-secondary">{toast.msg}</span>
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/55" onClick={() => setOpen(false)} />
          <div className="hh-panel relative w-full sm:max-w-md max-h-[92vh] overflow-y-auto rounded-b-none sm:rounded-[20px]">
            <div className="flex items-center justify-between">
              <h3 className="hh-label">Send task to Henley Tasks</h3>
              <button className="hh-close" onClick={() => setOpen(false)} aria-label="Close">
                ×
              </button>
            </div>
            <p className="hh-caption mt-2">
              Creates a task in Henley Tasks. No data is stored in the Hub — this is a one-way push.
            </p>

            <form action={onSubmit} className="mt-4 flex flex-col gap-3">
              <input type="hidden" name="projectName" value={projectName} />

              <div>
                <label className="hh-label block mb-1.5">Title</label>
                <input
                  name="title"
                  className="input"
                  placeholder="What needs to be done?"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="hh-label block mb-1.5">Priority</label>
                <select name="priority" className="input" defaultValue="medium">
                  <option value="">— none —</option>
                  {PRIORITY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="hh-label block mb-1.5">Due date (optional)</label>
                <input name="dueDate" type="date" className="input" />
              </div>

              <div>
                <label className="hh-label block mb-1.5">Note (optional)</label>
                <textarea name="note" className="input" rows={3} placeholder="Additional context…" />
              </div>

              {formError && (
                <div className="flex items-center gap-2">
                  <span className="hh-dot hh-dot--red" />
                  <span className="hh-secondary">{formError}</span>
                </div>
              )}

              <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end mt-1">
                <button
                  type="button"
                  className="btn-secondary w-full sm:w-auto"
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary w-full sm:w-auto inline-flex items-center justify-center gap-1.5"
                  disabled={pending}
                >
                  {pending && <Loader2 size={14} className="animate-spin" />}
                  Send task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
