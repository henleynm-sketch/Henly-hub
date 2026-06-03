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
        <div className="card p-5 bg-white shadow-sm flex items-center justify-between border-l-4 border-l-slate-400">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Total Hours</span>
            <span className="text-2xl font-bold text-slate-900 mt-1 block font-mono">{totalHours.toFixed(2)}h</span>
          </div>
          <div className="h-10 w-10 rounded-lg bg-slate-50 grid place-items-center text-slate-500">
            <Clock size={20} />
          </div>
        </div>

        <div className="card p-5 bg-white shadow-sm flex items-center justify-between border-l-4 border-l-emerald-500">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Approved Hours</span>
            <span className="text-2xl font-bold text-slate-900 mt-1 block font-mono text-emerald-700">{approvedHours.toFixed(2)}h</span>
          </div>
          <div className="h-10 w-10 rounded-lg bg-emerald-50 grid place-items-center text-emerald-600">
            <CheckCircle size={20} />
          </div>
        </div>

        <div className="card p-5 bg-white shadow-sm flex items-center justify-between border-l-4 border-l-amber-500">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Pending Approval</span>
            <span className="text-2xl font-bold text-slate-900 mt-1 block font-mono text-amber-700">{pendingHours.toFixed(2)}h</span>
          </div>
          <div className="h-10 w-10 rounded-lg bg-amber-50 grid place-items-center text-amber-600">
            <Calendar size={20} />
          </div>
        </div>

        <div className="card p-5 bg-white shadow-sm flex items-center justify-between border-l-4 border-l-blue-500">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Active On Site</span>
            <span className="text-2xl font-bold text-slate-900 mt-1 block font-mono text-blue-700">{activeCount} crew</span>
          </div>
          <div className="h-10 w-10 rounded-lg bg-blue-50 grid place-items-center text-blue-600">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
            </span>
          </div>
        </div>
      </div>

      {/* Main Review Table */}
      <section className="card">
        <div className="border-b border-slate-100 px-5 py-4">
          <h3 className="text-sm font-semibold text-slate-900">Time Entries Tracker</h3>
        </div>

        {entries.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">No time entries recorded for this project.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm divide-y divide-slate-100">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3 text-left font-medium">Employee</th>
                  <th className="px-5 py-3 text-left font-medium">Date</th>
                  <th className="px-5 py-3 text-left font-medium">Cost Code</th>
                  <th className="px-5 py-3 text-right font-medium">Clock In / Out</th>
                  <th className="px-5 py-3 text-right font-medium">Hours</th>
                  <th className="px-5 py-3 text-center font-medium">Status & Sync</th>
                  <th className="px-5 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {entries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-3">
                      <div className="font-semibold text-slate-900">{entry.user.name}</div>
                      <div className="text-xs text-slate-400">{entry.user.email}</div>
                    </td>
                    <td className="px-5 py-3 text-slate-700 font-medium">{formatDate(entry.clockIn)}</td>
                    <td className="px-5 py-3 text-slate-600 font-mono text-xs">{entry.costCode}</td>
                    <td className="px-5 py-3 text-right text-slate-600">
                      <div>{formatTime(entry.clockIn)}</div>
                      <div className="text-xs text-slate-400">{entry.clockOut ? `to ${formatTime(entry.clockOut)}` : "Active now"}</div>
                    </td>
                    <td className="px-5 py-3 text-right font-mono font-medium text-slate-900">
                      {entry.hours !== null ? `${entry.hours.toFixed(2)}h` : "Active"}
                    </td>
                    <td className="px-5 py-3 text-center">
                      {entry.approved ? (
                        <div className="flex flex-col items-center gap-1">
                          <span className="badge-green text-xs font-semibold py-0.5 px-2 inline-flex items-center gap-1">
                            <Check size={12} /> Approved
                          </span>
                          {entry.qbReady && (
                            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                              Ready for QB Sync
                            </span>
                          )}
                        </div>
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
