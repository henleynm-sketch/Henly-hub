"use client";

import React, { useState } from "react";
import { Search, CheckCircle2, AlertCircle, Loader2, UserCheck, UserMinus, HelpCircle } from "lucide-react";
import { mapUserToQBOEmployee, type QBOEmployee } from "../employeeMapActions";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  qbEmployeeId: string | null;
}

interface EmployeeMapTableProps {
  users: User[];
  employees: QBOEmployee[];
}

export default function EmployeeMapTable({ users, employees }: EmployeeMapTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<"all" | "mapped" | "unmapped">("all");

  const [savingStates, setSavingStates] = useState<Record<string, "idle" | "saving" | "saved" | "error">>({});
  const [errorMessages, setErrorMessages] = useState<Record<string, string>>({});
  const [localMappings, setLocalMappings] = useState<Record<string, string | null>>(() =>
    Object.fromEntries(users.map((u) => [u.id, u.qbEmployeeId]))
  );

  const handleMapChange = async (userId: string, selectedValue: string) => {
    const value = selectedValue === "" ? null : selectedValue;

    // Set saving state
    setSavingStates((prev) => ({ ...prev, [userId]: "saving" }));
    setErrorMessages((prev) => ({ ...prev, [userId]: "" }));

    try {
      const res = await mapUserToQBOEmployee(userId, value);
      if (res.ok) {
        setLocalMappings((prev) => ({ ...prev, [userId]: value }));
        setSavingStates((prev) => ({ ...prev, [userId]: "saved" }));
        setTimeout(() => {
          setSavingStates((prev) => ({ ...prev, [userId]: "idle" }));
        }, 3000);
      } else {
        throw new Error("Update failed");
      }
    } catch (err: any) {
      console.error(err);
      setSavingStates((prev) => ({ ...prev, [userId]: "error" }));
      setErrorMessages((prev) => ({ ...prev, [userId]: err?.message ?? "Failed to save mapping." }));
    }
  };

  // Filtered users logic
  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      (user.name ?? "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.role.toLowerCase().includes(searchTerm.toLowerCase());

    const currentMapping = localMappings[user.id];
    const isMapped = currentMapping !== null && currentMapping !== "";

    if (filterType === "mapped") return matchesSearch && isMapped;
    if (filterType === "unmapped") return matchesSearch && !isMapped;
    return matchesSearch;
  });

  const getRoleBadgeClass = (role: string) => {
    switch (role.toUpperCase()) {
      case "CEO":
        return "badge-violet";
      case "OFFICE":
        return "badge-blue";
      case "FIELD":
        return "badge-amber";
      case "SUB":
        return "badge-slate";
      default:
        return "badge-slate";
    }
  };

  const getInitials = (name: string | null) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  };

  return (
    <div className="space-y-4">
      {/* Search & Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
          <input
            type="text"
            placeholder="Search users by name, email, or role..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-lg pl-9 pr-4 py-2 text-sm bg-black/5 dark:bg-white/5 border border-glass-border text-ink placeholder:text-ink-soft/50 focus:outline-none focus:ring-2 focus:ring-accent transition"
          />
        </div>

        {/* Tab Filters */}
        <div className="flex gap-2">
          <button
            onClick={() => setFilterType("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all ${
              filterType === "all"
                ? "bg-accent text-white"
                : "bg-black/5 dark:bg-white/5 text-ink-soft border border-glass-border hover:bg-black/10 dark:hover:bg-white/10 hover:text-ink"
            }`}
          >
            All ({users.length})
          </button>
          <button
            onClick={() => setFilterType("mapped")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all flex items-center gap-1.5 ${
              filterType === "mapped"
                ? "bg-accent text-white"
                : "bg-black/5 dark:bg-white/5 text-ink-soft border border-glass-border hover:bg-black/10 dark:hover:bg-white/10 hover:text-ink"
            }`}
          >
            <UserCheck className="h-3 w-3" />
            Mapped ({Object.values(localMappings).filter(Boolean).length})
          </button>
          <button
            onClick={() => setFilterType("unmapped")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all flex items-center gap-1.5 ${
              filterType === "unmapped"
                ? "bg-accent text-white"
                : "bg-black/5 dark:bg-white/5 text-ink-soft border border-glass-border hover:bg-black/10 dark:hover:bg-white/10 hover:text-ink"
            }`}
          >
            <UserMinus className="h-3 w-3" />
            Unmapped ({users.length - Object.values(localMappings).filter(Boolean).length})
          </button>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-black/5 dark:bg-white/5 text-xs uppercase tracking-wide text-ink-soft border-b border-glass-border">
              <tr>
                <th className="px-6 py-4 text-left font-medium">User Profile</th>
                <th className="px-6 py-4 text-left font-medium">Role</th>
                <th className="px-6 py-4 text-left font-medium">QuickBooks Employee Mapping</th>
                <th className="px-6 py-4 text-left font-medium">Sync Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-glass-border">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-ink-soft">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <HelpCircle className="h-8 w-8 text-ink-muted" />
                      <p className="font-medium">No users match your criteria.</p>
                      <p className="text-xs text-ink-muted">Try adjusting your search query or filter type.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const state = savingStates[user.id] || "idle";
                  const mappedId = localMappings[user.id];
                  const isMapped = !!mappedId;

                  return (
                    <tr key={user.id} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                      {/* Profile Column */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent font-semibold text-sm">
                            {getInitials(user.name)}
                          </div>
                          <div>
                            <p className="font-semibold text-ink leading-tight">{user.name || "Unnamed User"}</p>
                            <p className="text-xs text-ink-soft leading-normal mt-0.5">{user.email}</p>
                          </div>
                        </div>
                      </td>

                      {/* Role Badge Column */}
                      <td className="px-6 py-4">
                        <span className={getRoleBadgeClass(user.role)}>
                          {user.role}
                        </span>
                      </td>

                      {/* Mapping Selector Column */}
                      <td className="px-6 py-4">
                        <div className="max-w-xs">
                          <select
                            value={mappedId || ""}
                            onChange={(e) => handleMapChange(user.id, e.target.value)}
                            disabled={state === "saving"}
                            style={{
                              backgroundColor: "var(--color-surface, rgba(30, 31, 35, 0.9))",
                              color: "var(--text-primary, #FFFFFF)"
                            }}
                            className="w-full rounded-lg px-3 py-1.5 text-sm bg-black/5 dark:bg-white/5 border border-glass-border text-ink hover:bg-black/10 dark:hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-accent transition cursor-pointer disabled:opacity-50"
                          >
                            <option value="" style={{ backgroundColor: "var(--color-surface, rgba(30, 31, 35, 0.9))", color: "var(--text-primary, #FFFFFF)" }}>
                              — Unmapped (Will block on approval) —
                            </option>
                            {employees.map((emp) => (
                              <option
                                key={emp.id}
                                value={emp.id}
                                style={{ backgroundColor: "var(--color-surface, rgba(30, 31, 35, 0.9))", color: "var(--text-primary, #FFFFFF)" }}
                              >
                                {emp.name} {!emp.active ? " (Inactive)" : ""}
                              </option>
                            ))}
                          </select>
                        </div>
                      </td>

                      {/* Save Status Column */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {state === "saving" && (
                            <span className="text-xs text-ink-muted flex items-center gap-1.5">
                              <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" />
                              Saving...
                            </span>
                          )}
                          {state === "saved" && (
                            <span className="text-xs text-emerald-500 dark:text-emerald-400 flex items-center gap-1.5 font-medium animate-fadeIn">
                              <CheckCircle2 className="h-4 w-4 text-emerald-500 dark:text-emerald-400 shrink-0" />
                              Saved!
                            </span>
                          )}
                          {state === "error" && (
                            <span
                              className="text-xs text-rose-500 dark:text-rose-400 flex items-center gap-1.5 font-medium cursor-help"
                              title={errorMessages[user.id] || "Failed to save mapping."}
                            >
                              <AlertCircle className="h-4 w-4 text-rose-500 dark:text-rose-400 shrink-0" />
                              Error
                            </span>
                          )}
                          {state === "idle" && (
                            isMapped ? (
                              <span className="badge-green text-[10px] uppercase font-bold tracking-wider py-0.5 px-2">
                                Mapped
                              </span>
                            ) : (
                              <span className="badge-amber text-[10px] uppercase font-bold tracking-wider py-0.5 px-2">
                                Unmapped
                              </span>
                            )
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
