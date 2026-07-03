"use client";

import { useState, useTransition } from "react";
import { Loader2, RefreshCw, Trash2, UserPlus } from "lucide-react";
import { inviteUser, resendInvite, revokeInvite } from "@/lib/actions/auth";

export type InviteRow = {
  id: string;
  email: string;
  role: string;
  createdAt: string;
  expiresAt: string;
  acceptedAt: string | null;
  expired: boolean;
};

export default function InvitePanel({
  roles,
  invites,
}: {
  roles: { value: string; label: string }[];
  invites: InviteRow[];
}) {
  const [pending, start] = useTransition();
  const [toast, setToast] = useState<string | null>(null);

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 6000);
  }

  function onInvite(fd: FormData) {
    start(async () => {
      const r = await inviteUser(fd);
      flash(r.ok ? "Invite sent from hello@ — valid 7 days" : r.error ?? "Invite failed");
    });
  }

  return (
    <div className="flex flex-col gap-3 border-t border-glass-border pt-4">
      <h3 className="hh-label">Invite by email</h3>
      <form action={onInvite} className="flex flex-wrap items-end gap-2">
        <div className="flex-1 min-w-52">
          <label className="hh-label block mb-1.5">Email</label>
          <input name="email" type="email" className="input" placeholder="name@company.com" required />
        </div>
        <div>
          <label className="hh-label block mb-1.5">Role</label>
          <select name="role" className="input" defaultValue="FIELD">
            {roles.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
        <button className="btn-primary text-xs inline-flex items-center gap-1.5" disabled={pending}>
          {pending ? <Loader2 size={13} className="animate-spin" /> : <UserPlus size={13} />}
          Send invite
        </button>
      </form>
      {toast && (
        <div className="flex items-center gap-2">
          <span className="hh-dot hh-dot--green" />
          <span className="hh-secondary">{toast}</span>
        </div>
      )}

      {invites.length > 0 && (
        <div className="flex flex-col gap-1">
          <h3 className="hh-label">Pending &amp; recent invites</h3>
          {invites.map((i) => (
            <div key={i.id} className="hh-row hh-row--flat">
              <span className="hh-primary flex-1 min-w-0 truncate">{i.email}</span>
              <span className="hh-badge">{i.role}</span>
              {i.acceptedAt ? (
                <span className="hh-badge hh-badge--success">accepted</span>
              ) : i.expired ? (
                <span className="hh-badge hh-badge--danger">expired</span>
              ) : (
                <span className="hh-badge hh-badge--warning">pending</span>
              )}
              {!i.acceptedAt && (
                <>
                  <button
                    className="btn-ghost !p-1.5"
                    title="Resend (new link, old one revoked)"
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        const r = await resendInvite(i.id);
                        flash(r.ok ? `Re-sent to ${i.email}` : r.error ?? "Failed");
                      })
                    }
                  >
                    <RefreshCw size={13} />
                  </button>
                  <button
                    className="btn-ghost !p-1.5"
                    title="Revoke"
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        const r = await revokeInvite(i.id);
                        flash(r.ok ? "Invite revoked" : r.error ?? "Failed");
                      })
                    }
                  >
                    <Trash2 size={13} />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
