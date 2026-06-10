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
        return "hh-badge";
      case "OFFICE":
        return "hh-badge";
      case "FIELD":
        return "hh-badge hh-badge--warning";
      case "SUB":
        return "hh-badge";
      default:
        return "hh-badge";
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
            className="input pl-9 pr-4 py-2"
          />
        </div>

        {/* Tab Filters */}
        <div className="flex gap-2">
          <button
            onClick={() => setFilterType("all")}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider transition-all border ${
              filterType === "all"
                ? "border-accent bg-accent/10 text-accent"
                : "bg-row-bg text-ink-soft border-glass-border hover:bg-row-hover hover:text-ink"
            }`}
          >
            All ({users.length})
          </button>
          <button
            onClick={() => setFilterType("mapped")}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider transition-all border flex items-center gap-1.5 ${
              filterType === "mapped"
                ? "border-accent bg-accent/10 text-accent"
                : "bg-row-bg text-ink-soft border-glass-border hover:bg-row-hover hover:text-ink"
            }`}
          >
            <UserCheck className="h-3 w-3" />
            Mapped ({Object.values(localMappings).filter(Boolean).length})
          </button>
          <button
            onClick={() => setFilterType("unmapped")}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider transition-all border flex items-center gap-1.5 ${
              filterType === "unmapped"
                ? "border-accent bg-accent/10 text-accent"
                : "bg-row-bg text-ink-soft border-glass-border hover:bg-row-hover hover:text-ink"
            }`}
          >
            <UserMinus className="h-3 w-3" />
            Unmapped ({users.length - Object.values(localMappings).filter(Boolean).length})
          </button>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="hh-panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b border-glass-border">
              <tr>
                <th className="hh-label px-6 py-4 text-left">User Profile</th>
                <th className="hh-label px-6 py-4 text-left">Role</th>
                <th className="hh-label px-6 py-4 text-left">QuickBooks Employee Mapping</th>
                <th className="hh-label px-6 py-4 text-left">Sync Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-glass-border">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <HelpCircle className="h-8 w-8 text-ink-muted" />
                      <p className="hh-primary">No users match your criteria.</p>
                      <p className="hh-secondary">Try adjusting your search query or filter type.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const state = savingStates[user.id] || "idle";
                  const mappedId = localMappings[user.id];
                  const isMapped = !!mappedId;

                  return (
                    <tr key={user.id} className="hh-row--flat">
                      {/* Profile Column */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent font-semibold text-sm">
                            {getInitials(user.name)}
                          </div>
                          <div>
                            <p className="hh-primary leading-tight">{user.name || "Unnamed User"}</p>
                            <p className="hh-secondary mt-0.5">{user.email}</p>
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
                              backgroundColor: "var(--panel-bg)",
                              color: "var(--text-primary)"
                            }}
                            className="w-full rounded-lg px-3 py-1.5 text-sm bg-row-bg border border-glass-border text-ink hover:bg-row-hover focus:outline-none focus:border-accent/45 focus:ring-2 focus:ring-accent/10 transition cursor-pointer disabled:opacity-50"
                          >
                            <option value="" style={{ backgroundColor: "var(--panel-bg)", color: "var(--text-primary)" }}>
                              — Unmapped (Will block on approval) —
                            </option>
                            {employees.map((emp) => (
                              <option
                                key={emp.id}
                                value={emp.id}
                                style={{ backgroundColor: "var(--panel-bg)", color: "var(--text-primary)" }}
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
                            <span className="hh-caption flex items-center gap-1.5">
                              <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" />
                              Saving...
                            </span>
                          )}
                          {state === "saved" && (
                            <span className="text-xs text-status-success flex items-center gap-1.5 font-medium animate-fadeIn">
                              <CheckCircle2 className="h-4 w-4 text-status-success shrink-0" />
                              Saved!
                            </span>
                          )}
                          {state === "error" && (
                            <span
                              className="text-xs text-status-error flex items-center gap-1.5 font-medium cursor-help"
                              title={errorMessages[user.id] || "Failed to save mapping."}
                            >
                              <AlertCircle className="h-4 w-4 text-status-error shrink-0" />
                              Error
                            </span>
                          )}
                          {state === "idle" && (
                            isMapped ? (
                              <span className="hh-badge hh-badge--success !ml-0">
                                Mapped
                              </span>
                            ) : (
                              <span className="hh-badge hh-badge--warning !ml-0">
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
