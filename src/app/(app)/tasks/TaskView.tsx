"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { formatDate } from "@/lib/utils";
import type { ListTasksResult } from "@/lib/henleyTasks";

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
}: {
  result: ListTasksResult;
  filters: ActiveFilters;
  limit: number;
  offset: number;
}) {
  const router = useRouter();

  // Local state for text/date inputs — initialised from props (component remounts on key change)
  const [assignee, setAssignee] = useState(filters.assignee ?? "");
  const [q, setQ] = useState(filters.q ?? "");

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
      router.push(`/tasks?${new URLSearchParams(merged).toString()}`);
    },
    [filters, assignee, q, limit, router],
  );

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
      {/* ── Filter bar ─────────────────────────────────────────────────── */}
      <div className="card p-4 flex flex-wrap gap-3 items-end">
        {/* Status — controlled select, themed via .input color-scheme */}
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

        {/* Priority — controlled select */}
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

        {/* Assignee — local state, commit on blur or Enter */}
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

        {/* Due before */}
        <div>
          <label className="hh-label block mb-1">Due before</label>
          <input
            type="date"
            className="input text-sm py-1"
            value={filters.due_before ?? ""}
            onChange={(e) => pushFilters({ due_before: e.target.value || undefined })}
          />
        </div>

        {/* Due after */}
        <div>
          <label className="hh-label block mb-1">Due after</label>
          <input
            type="date"
            className="input text-sm py-1"
            value={filters.due_after ?? ""}
            onChange={(e) => pushFilters({ due_after: e.target.value || undefined })}
          />
        </div>

        {/* Search */}
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
          <div className="card overflow-x-auto">
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
                    <tr key={t.id} className="hh-row--flat">
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
              {total === 0
                ? "No tasks"
                : `Showing ${offset + 1}–${end} of ${total}`}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn-secondary text-xs"
                disabled={!hasPrev}
                onClick={() => pushFilters({ offset: offset - limit })}
              >
                ← Prev
              </button>
              <button
                type="button"
                className="btn-secondary text-xs"
                disabled={!hasNext}
                onClick={() => pushFilters({ offset: offset + limit })}
              >
                Next →
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
