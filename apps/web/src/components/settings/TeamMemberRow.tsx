"use client";

import { useState } from "react";
import { ROLE_LABELS, PENDING_ROLE, type Role } from "@/lib/roles";

type Opt = { id: string; name: string };

// One Team & Access row. "Edit" expands a full-width editor row *beneath* the
// member (colSpan across the table) instead of an off-canvas flyout in the
// narrow Actions cell — so Save/Deactivate are never clipped by the table's
// horizontal-scroll container. Save/Deactivate behaviour is unchanged; the two
// server actions are passed in from the (CEO-gated) settings page.
export default function TeamMemberRow({
  user,
  departments,
  peers,
  isCeo,
  colSpan,
  updateAction,
  toggleAction,
}: {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    department: string | null;
    focusArea: string | null;
    reportsToId: string | null;
    reportsToName: string | null;
    active: boolean;
  };
  departments: Opt[];
  peers: Opt[];
  isCeo: boolean;
  colSpan: number;
  updateAction: (formData: FormData) => void | Promise<void>;
  toggleAction: (formData: FormData) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <tr className="hh-row--flat align-top">
        <td className="px-3 py-3">
          <div className="hh-primary">{user.name}</div>
          <div className="hh-secondary">{user.email}</div>
        </td>
        <td className="px-3 py-3">
          {user.role === PENDING_ROLE ? (
            <span className="hh-badge hh-badge--warning !ml-0">Pending</span>
          ) : (
            <span className="hh-secondary">{ROLE_LABELS[user.role as Role] ?? user.role}</span>
          )}
        </td>
        <td className="px-3 py-3 hh-secondary">{user.department ?? user.focusArea ?? "—"}</td>
        <td className="px-3 py-3 hh-secondary">{user.reportsToName ?? "—"}</td>
        <td className="px-3 py-3">
          {user.active ? (
            <span className="hh-badge hh-badge--success !ml-0">active</span>
          ) : (
            <span className="hh-badge hh-badge--danger !ml-0">inactive</span>
          )}
        </td>
        {isCeo && (
          <td className="px-3 py-3 text-right">
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              className="btn-ghost text-xs"
              aria-expanded={open}
            >
              {open ? "Close" : "Edit"}
            </button>
          </td>
        )}
      </tr>

      {isCeo && open && (
        <tr className="hh-row--flat">
          <td colSpan={colSpan} className="px-3 pb-4">
            <div className="hh-panel p-4 flex flex-col gap-3">
              <form action={updateAction} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 sm:items-end">
                <input type="hidden" name="id" value={user.id} />
                <div className="flex flex-col gap-1">
                  <label className="hh-label">Role</label>
                  <select name="role" className="input" defaultValue={user.role}>
                    {user.role === PENDING_ROLE && (
                      <option value={PENDING_ROLE}>Pending — assign a role</option>
                    )}
                    {Object.keys(ROLE_LABELS).map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABELS[r as Role]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="hh-label">Department</label>
                  <select name="department" className="input" defaultValue={user.department ?? ""}>
                    <option value="">No department</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.name}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="hh-label">Reports to</label>
                  <select name="reportsTo" className="input" defaultValue={user.reportsToId ?? ""}>
                    <option value="">Reports to no one</option>
                    {peers
                      .filter((x) => x.id !== user.id)
                      .map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.name}
                        </option>
                      ))}
                  </select>
                </div>
                <div className="flex items-end">
                  <button className="btn-secondary w-full sm:w-auto" type="submit">
                    Save
                  </button>
                </div>
              </form>
              <form action={toggleAction}>
                <input type="hidden" name="id" value={user.id} />
                <button className="btn-ghost text-xs" type="submit">
                  {user.active ? "Deactivate" : "Reactivate"}
                </button>
              </form>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
