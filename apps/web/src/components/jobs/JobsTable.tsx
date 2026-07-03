"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

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
};

export default function JobsTable({ rows }: { rows: JobRow[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");

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

  return (
    <div className="flex flex-col gap-3">
      <div className="relative max-w-xs">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 opacity-50" />
        <input
          className="input !pl-8 text-sm"
          placeholder="Search jobs"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div className="hh-panel overflow-x-auto !p-0">
        <table className="min-w-full text-sm">
          <thead className="border-b border-glass-border">
            <tr>
              <th className="hh-label px-5 py-3 text-left">Name</th>
              <th className="hh-label px-5 py-3 text-left">Customer</th>
              <th className="hh-label px-5 py-3 text-left">Location</th>
              <th className="hh-label px-5 py-3 text-left">Number</th>
              <th className="hh-label px-5 py-3 text-left">Status</th>
              <th className="hh-label px-5 py-3 text-left">Stage / Phase</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-glass-border">
            {filtered.map((r) => (
              <tr
                key={r.id}
                className="hh-row--flat cursor-pointer"
                onClick={() => router.push(`/jobs/${r.id}`)}
              >
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
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-6 hh-secondary">
                  No jobs match.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot className="border-t border-glass-border">
            <tr>
              <td colSpan={6} className="px-5 py-3 hh-label">
                COUNT <span className="tabular-nums ml-2">{filtered.length}</span>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
