"use client";

import React, { useState } from "react";
import { CheckCircle, AlertCircle, Loader2, Check, DollarSign, Calendar, Clock } from "lucide-react";
import { approveTimeEntryAction } from "@/app/(app)/projects/[id]/timeActions";

interface SimpleTimeEntry {
  id: string;
  projectId: string;
  costCode: string;
  clockIn: Date;
  clockOut: Date | null;
  hours: number | null;
  approved: boolean;
  qbReady: boolean;
  user: {
    name: string;
    email: string;
  };
}

interface TimeReviewTabProps {
  projectId: string;
  entries: SimpleTimeEntry[];
}

export default function TimeReviewTab({ projectId, entries }: TimeReviewTabProps) {
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Summary Metrics
  const totalHours = entries.reduce((acc, entry) => acc + (entry.hours || 0), 0);
  const approvedHours = entries.reduce((acc, entry) => acc + (entry.approved ? (entry.hours || 0) : 0), 0);
  const pendingHours = entries.reduce((acc, entry) => acc + (!entry.approved && entry.clockOut ? (entry.hours || 0) : 0), 0);
  const activeCount = entries.filter((entry) => !entry.clockOut).length;

  const handleApprove = async (entryId: string) => {
    if (approvingId) return;
    setApprovingId(entryId);
    setError(null);

    try {
      await approveTimeEntryAction(entryId, projectId);
    } catch (err: any) {
      setError(err?.message || "Failed to approve time entry.");
    } finally {
      setApprovingId(null);
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

      {/* Metrics Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="hh-panel p-5 flex items-center justify-between border-l-4 border-l-slate-400">
          <div>
            <span className="hh-label block">Total Hours</span>
            <span className="text-2xl font-bold text-ink mt-1 block font-mono">{totalHours.toFixed(2)}h</span>
          </div>
          <div className="h-10 w-10 rounded-lg grid place-items-center text-slate-500">
            <Clock size={20} />
          </div>
        </div>

        <div className="hh-panel p-5 flex items-center justify-between border-l-4 border-l-emerald-500">
          <div>
            <span className="hh-label block">Approved Hours</span>
            <span className="text-2xl font-bold mt-1 block font-mono text-emerald-700">{approvedHours.toFixed(2)}h</span>
          </div>
          <div className="h-10 w-10 rounded-lg grid place-items-center text-emerald-600">
            <CheckCircle size={20} />
          </div>
        </div>

        <div className="hh-panel p-5 flex items-center justify-between border-l-4 border-l-amber-500">
          <div>
            <span className="hh-label block">Pending Approval</span>
            <span className="text-2xl font-bold mt-1 block font-mono text-amber-700">{pendingHours.toFixed(2)}h</span>
          </div>
          <div className="h-10 w-10 rounded-lg grid place-items-center text-amber-600">
            <Calendar size={20} />
          </div>
        </div>

        <div className="hh-panel p-5 flex items-center justify-between border-l-4 border-l-blue-500">
          <div>
            <span className="hh-label block">Active On Site</span>
            <span className="text-2xl font-bold mt-1 block font-mono text-blue-700">{activeCount} crew</span>
          </div>
          <div className="h-10 w-10 rounded-lg grid place-items-center text-blue-600">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
            </span>
          </div>
        </div>
      </div>

      {/* Main Review Table */}
      <section className="hh-panel">
        <div className="border-b border-glass-border px-5 py-4">
          <h3 className="hh-label">Time Entries Tracker</h3>
        </div>

        {entries.length === 0 ? (
          <div className="p-8 text-center hh-secondary">No time entries recorded for this project.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm divide-y divide-glass-border">
              <thead className="border-b border-glass-border">
                <tr>
                  <th className="hh-label px-5 py-3 text-left">Employee</th>
                  <th className="hh-label px-5 py-3 text-left">Date</th>
                  <th className="hh-label px-5 py-3 text-left">Cost Code</th>
                  <th className="hh-label px-5 py-3 text-right">Clock In / Out</th>
                  <th className="hh-label px-5 py-3 text-right">Hours</th>
                  <th className="hh-label px-5 py-3 text-center">Status & Sync</th>
                  <th className="hh-label px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-glass-border">
                {entries.map((entry) => (
                  <tr key={entry.id} className="hh-row--flat">
                    <td className="px-5 py-3">
                      <div className="hh-primary">{entry.user.name}</div>
                      <div className="hh-secondary">{entry.user.email}</div>
                    </td>
                    <td className="px-5 py-3 hh-secondary">{formatDate(entry.clockIn)}</td>
                    <td className="px-5 py-3"><span className="hh-chip">{entry.costCode}</span></td>
                    <td className="px-5 py-3 text-right hh-secondary">
                      <div>{formatTime(entry.clockIn)}</div>
                      <div className="hh-caption">{entry.clockOut ? `to ${formatTime(entry.clockOut)}` : "Active now"}</div>
                    </td>
                    <td className="px-5 py-3 text-right font-mono hh-primary">
                      {entry.hours !== null ? `${entry.hours.toFixed(2)}h` : "Active"}
                    </td>
                    <td className="px-5 py-3 text-center">
                      {entry.approved ? (
                        <div className="flex flex-col items-center gap-1">
                          <span className="hh-badge hh-badge--success !ml-0 inline-flex items-center gap-1">
                            <Check size={12} /> Approved
                          </span>
                          {entry.qbReady && (
                            <span className="hh-label">
                              Ready for QB Sync
                            </span>
                          )}
                        </div>
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
                    <td className="px-5 py-3 text-right">
                      {!entry.approved && entry.clockOut && (
                        <button
                          onClick={() => handleApprove(entry.id)}
                          disabled={approvingId !== null}
                          className="btn-primary text-xs py-1 px-3 inline-flex items-center gap-1"
                        >
                          {approvingId === entry.id ? (
                            <Loader2 className="animate-spin" size={12} />
                          ) : (
                            <Check size={12} />
                          )}
                          <span>Approve</span>
                        </button>
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
