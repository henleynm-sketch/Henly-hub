"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { bulkCreateEngagementPerJob, bulkGroupIntoEngagement } from "@/lib/actions/engagements";
import { Toast } from "@/components/ui/Toast";

export type JobRow = {
  id: string;
  name: string;
  clientName: string;
  address: string | null;
  code: string | null;
  status: string;
  pipelineStage: string | null;
  constructionPhase: string | null;
  jobtread: boolean;
  hasProject: boolean;
};

export default function JobsTable({ rows }: { rows: JobRow[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [groupOpen, setGroupOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.clientName.toLowerCase().includes(q) ||
        (r.address ?? "").toLowerCase().includes(q) ||
        (r.code ?? "").toLowerCase().includes(q),
    );
  }, [rows, search]);

  const allVisibleSelected = filtered.length > 0 && filtered.every((r) => selected.has(r.id));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllVisible() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) filtered.forEach((r) => next.delete(r.id));
      else filtered.forEach((r) => next.add(r.id));
      return next;
    });
  }

  function reportResult(res: { ok: boolean; error?: string; created?: number; linked?: number; skipped?: number }) {
    if (!res.ok) {
      setToast({ message: res.error ?? "Action failed", type: "error" });
      return;
    }
    setToast({
      message: `Created ${res.created ?? 0}, linked ${res.linked ?? 0}, skipped ${res.skipped ?? 0} (already linked)`,
      type: "success",
    });
    setSelected(new Set());
    setGroupOpen(false);
    setGroupName("");
    router.refresh();
  }

  function createPerJob() {
    startTransition(async () => {
      reportResult(await bulkCreateEngagementPerJob([...selected]));
    });
  }

  function groupIntoOne() {
    startTransition(async () => {
      reportResult(await bulkGroupIntoEngagement([...selected], groupName));
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-xs flex-1">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 opacity-50" />
          <input
            className="input !pl-8 text-sm"
            placeholder="Search jobs"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {selected.size > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="hh-secondary text-xs tabular-nums">{selected.size} selected</span>
            <button className="btn-secondary text-xs" disabled={pending} onClick={createPerJob}>
              Create a project per job
            </button>
            <button
              className="btn-secondary text-xs"
              disabled={pending}
              onClick={() => setGroupOpen(true)}
            >
              Group into one project
            </button>
            <button className="btn-ghost text-xs" onClick={() => setSelected(new Set())}>
              Clear
            </button>
          </div>
        )}
      </div>

      {groupOpen && (
        <div className="hh-panel flex flex-wrap items-end gap-3 p-4">
          <div className="flex-1 min-w-[220px]">
            <label className="label">Project name</label>
            <input
              className="input mt-1"
              autoFocus
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="e.g. Donaldson — 610 Indian Point"
            />
            <p className="mt-1.5 hh-caption">
              Groups the {selected.size} selected jobs under one project. All jobs must share one
              client; jobs already in a project are skipped.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              className="btn-primary text-xs"
              disabled={pending || !groupName.trim()}
              onClick={groupIntoOne}
            >
              {pending ? "Grouping…" : "Create & link"}
            </button>
            <button className="btn-ghost text-xs" onClick={() => setGroupOpen(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="hh-panel overflow-x-auto !p-0">
        <table className="min-w-full text-sm">
          <thead className="border-b border-glass-border">
            <tr>
              <th className="px-4 py-3">
                <input
                  type="checkbox"
                  aria-label="Select all visible jobs"
                  checked={allVisibleSelected}
                  onChange={toggleAllVisible}
                />
              </th>
              <th className="hh-label px-5 py-3 text-left">Name</th>
              <th className="hh-label px-5 py-3 text-left">Customer</th>
              <th className="hh-label px-5 py-3 text-left">Location</th>
              <th className="hh-label px-5 py-3 text-left">Number</th>
              <th className="hh-label px-5 py-3 text-left">Status</th>
              <th className="hh-label px-5 py-3 text-left">Stage / Phase</th>
              <th className="hh-label px-5 py-3 text-left">Project</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-glass-border">
            {filtered.map((r) => (
              <tr
                key={r.id}
                className="hh-row--flat cursor-pointer"
                onClick={() => router.push(`/jobs/${r.id}`)}
              >
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    aria-label={`Select ${r.name}`}
                    checked={selected.has(r.id)}
                    onChange={() => toggle(r.id)}
                  />
                </td>
                <td className="px-5 py-3 hh-primary">{r.name}</td>
                <td className="px-5 py-3 hh-secondary">{r.clientName}</td>
                <td className="px-5 py-3 hh-secondary">{r.address ?? "—"}</td>
                <td className="px-5 py-3 hh-secondary tabular-nums">{r.code ?? "—"}</td>
                <td className="px-5 py-3">
                  <span className="hh-badge">{r.status}</span>
                </td>
                <td className="px-5 py-3 hh-secondary">
                  {r.pipelineStage ?? r.constructionPhase ?? "—"}
                </td>
                <td className="px-5 py-3 hh-secondary">{r.hasProject ? "Linked" : "—"}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-5 py-6 hh-secondary">
                  No jobs match.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot className="border-t border-glass-border">
            <tr>
              <td colSpan={8} className="px-5 py-3 hh-label">
                COUNT <span className="tabular-nums ml-2">{filtered.length}</span>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <Toast
        message={toast?.message ?? ""}
        type={toast?.type ?? "info"}
        isOpen={toast !== null}
        onClose={() => setToast(null)}
      />
    </div>
  );
}
