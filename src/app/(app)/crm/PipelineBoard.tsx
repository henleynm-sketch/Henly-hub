"use client";

import { useOptimistic, useTransition, useState } from "react";
import Link from "next/link";
import { PIPELINE_STAGE, LEAD_SOURCE, JOB_STATUS } from "@/lib/taxonomy";
import { setPipelineStage, setLeadSource } from "./actions";

type ProjectData = {
  id: string;
  name: string;
  status: string;
  pipelineStage: string | null;
  jobType: string | null;
  contractCents: number;
  client: { id: string; name: string; leadSource: string | null };
};

type OptAction =
  | { type: "stage"; projectId: string; stage: string }
  | { type: "source"; projectId: string; source: string };

function fmtCents(cents: number): string {
  return cents > 0
    ? "$" + Math.round(cents / 100).toLocaleString("en-CA")
    : "—";
}

export default function PipelineBoard({
  projects: initial,
  canEdit,
}: {
  projects: ProjectData[];
  canEdit: boolean;
}) {
  const [filterStatuses, setFilterStatuses] = useState<string[]>([
    "PRESALE",
    "OPEN",
  ]);
  const [filterSource, setFilterSource] = useState("");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [projects, updateOpt] = useOptimistic(
    initial,
    (state, action: OptAction) => {
      if (action.type === "stage") {
        return state.map((p) =>
          p.id === action.projectId ? { ...p, pipelineStage: action.stage } : p
        );
      }
      return state.map((p) =>
        p.id === action.projectId
          ? { ...p, client: { ...p.client, leadSource: action.source } }
          : p
      );
    }
  );

  const visible = projects.filter((p) => {
    const statusOk =
      filterStatuses.length === 0 || filterStatuses.includes(p.status);
    const sourceOk = !filterSource || p.client.leadSource === filterSource;
    return statusOk && sourceOk;
  });

  // Count by lead source across ALL projects (not just visible)
  const sourceCounts = LEAD_SOURCE.reduce<Record<string, number>>((acc, s) => {
    acc[s] = projects.filter((p) => p.client.leadSource === s).length;
    return acc;
  }, {});

  function handleDragStart(e: React.DragEvent<HTMLDivElement>, projectId: string) {
    if (!canEdit) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", projectId);
    setDraggingId(projectId);
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>, stage: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dropTarget !== stage) setDropTarget(stage);
  }

  function handleDragLeave(e: React.DragEvent<HTMLDivElement>) {
    const related = e.relatedTarget;
    if (related instanceof Element && e.currentTarget.contains(related)) return;
    setDropTarget(null);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>, stage: string) {
    e.preventDefault();
    setDropTarget(null);
    const projectId = e.dataTransfer.getData("text/plain");
    if (!projectId || !canEdit) return;
    setDraggingId(null);
    startTransition(async () => {
      updateOpt({ type: "stage", projectId, stage });
      await setPipelineStage(projectId, stage);
    });
  }

  function handleDragEnd() {
    setDraggingId(null);
    setDropTarget(null);
  }

  function handleStageSelect(projectId: string, stage: string) {
    if (!stage) return;
    startTransition(async () => {
      updateOpt({ type: "stage", projectId, stage });
      await setPipelineStage(projectId, stage);
    });
  }

  function handleSourceSelect(projectId: string, source: string) {
    if (!source) return;
    const clientId =
      projects.find((p) => p.id === projectId)?.client.id ?? "";
    if (!clientId) return;
    startTransition(async () => {
      updateOpt({ type: "source", projectId, source });
      await setLeadSource(clientId, source);
    });
  }

  return (
    <div className="flex flex-col gap-4 flex-1 min-h-0">
      {/* ── Filters ──────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3 items-center px-6 pt-1">
        {/* Status toggles */}
        <div className="flex items-center gap-2">
          <span className="label shrink-0">Status</span>
          <div className="flex gap-1 flex-wrap">
            {JOB_STATUS.map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={filterStatuses.includes(s)}
                onClick={() =>
                  setFilterStatuses((prev) =>
                    prev.includes(s)
                      ? prev.filter((x) => x !== s)
                      : [...prev, s]
                  )
                }
                className={[
                  "px-2 py-0.5 rounded text-xs font-medium border transition-colors",
                  filterStatuses.includes(s)
                    ? "bg-[var(--hh-accent)] text-white border-[var(--hh-accent)]"
                    : "border-[var(--hh-border)] text-[var(--hh-muted)] hover:border-[var(--hh-accent)]",
                ].join(" ")}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Lead source dropdown filter */}
        <div className="flex items-center gap-2">
          <span className="label shrink-0">Source</span>
          <select
            className="input py-0.5 text-sm"
            value={filterSource}
            onChange={(e) => setFilterSource(e.target.value)}
            aria-label="Filter by lead source"
          >
            <option value="">All sources</option>
            {LEAD_SOURCE.map((s) => (
              <option key={s} value={s}>
                {s} ({sourceCounts[s] ?? 0})
              </option>
            ))}
          </select>
        </div>

        <span className="ml-auto text-xs text-[var(--hh-muted)]">
          {visible.length} project{visible.length !== 1 ? "s" : ""}
          {isPending && (
            <span className="ml-2 text-[var(--hh-accent)]">· Saving…</span>
          )}
        </span>
      </div>

      {/* ── Kanban board ─────────────────────────────────────────────── */}
      <div className="relative px-6">
        {/* Right-edge scroll fade */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute right-6 top-0 bottom-0 w-12 z-20 bg-gradient-to-r from-transparent to-[var(--glass-bg)]"
        />
        <div
          className="flex gap-3 overflow-x-auto pb-4 items-start"
          aria-label="Sales pipeline board"
        >
          {PIPELINE_STAGE.map((stage) => {
            const cards = visible.filter(
              (p) => (p.pipelineStage ?? "New Lead") === stage
            );
            const isTarget = dropTarget === stage && draggingId !== null;

            return (
              <div
                key={stage}
                className="flex-shrink-0 w-[280px] flex flex-col"
              >
                {/* Sticky column header */}
                <div className="sticky top-0 z-10 bg-[var(--glass-bg)] flex items-center justify-between px-1 py-1.5 mb-1">
                  <span
                    className="text-xs font-semibold uppercase tracking-wide text-[var(--hh-muted)] truncate pr-1 leading-tight"
                    title={stage}
                  >
                    {stage}
                  </span>
                  <span className="text-xs font-mono text-[var(--hh-muted)] bg-[var(--hh-surface-alt)] rounded px-1.5 py-0.5 shrink-0">
                    {cards.length}
                  </span>
                </div>

                {/* Drop zone */}
                <div
                  className={[
                    "flex flex-col gap-2 min-h-20 rounded-lg p-1.5 transition-all border-2",
                    isTarget
                      ? "border-[var(--hh-accent)] border-dashed"
                      : "border-transparent bg-[var(--hh-surface-alt)]",
                  ].join(" ")}
                  style={{ minHeight: "5rem" }}
                  onDragOver={(e) => handleDragOver(e, stage)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, stage)}
                  aria-label={`${stage} — ${cards.length} card${cards.length !== 1 ? "s" : ""}`}
                >
                  {cards.length === 0 && (
                    <p className="text-xs text-[var(--hh-muted)] text-center py-6 opacity-40 select-none">
                      {isTarget ? "Drop here" : "No projects"}
                    </p>
                  )}

                  {cards.map((p) => (
                    <div
                      key={p.id}
                      draggable={canEdit}
                      onDragStart={(e) => handleDragStart(e, p.id)}
                      onDragEnd={handleDragEnd}
                      role="article"
                      aria-label={`${p.name}, ${p.client.name}`}
                      className={[
                        "card p-3 select-none transition-all rounded-lg",
                        canEdit ? "cursor-grab active:cursor-grabbing" : "",
                        draggingId === p.id
                          ? "opacity-40 scale-95 shadow-lg"
                          : "hover:shadow-md hover:-translate-y-0.5",
                      ].join(" ")}
                    >
                      {/* Client name */}
                      <p className="text-xs text-[var(--hh-muted)] truncate font-medium">
                        {p.client.name}
                      </p>

                      {/* Project name → opens deal detail */}
                      <Link
                        href={`/crm/${p.id}`}
                        className="text-sm font-semibold truncate mt-0.5 hover:text-[var(--hh-accent)] transition-colors block"
                        tabIndex={draggingId ? -1 : 0}
                      >
                        {p.name}
                      </Link>

                      {/* Value + job type */}
                      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                        <span className="text-xs font-mono tabular-nums font-semibold text-[var(--hh-accent)]">
                          {fmtCents(p.contractCents)}
                        </span>
                        {p.jobType && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--hh-surface-alt)] text-[var(--hh-muted)] max-w-[90px] truncate">
                            {p.jobType}
                          </span>
                        )}
                      </div>

                      {/* Office/CEO controls */}
                      {canEdit && (
                        <div className="mt-2 space-y-1">
                          <select
                            className="w-full text-xs input py-0.5"
                            value={p.pipelineStage ?? ""}
                            onChange={(e) =>
                              handleStageSelect(p.id, e.target.value)
                            }
                            onClick={(e) => e.stopPropagation()}
                            aria-label={`Pipeline stage for ${p.name}`}
                          >
                            <option value="" disabled>
                              — stage —
                            </option>
                            {PIPELINE_STAGE.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                          <select
                            className="w-full text-xs input py-0.5"
                            value={p.client.leadSource ?? ""}
                            onChange={(e) =>
                              handleSourceSelect(p.id, e.target.value)
                            }
                            onClick={(e) => e.stopPropagation()}
                            aria-label={`Lead source for ${p.client.name}`}
                          >
                            <option value="" disabled>
                              — lead source —
                            </option>
                            {LEAD_SOURCE.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Lead source summary ──────────────────────────────────────── */}
      <div className="px-6 pb-6">
        <div className="card p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--hh-muted)] mb-3">
            Lead sources
          </h3>
          <div className="flex flex-wrap gap-2">
            {LEAD_SOURCE.map((s) => {
              const count = sourceCounts[s] ?? 0;
              if (count === 0) return null;
              return (
                <button
                  key={s}
                  type="button"
                  aria-pressed={filterSource === s}
                  onClick={() =>
                    setFilterSource((prev) => (prev === s ? "" : s))
                  }
                  className={[
                    "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border transition-colors",
                    filterSource === s
                      ? "bg-[var(--hh-accent)] text-white border-[var(--hh-accent)]"
                      : "border-[var(--hh-border)] hover:border-[var(--hh-accent)] text-[var(--hh-muted)]",
                  ].join(" ")}
                >
                  <span>{s}</span>
                  <span className="font-mono font-semibold">{count}</span>
                </button>
              );
            })}
            {LEAD_SOURCE.every((s) => (sourceCounts[s] ?? 0) === 0) && (
              <span className="text-xs text-[var(--hh-muted)]">
                No lead sources recorded yet — set them via the cards above
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
