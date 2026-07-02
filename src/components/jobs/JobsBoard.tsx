"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, Loader2, Plus, Search, Trash2 } from "lucide-react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import {
  GROUP_AXES,
  AXIS_LABELS,
  type BoardJob,
  type GroupAxis,
  type JobViewDTO,
} from "@/lib/jobBoard";
import {
  createJobView,
  deleteJobView,
  setProjectGroupField,
} from "@/lib/actions/jobViews";

const NO_VALUE = "__none__";

export default function JobsBoard({
  views: initialViews,
  jobs: initialJobs,
  canDrag,
  isCeo,
  userId,
}: {
  views: JobViewDTO[];
  jobs: BoardJob[];
  canDrag: boolean;
  isCeo: boolean;
  userId: string;
}) {
  const router = useRouter();
  const [views, setViews] = useState(initialViews);
  const [viewId, setViewId] = useState(initialViews[0]?.id ?? "");
  const [jobs, setJobs] = useState(initialJobs);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const view = views.find((v) => v.id === viewId) ?? views[0];
  const axis: GroupAxis = view?.groupBy ?? "status";
  const columns = GROUP_AXES[axis] as readonly string[];

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 5000);
  }

  const visibleJobs = useMemo(() => {
    let list = jobs;
    const statusFilter = view?.filters?.status;
    if (statusFilter?.length) list = list.filter((j) => statusFilter.includes(j.status));
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (j) =>
          j.name.toLowerCase().includes(q) ||
          j.clientName.toLowerCase().includes(q) ||
          (j.code ?? "").toLowerCase().includes(q),
      );
    }
    return list;
  }, [jobs, view, search]);

  const byColumn = useMemo(() => {
    const map = new Map<string, BoardJob[]>();
    for (const c of columns) map.set(c, []);
    map.set(NO_VALUE, []);
    for (const j of visibleJobs) {
      const v = j[axis] ?? NO_VALUE;
      (map.get(v as string) ?? map.get(NO_VALUE)!).push(j);
    }
    return map;
  }, [visibleJobs, columns, axis]);

  function onDrop(column: string) {
    if (!dragId || !canDrag) return;
    const value = column === NO_VALUE ? null : column;
    const id = dragId;
    setDragId(null);
    const prev = jobs;
    setJobs((js) => js.map((j) => (j.id === id ? { ...j, [axis]: value } : j)));
    start(async () => {
      const r = await setProjectGroupField(id, axis, value);
      if (!r.ok) {
        setJobs(prev);
        flash(r.error ?? "Could not move job");
      }
    });
  }

  function onCreateView(formData: FormData) {
    const name = String(formData.get("name") || "");
    const groupBy = String(formData.get("groupBy") || "status");
    const organization = formData.get("organization") === "on";
    start(async () => {
      const r = await createJobView({ name, groupBy, organization });
      if (!r.ok) {
        flash(r.error ?? "Could not create view");
        return;
      }
      if (r.views) {
        setViews(r.views);
        const created = r.views.find((v) => v.name === name.trim());
        if (created) setViewId(created.id);
      }
      setCreateOpen(false);
    });
  }

  function onDeleteView(id: string) {
    start(async () => {
      const r = await deleteJobView(id);
      if (!r.ok) {
        flash(r.error ?? "Could not delete view");
        return;
      }
      if (r.views) {
        setViews(r.views);
        if (id === viewId) setViewId(r.views[0]?.id ?? "");
      }
    });
  }

  const personal = views.filter((v) => v.ownerId === userId);
  const organization = views.filter((v) => v.ownerId === null);

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 px-6">
        <div className="relative">
          <button
            className="btn-secondary text-sm inline-flex items-center gap-1.5"
            onClick={() => setSwitcherOpen((o) => !o)}
          >
            {view?.name ?? "Views"}
            <ChevronDown size={14} className={cn("transition-transform", switcherOpen && "rotate-180")} />
          </button>
          {switcherOpen && (
            <div className="absolute left-0 top-full mt-1 z-40 w-72 hh-panel !p-2 flex flex-col gap-0.5">
              <span className="hh-caption px-2 pt-1">Personal</span>
              {personal.map((v) => (
                <div key={v.id} className="flex items-center">
                  <button
                    className={cn("hh-nav-item flex-1 text-left", v.id === viewId && "active")}
                    onClick={() => {
                      setViewId(v.id);
                      setSwitcherOpen(false);
                    }}
                  >
                    {v.name}
                    <span className="hh-caption ml-2">{AXIS_LABELS[v.groupBy]}</span>
                  </button>
                  <button
                    className="btn-ghost !p-1.5"
                    aria-label={`Delete view ${v.name}`}
                    onClick={() => onDeleteView(v.id)}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
              <span className="hh-caption px-2 pt-2">Organization</span>
              {organization.map((v) => (
                <div key={v.id} className="flex items-center">
                  <button
                    className={cn("hh-nav-item flex-1 text-left", v.id === viewId && "active")}
                    onClick={() => {
                      setViewId(v.id);
                      setSwitcherOpen(false);
                    }}
                  >
                    {v.name}
                    <span className="hh-caption ml-2">{AXIS_LABELS[v.groupBy]}</span>
                  </button>
                  {isCeo && (
                    <button
                      className="btn-ghost !p-1.5"
                      aria-label={`Delete view ${v.name}`}
                      onClick={() => onDeleteView(v.id)}
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              ))}
              <button
                className="hh-nav-item text-left"
                onClick={() => {
                  setSwitcherOpen(false);
                  setCreateOpen(true);
                }}
              >
                <Plus size={14} className="mr-1" /> New view
              </button>
            </div>
          )}
        </div>

        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 opacity-50" />
          <input
            className="input !pl-8 text-sm"
            placeholder="Search jobs or clients"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {pending && <Loader2 size={15} className="animate-spin opacity-60" />}
        {toast && <span className="hh-secondary">{toast}</span>}

        <div className="ml-auto">
          <button className="btn-primary text-xs" onClick={() => router.push("/projects/new")}>
            + Job
          </button>
        </div>
      </div>

      {/* Board */}
      <div className="flex gap-3 overflow-x-auto px-6 pb-6 items-start">
        {[...columns, NO_VALUE].map((col) => {
          const items = byColumn.get(col) ?? [];
          const label = col === NO_VALUE ? "No Value" : col;
          const collapsed = items.length === 0 && !expanded.has(col);
          if (collapsed) {
            return (
              <button
                key={col}
                onClick={() => setExpanded((s) => new Set(s).add(col))}
                onDragOver={(e) => canDrag && e.preventDefault()}
                onDrop={() => onDrop(col)}
                className="hh-panel !p-2 shrink-0 flex flex-col items-center gap-2 min-h-[180px] w-9"
                title={`${label} — 0 jobs (click to expand)`}
              >
                <span className="hh-caption tabular-nums">0</span>
                <span
                  className="hh-secondary text-xs whitespace-nowrap"
                  style={{ writingMode: "vertical-rl" }}
                >
                  {label}
                </span>
              </button>
            );
          }
          return (
            <div
              key={col}
              onDragOver={(e) => canDrag && e.preventDefault()}
              onDrop={() => onDrop(col)}
              className={cn(
                "hh-panel !p-3 shrink-0 w-64 flex flex-col gap-2",
                col === NO_VALUE && "border-dashed",
              )}
            >
              <div className="flex items-center justify-between px-1">
                <span className="hh-label truncate" title={label}>
                  {label}
                </span>
                <span className="hh-caption tabular-nums">{items.length}</span>
              </div>
              <div className="flex flex-col gap-2 min-h-[60px]">
                {items.map((j) => (
                  <div
                    key={j.id}
                    draggable={canDrag}
                    onDragStart={() => setDragId(j.id)}
                    onDragEnd={() => setDragId(null)}
                    className={cn(
                      "hh-row flex-col !items-start !gap-0.5",
                      canDrag && "cursor-grab active:cursor-grabbing",
                      dragId === j.id && "opacity-50",
                    )}
                  >
                    <Link href={`/projects/${j.id}`} className="hh-primary hover:underline">
                      {j.name}
                      {j.code ? <span className="hh-caption ml-1.5">{j.code}</span> : null}
                    </Link>
                    <span className="hh-secondary">{j.clientName}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Create view sheet */}
      {createOpen &&
        createPortal(
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/55" onClick={() => setCreateOpen(false)} />
            <div className="hh-panel relative w-full max-w-sm">
              <h3 className="hh-label">New view</h3>
              <form action={onCreateView} className="mt-3 flex flex-col gap-3">
                <div>
                  <label className="hh-label block mb-1.5">Name</label>
                  <input name="name" className="input" required />
                </div>
                <div>
                  <label className="hh-label block mb-1.5">Group by</label>
                  <select name="groupBy" className="input" defaultValue="status">
                    {(Object.keys(GROUP_AXES) as GroupAxis[]).map((a) => (
                      <option key={a} value={a}>
                        {AXIS_LABELS[a]}
                      </option>
                    ))}
                  </select>
                </div>
                {isCeo && (
                  <label className="flex items-center gap-2 hh-secondary">
                    <input type="checkbox" name="organization" />
                    Organization view (visible to everyone)
                  </label>
                )}
                <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end mt-1">
                  <button type="button" className="btn-secondary" onClick={() => setCreateOpen(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary inline-flex items-center gap-1.5" disabled={pending}>
                    {pending && <Loader2 size={14} className="animate-spin" />}
                    Create
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
