"use client";

import { useState } from "react";
import { formatDate } from "@/lib/utils";
import type { HenleyTask } from "@/lib/henleyTasks";

type Status = "open" | "in_progress" | "done";

const COLUMNS: { key: Status; label: string }[] = [
  { key: "open", label: "To do" },
  { key: "in_progress", label: "In progress" },
  { key: "done", label: "Done" },
];

const PRIORITY_BADGE: Record<string, string> = {
  high: "hh-badge hh-badge--danger",
  medium: "hh-badge hh-badge--warning",
  low: "hh-badge",
};

// Kanban view over the same live task list. Stores nothing. Native HTML5
// drag-and-drop (no animation library) keeps it reduced-motion safe; the only
// visual feedback is a static drop-target tint and a dimmed source card.
export default function TaskBoard({
  tasks,
  canWrite,
  busy,
  onMove,
  onOpen,
}: {
  tasks: HenleyTask[];
  canWrite: boolean;
  busy: boolean;
  onMove: (id: string, status: Status) => void;
  onOpen: (t: HenleyTask) => void;
}) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<Status | null>(null);

  return (
    <div className="grid gap-3 md:grid-cols-3">
      {COLUMNS.map((col) => {
        const colTasks = tasks.filter((t) => t.status === col.key);
        const isOver = overCol === col.key;
        return (
          <div
            key={col.key}
            className={`card p-3 flex flex-col gap-2 ${isOver ? "bg-row-hover" : ""}`}
            onDragOver={(e) => {
              if (!canWrite) return;
              e.preventDefault();
              setOverCol(col.key);
            }}
            onDragLeave={() => setOverCol((c) => (c === col.key ? null : c))}
            onDrop={(e) => {
              e.preventDefault();
              setOverCol(null);
              const id = dragId;
              setDragId(null);
              if (!canWrite || !id) return;
              const t = tasks.find((x) => x.id === id);
              if (t && t.status !== col.key) onMove(id, col.key);
            }}
          >
            <div className="flex items-center justify-between">
              <span className="hh-label">{col.label}</span>
              <span className="hh-chip text-xs">{colTasks.length}</span>
            </div>

            {colTasks.map((t) => (
              <div
                key={t.id}
                draggable={canWrite && !busy}
                onDragStart={() => setDragId(t.id)}
                onDragEnd={() => {
                  setDragId(null);
                  setOverCol(null);
                }}
                onClick={() => onOpen(t)}
                className={`hh-panel p-3 ${canWrite ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"} ${
                  dragId === t.id ? "opacity-50" : ""
                }`}
              >
                <p className="hh-primary text-sm font-medium">{t.title}</p>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <span className={`${PRIORITY_BADGE[t.priority] ?? "hh-badge"} !ml-0 capitalize`}>
                    {t.priority}
                  </span>
                  {t.assignee && <span className="hh-secondary text-xs">{t.assignee}</span>}
                  {t.due_date && (
                    <span className="hh-secondary text-xs">{formatDate(new Date(t.due_date))}</span>
                  )}
                </div>
              </div>
            ))}

            {colTasks.length === 0 && <p className="hh-caption px-1 py-2">No tasks</p>}
          </div>
        );
      })}
    </div>
  );
}
