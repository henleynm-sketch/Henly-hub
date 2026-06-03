"use client";

import React, { useState, useEffect } from "react";
import { Clock, Play, Square, AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import { COST_CODES } from "@/lib/costCodes";
import { clockInAction, clockOutAction } from "@/app/(app)/projects/[id]/timeActions";
import { formatRelative } from "@/lib/utils";

interface SimpleProject {
  id: string;
  name: string;
}

interface SimpleTimeEntry {
  id: string;
  projectId: string;
  project: { name: string };
  costCode: string;
  clockIn: Date;
  clockOut: Date | null;
  hours: number | null;
  approved: boolean;
  qbReady: boolean;
}

interface TimeClockTabProps {
  currentProjectId: string;
  assignedProjects: SimpleProject[];
  activeSession: SimpleTimeEntry | null;
  recentEntries: SimpleTimeEntry[];
}

export default function TimeClockTab({
  currentProjectId,
  assignedProjects,
  activeSession,
  recentEntries,
}: TimeClockTabProps) {
  const [selectedProjectId, setSelectedProjectId] = useState(currentProjectId);
  const [selectedCostCode, setSelectedCostCode] = useState(COST_CODES[0].fullName);
  const [elapsed, setElapsed] = useState("00:00:00");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-select current project if it is in assigned list
  useEffect(() => {
    const isAssigned = assignedProjects.some((p) => p.id === currentProjectId);
    if (isAssigned) {
      setSelectedProjectId(currentProjectId);
    } else if (assignedProjects.length > 0) {
      setSelectedProjectId(assignedProjects[0].id);
    }
  }, [currentProjectId, assignedProjects]);

  // Live ticking timer
  useEffect(() => {
    if (!activeSession) return;
    const start = new Date(activeSession.clockIn).getTime();

    const updateTimer = () => {
      const now = Date.now();
      const diff = Math.max(0, now - start);
      const secs = Math.floor((diff / 1000) % 60);
      const mins = Math.floor((diff / 60000) % 60);
      const hrs = Math.floor(diff / 3600000);

      const pad = (n: number) => String(n).padStart(2, "0");
      setElapsed(`${pad(hrs)}:${pad(mins)}:${pad(secs)}`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [activeSession]);

  const handleClockIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isPending) return;
    setIsPending(true);
    setError(null);

    try {
      await clockInAction(selectedProjectId, selectedCostCode);
    } catch (err: any) {
      setError(err?.message || "Failed to clock in.");
    } finally {
      setIsPending(false);
    }
  };

  const handleClockOut = async () => {
    if (isPending || !activeSession) return;
    setIsPending(true);
    setError(null);

    try {
      await clockOutAction(activeSession.id, currentProjectId);
    } catch (err: any) {
      setError(err?.message || "Failed to clock out.");
    } finally {
      setIsPending(false);
    }
  };

  const formatTime = (dateStr: Date | null) => {
    if (!dateStr) return "—";
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const formatDate = (dateStr: Date) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg bg-rose-50 p-4 text-sm text-rose-700 flex items-start gap-2 font-medium">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {activeSession ? (
        /* Clocked In Card */
        <div className="card border-l-4 border-l-emerald-500 bg-emerald-50/20 p-6 md:p-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-ping" />
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Currently Active Session</span>
              </div>
              <h3 className="text-xl font-bold text-slate-900">{activeSession.project.name}</h3>
              <div className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2 text-sm text-slate-600">
                <div>
                  <span className="font-medium text-slate-500">Cost Code:</span> {activeSession.costCode}
                </div>
                <div>
                  <span className="font-medium text-slate-500">Started:</span> {formatTime(activeSession.clockIn)} ({formatDate(activeSession.clockIn)})
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4 shrink-0">
              <div className="flex flex-col items-center justify-center bg-white border border-emerald-100 rounded-xl px-6 py-3 min-w-[150px] shadow-sm">
                <span className="text-xs font-medium text-emerald-700 uppercase tracking-wide">Elapsed Time</span>
                <span className="text-3xl font-mono font-bold text-slate-900 mt-1">{elapsed}</span>
              </div>

              <button
                onClick={handleClockOut}
                disabled={isPending}
                className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-rose-600 hover:bg-rose-700 px-6 py-4 text-sm font-semibold text-white shadow-md active:bg-rose-800 transition-all disabled:opacity-50 min-h-[58px]"
              >
                {isPending ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : (
                  <Square size={16} fill="white" />
                )}
                <span>Clock Out</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Clock In Form */
        <div className="card p-6 md:p-8">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-6">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-brand-50 text-brand-600">
              <Clock size={20} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900">Start Time Session</h3>
              <p className="text-xs text-slate-500">Select a project and cost code to clock in</p>
            </div>
          </div>

          {assignedProjects.length === 0 ? (
            <div className="text-center py-6 text-sm text-slate-500">
              You are not assigned to any projects. You must be assigned to a project to clock in.
            </div>
          ) : (
            <form onSubmit={handleClockIn} className="grid gap-6 md:grid-cols-3 md:items-end">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block">Select Project</label>
                <select
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="input h-[44px] w-full"
                  disabled={isPending}
                  required
                >
                  {assignedProjects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block">Cost Code (Labour Only)</label>
                <select
                  value={selectedCostCode}
                  onChange={(e) => setSelectedCostCode(e.target.value)}
                  className="input h-[44px] w-full"
                  disabled={isPending}
                  required
                >
                  {COST_CODES.map((cc) => (
                    <option key={cc.code} value={cc.fullName}>
                      {cc.fullName}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={isPending}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-5 py-3 text-sm font-semibold text-white shadow-sm active:bg-emerald-800 transition-colors disabled:opacity-50 h-[44px]"
              >
                {isPending ? (
                  <Loader2 className="animate-spin" size={16} />
                ) : (
                  <Play size={14} fill="white" />
                )}
                <span>Clock In</span>
              </button>
            </form>
          )}
        </div>
      )}

      {/* Recent Entries */}
      <section className="card">
        <div className="border-b border-slate-100 px-5 py-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900 font-medium">Your Recent Time Entries</h3>
          <span className="text-xs text-slate-500">{recentEntries.length} logged</span>
        </div>

        {recentEntries.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">No time entries recorded recently.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm divide-y divide-slate-100">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3 text-left font-medium">Date</th>
                  <th className="px-5 py-3 text-left font-medium">Project</th>
                  <th className="px-5 py-3 text-left font-medium">Cost Code</th>
                  <th className="px-5 py-3 text-right font-medium">Clock In / Out</th>
                  <th className="px-5 py-3 text-right font-medium">Hours</th>
                  <th className="px-5 py-3 text-center font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {recentEntries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-3 font-medium text-slate-900">{formatDate(entry.clockIn)}</td>
                    <td className="px-5 py-3 text-slate-700">{entry.project.name}</td>
                    <td className="px-5 py-3 text-slate-600 font-mono text-xs">{entry.costCode}</td>
                    <td className="px-5 py-3 text-right text-slate-600">
                      <div>{formatTime(entry.clockIn)}</div>
                      <div className="text-xs text-slate-400">to {formatTime(entry.clockOut)}</div>
                    </td>
                    <td className="px-5 py-3 text-right font-mono font-medium text-slate-950">
                      {entry.hours !== null ? `${entry.hours.toFixed(2)}h` : "Active"}
                    </td>
                    <td className="px-5 py-3 text-center">
                      {entry.approved ? (
                        <span className="inline-flex items-center gap-1 badge-green text-xs font-semibold py-0.5 px-2">
                          <CheckCircle size={10} />
                          Approved
                        </span>
                      ) : entry.clockOut ? (
                        <span className="badge-amber text-xs font-semibold py-0.5 px-2">
                          Pending Approval
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 badge-blue text-xs font-semibold py-0.5 px-2">
                          <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-500 animate-ping" />
                          Active
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
