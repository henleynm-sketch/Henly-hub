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
        <div className="hh-panel border-l-4 border-l-emerald-500 p-6 md:p-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="hh-dot hh-dot--green animate-ping" />
                <span className="hh-label">Currently Active Session</span>
              </div>
              <h3 className="hh-primary">{activeSession.project.name}</h3>
              <div className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2 hh-secondary">
                <div>
                  <span className="font-medium">Cost Code:</span> {activeSession.costCode}
                </div>
                <div>
                  <span className="font-medium">Started:</span> {formatTime(activeSession.clockIn)} ({formatDate(activeSession.clockIn)})
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4 shrink-0">
              <div className="hh-row flex-col items-center justify-center min-w-[150px]">
                <span className="hh-label">Elapsed Time</span>
                <span className="text-3xl font-mono font-bold text-ink mt-1">{elapsed}</span>
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
        <div className="hh-panel p-6 md:p-8">
          <div className="flex items-center gap-3 pb-4 mb-6">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-brand-50 text-brand-600">
              <Clock size={20} />
            </div>
            <div>
              <h3 className="hh-primary">Start Time Session</h3>
              <p className="hh-caption">Select a project and cost code to clock in</p>
            </div>
          </div>

          {assignedProjects.length === 0 ? (
            <div className="text-center py-6 hh-secondary">
              You are not assigned to any projects. You must be assigned to a project to clock in.
            </div>
          ) : (
            <form onSubmit={handleClockIn} className="grid gap-6 md:grid-cols-3 md:items-end">
              <div className="space-y-1.5">
                <label className="hh-label block">Select Project</label>
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
                <label className="hh-label block">Cost Code (Labour Only)</label>
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
      <section className="hh-panel">
        <div className="border-b border-glass-border px-5 py-4 flex items-center justify-between">
          <h3 className="hh-label">Your Recent Time Entries</h3>
          <span className="hh-caption">{recentEntries.length} logged</span>
        </div>

        {recentEntries.length === 0 ? (
          <div className="p-8 text-center hh-secondary">No time entries recorded recently.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm divide-y divide-glass-border">
              <thead className="border-b border-glass-border">
                <tr>
                  <th className="hh-label px-5 py-3 text-left">Date</th>
                  <th className="hh-label px-5 py-3 text-left">Project</th>
                  <th className="hh-label px-5 py-3 text-left">Cost Code</th>
                  <th className="hh-label px-5 py-3 text-right">Clock In / Out</th>
                  <th className="hh-label px-5 py-3 text-right">Hours</th>
                  <th className="hh-label px-5 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-glass-border">
                {recentEntries.map((entry) => (
                  <tr key={entry.id} className="hh-row--flat">
                    <td className="px-5 py-3 hh-primary">{formatDate(entry.clockIn)}</td>
                    <td className="px-5 py-3 hh-secondary">{entry.project.name}</td>
                    <td className="px-5 py-3"><span className="hh-chip">{entry.costCode}</span></td>
                    <td className="px-5 py-3 text-right hh-secondary">
                      <div>{formatTime(entry.clockIn)}</div>
                      <div className="hh-caption">to {formatTime(entry.clockOut)}</div>
                    </td>
                    <td className="px-5 py-3 text-right font-mono hh-primary">
                      {entry.hours !== null ? `${entry.hours.toFixed(2)}h` : "Active"}
                    </td>
                    <td className="px-5 py-3 text-center">
                      {entry.approved ? (
                        <span className="hh-badge hh-badge--success inline-flex items-center gap-1">
                          <CheckCircle size={10} />
                          Approved
                        </span>
                      ) : entry.clockOut ? (
                        <span className="hh-badge hh-badge--warning">
                          Pending Approval
                        </span>
                      ) : (
                        <span className="hh-badge inline-flex items-center gap-1">
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
