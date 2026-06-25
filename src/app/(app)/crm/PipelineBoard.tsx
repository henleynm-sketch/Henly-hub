"use client";

import { useOptimistic, useTransition, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { PIPELINE_STAGE, LEAD_SOURCE, JOB_STATUS } from "@/lib/taxonomy";
import { setPipelineStage } from "./actions";

type ProjectData = {
  id: string;
  name: string;
  status: string;
  pipelineStage: string | null;
  jobType: string | null;
  contractCents: number;
  client: { id: string; name: string; leadSource: string | null };
};

type OptAction = { type: "stage"; projectId: string; stage: string };

function fmtCents(cents: number): string {
  return cents > 0
    ? "$" + Math.round(cents / 100).toLocaleString("en-CA")
    : "";
}

// Per-stage badge colors expressed as inline-style rgba+var pairs.
// Using inline styles (not Tailwind arbitrary values) avoids PostCSS comma issues.
const STAGE_BADGE: Record<string, { bg: string; color: string }> = {
  "New Lead":                    { bg: "rgba(92,124,250,0.14)",  color: "var(--hh-accent)" },
  "Contacted":                   { bg: "rgba(92,124,250,0.10)",  color: "var(--hh-accent)" },
  "Consultation Booked":         { bg: "rgba(52,199,89,0.14)",   color: "var(--hh-dot-green)" },
  "Onsite Consultation Complete":{ bg: "rgba(52,199,89,0.12)",   color: "var(--hh-dot-green)" },
  "Design Proposal Sent":        { bg: "rgba(255,159,10,0.14)",  color: "var(--hh-dot-orange)" },
  "Design Proposal Signed":      { bg: "rgba(255,159,10,0.20)",  color: "var(--hh-dot-orange)" },
  "Onsite Kickoff":              { bg: "rgba(255,159,10,0.20)",  color: "var(--hh-dot-orange)" },
  "Budget & Drawings Underway":  { bg: "rgba(255,159,10,0.20)",  color: "var(--hh-dot-orange)" },
  "Construction Proposal Sent":  { bg: "rgba(191,90,242,0.14)",  color: "var(--hh-dot-purple)" },
  "Negotiation":                 { bg: "rgba(191,90,242,0.20)",  color: "var(--hh-dot-purple)" },
  "Closed Won":                  { bg: "rgba(52,199,89,0.22)",   color: "var(--hh-dot-green)" },
  "Closed Lost":                 { bg: "rgba(255,92,92,0.14)",   color: "var(--hh-dot-red)" },
};

export default function PipelineBoard({
  projects: initial,
  canEdit,
}: {
  projects: ProjectData[];
  canEdit: boolean;
}) {
  const router = useRouter();

  const [filterStatuses, setFilterStatuses] = useState<string[]>([
    "PRESALE",
    "OPEN",
  ]);
  const [filterSource, setFilterSource] = useState("");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Track whether the pointer actually moved during a drag so we can
  // distinguish a genuine click from the mouseup at the end of a drag.
  const dragMovedRef = useRef(false);

  const [projects, updateOpt] = useOptimistic(
    initial,
    (state, action: OptAction) =>
      state.map((p) =>
        p.id === action.projectId ? { ...p, pipelineStage: action.stage } : p
      )
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

  // ── Drag handlers ──────────────────────────────────────────────────────────

  function handleDragStart(
    e: React.DragEvent<HTMLDivElement>,
    projectId: string
  ) {
    if (!canEdit) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", projectId);
    dragMovedRef.current = false;
    setDraggingId(projectId);
  }

  function handleDrag() {
    // Any drag event means the card actually moved
    dragMovedRef.current = true;
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

  // ── Card click → deal record ───────────────────────────────────────────────

  function handleCardClick(projectId: string) {
    // dragMovedRef is true when the mouse actually moved in a drag sequence —
    // skip navigation so releasing a drop doesn't also navigate.
    if (dragMovedRef.current) return;
    router.push(`/crm/${projectId}`);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

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

        {/* Lead source filter — .input gets color-scheme from globals.css */}
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
          {visible.length} deal{visible.length !== 1 ? "s" : ""}
          {isPending && (
            <span className="ml-2 text-[var(--hh-accent)]">· Saving…</span>
          )}
        </span>
      </div>

      {/* ── Kanban board ─────────────────────────────────────────────── */}
      {/*
        overflow-x:clip clips the X overflow without creating a scroll
        container (unlike overflow-x:hidden), so position:sticky on column
        headers still works relative to the page. The inner overflow-x-auto
        div provides the actual bounded horizontal scroll.
      */}
      <div className="relative px-6" style={{ overflowX: "clip" }}>
        {/* Right-edge fade hint */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute right-6 top-0 bottom-0 w-12 z-20 bg-gradient-to-r from-transparent to-[var(--glass-bg)]"
        />

        <div
          className="flex gap-3 overflow-x-auto pb-4 items-start w-full scroll-smooth"
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
                className="flex-shrink-0 w-52 flex flex-col"
              >
                {/* Column header — sticky so it stays visible on page scroll */}
                <div
                  className="sticky top-0 z-10 flex items-center justify-between px-1 py-2 mb-1"
                  style={{ background: "var(--hh-canvas)" }}
                >
                  <span
                    className="text-[11px] font-semibold uppercase tracking-wide text-[var(--hh-muted)] truncate pr-1 leading-tight"
                    title={stage}
                  >
                    {stage}
                  </span>
                  <span className="text-[11px] font-mono text-[var(--hh-muted)] bg-[var(--hh-surface-alt)] rounded px-1.5 py-0.5 shrink-0">
                    {cards.length}
                  </span>
                </div>

                {/* Drop zone */}
                <div
                  className={[
                    "flex flex-col gap-2 rounded-lg p-1.5 transition-all border-2",
                    isTarget
                      ? "border-[var(--hh-accent)] border-dashed"
                      : "border-transparent bg-[var(--hh-surface-alt)]",
                  ].join(" ")}
                  style={{ minHeight: "5rem" }}
                  onDragOver={(e) => handleDragOver(e, stage)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, stage)}
                  aria-label={`${stage} — ${cards.length} card${
                    cards.length !== 1 ? "s" : ""
                  }`}
                >
                  {cards.length === 0 && (
                    <p className="text-xs text-[var(--hh-muted)] text-center py-6 opacity-40 select-none">
                      {isTarget ? "Drop here" : "No deals"}
                    </p>
                  )}

                  {cards.map((p) => {
                    const isDragging = draggingId === p.id;
                    // Only show client name separately when it differs from the
                    // deal name (HubSpot imports often set both to the same string)
                    const showClient = p.client.name !== p.name;
                    const stageBadge =
                      STAGE_BADGE[p.pipelineStage ?? "New Lead"];
                    const value = fmtCents(p.contractCents);

                    return (
                      <div
                        key={p.id}
                        draggable={canEdit}
                        onDragStart={(e) => handleDragStart(e, p.id)}
                        onDrag={handleDrag}
                        onDragEnd={handleDragEnd}
                        onClick={() => handleCardClick(p.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            router.push(`/crm/${p.id}`);
                          }
                        }}
                        role="button"
                        tabIndex={isDragging ? -1 : 0}
                        aria-label={`${p.name}${
                          showClient ? ` · ${p.client.name}` : ""
                        } — open deal record`}
                        className={[
                          "card p-3 select-none rounded-lg outline-none",
                          "focus-visible:ring-2 focus-visible:ring-[var(--hh-accent)]",
                          canEdit
                            ? "cursor-grab active:cursor-grabbing"
                            : "cursor-pointer",
                          isDragging
                            ? "opacity-40 scale-95 shadow-lg"
                            : "hover:shadow-md hover:-translate-y-px",
                        ].join(" ")}
                      >
                        {/* Client name — only when different from deal name */}
                        {showClient && (
                          <p className="text-[10px] text-[var(--hh-muted)] truncate leading-tight mb-0.5">
                            {p.client.name}
                          </p>
                        )}

                        {/* Deal name — primary identifier */}
                        <p className="text-sm font-semibold leading-snug truncate text-[var(--hh-text)]">
                          {p.name}
                        </p>

                        {/* Value */}
                        {value && (
                          <p className="text-xs font-mono tabular-nums font-semibold text-[var(--hh-accent)] mt-1 leading-tight">
                            {value}
                          </p>
                        )}

                        {/* Metadata badges */}
                        <div className="flex items-center gap-1 mt-2 flex-wrap">
                          {p.jobType && (
                            <span
                              className="text-[10px] px-1.5 py-0.5 rounded truncate max-w-[72px]"
                              style={{
                                background: "var(--hh-surface-alt)",
                                color: "var(--hh-muted)",
                              }}
                            >
                              {p.jobType}
                            </span>
                          )}
                          {p.client.leadSource && (
                            <span
                              className="text-[10px] px-1.5 py-0.5 rounded truncate max-w-[80px]"
                              style={{
                                background: "var(--hh-surface-alt)",
                                color: "var(--hh-muted)",
                              }}
                            >
                              {p.client.leadSource}
                            </span>
                          )}
                          {stageBadge && (
                            <span
                              className="text-[10px] px-1.5 py-0.5 rounded truncate max-w-[90px] ml-auto"
                              style={{
                                backgroundColor: stageBadge.bg,
                                color: stageBadge.color,
                              }}
                            >
                              {p.pipelineStage}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
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
                No lead sources recorded yet — set them on the deal record
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
