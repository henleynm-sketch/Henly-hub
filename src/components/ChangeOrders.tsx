"use client";

import { useState, useTransition, type FormEvent } from "react";
import { formatMoney, formatRelative } from "@/lib/utils";

export type ChangeOrderItem = {
  id: string;
  number: string;
  title: string;
  description: string | null;
  status: string;
  amountCents: number;
  clientVisible: boolean;
  decidedByName: string | null;
  decidedAt: Date | string | null;
  createdByName: string;
  createdAt: Date | string;
};

type ActionResult = { ok: boolean; error?: string };
type Action = (formData: FormData) => Promise<ActionResult>;

function statusBadge(s: string) {
  if (s === "APPROVED") return "hh-badge hh-badge--success";
  if (s === "DECLINED") return "hh-badge hh-badge--danger";
  if (s === "SENT") return "hh-badge hh-badge--warning";
  return "hh-badge"; // DRAFT
}

function amountLabel(cents: number) {
  return `${cents < 0 ? "−" : "+"}${formatMoney(Math.abs(cents))}`;
}

export default function ChangeOrders({
  projectId,
  items,
  canManage,
  canDecide,
  createAction,
  sendAction,
  approveAction,
  declineAction,
}: {
  projectId: string;
  items: ChangeOrderItem[];
  canManage: boolean;
  canDecide: boolean;
  createAction: Action;
  sendAction: Action;
  approveAction: Action;
  declineAction: Action;
}) {
  const [isPending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  function runRow(id: string, action: Action, extra: Record<string, string> = {}) {
    setError(null);
    setBusyId(id);
    const fd = new FormData();
    fd.set("id", id);
    fd.set("projectId", projectId);
    for (const [k, v] of Object.entries(extra)) fd.set(k, v);
    startTransition(async () => {
      const res = await action(fd);
      setBusyId(null);
      if (!res.ok) setError(res.error ?? "Something went wrong");
    });
  }

  function onCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreateError(null);
    const form = e.currentTarget;
    const fd = new FormData(form);
    fd.set("projectId", projectId);
    startTransition(async () => {
      const res = await createAction(fd);
      if (!res.ok) {
        setCreateError(res.error ?? "Something went wrong");
      } else {
        form.reset();
      }
    });
  }

  return (
    <section className="hh-panel p-6 flex flex-col gap-4">
      <div className="flex items-center justify-between pb-1">
        <h2 className="hh-label">Change orders</h2>
        <span className="hh-secondary">{items.length}</span>
      </div>

      {canManage && (
        <form onSubmit={onCreate} className="grid gap-3 md:grid-cols-12 md:items-end">
          <div className="md:col-span-5">
            <label className="hh-label block mb-1.5">Title</label>
            <input name="title" className="input" placeholder="e.g. Add pantry door header" required />
          </div>
          <div className="md:col-span-3">
            <label className="hh-label block mb-1.5">Amount ($)</label>
            <input name="amount" type="number" step="0.01" className="input" placeholder="0.00" required />
          </div>
          <div className="md:col-span-4">
            <label className="hh-label block mb-1.5">Description</label>
            <input name="description" className="input" placeholder="Optional detail for the client" />
          </div>
          <div className="md:col-span-8 flex items-center gap-2">
            <input type="checkbox" name="clientVisible" id="co-client-visible" defaultChecked />
            <label htmlFor="co-client-visible" className="hh-secondary cursor-pointer select-none">
              Visible to client
            </label>
          </div>
          <div className="md:col-span-4">
            <button className="btn btn-primary w-full justify-center" type="submit" disabled={isPending}>
              {isPending ? "Saving…" : "Create change order"}
            </button>
          </div>
          {createError && (
            <p className="md:col-span-12 text-status-error text-sm" role="alert">{createError}</p>
          )}
        </form>
      )}

      {error && <p className="text-status-error text-sm" role="alert">{error}</p>}

      {items.length === 0 ? (
        <p className="hh-secondary">
          {canManage ? "No change orders yet. Create one above." : "No change orders to review."}
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((co) => {
            const rowBusy = isPending && busyId === co.id;
            return (
              <li key={co.id} className="hh-row flex-col !items-stretch !gap-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="hh-primary truncate">
                      <span className="hh-chip mr-2">{co.number}</span>
                      {co.title}
                    </div>
                    {co.description && <div className="hh-secondary mt-0.5">{co.description}</div>}
                    <div className="hh-caption mt-1">
                      {co.createdByName} · {formatRelative(co.createdAt)}
                      {!co.clientVisible && canManage ? " · internal only" : ""}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className={`font-semibold ${co.amountCents < 0 ? "text-status-success" : "hh-primary"}`}>
                      {amountLabel(co.amountCents)}
                    </div>
                    <span className={`${statusBadge(co.status)} mt-1`}>{co.status.toLowerCase()}</span>
                  </div>
                </div>

                {(co.status === "APPROVED" || co.status === "DECLINED") && (
                  <div className="hh-caption">
                    {co.status === "APPROVED" ? "Approved" : "Declined"}
                    {co.decidedByName ? ` by ${co.decidedByName}` : ""}
                    {co.decidedAt ? ` · ${formatRelative(co.decidedAt)}` : ""}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  {canManage && co.status === "DRAFT" && (
                    <button
                      className="btn btn-secondary text-xs"
                      disabled={rowBusy}
                      onClick={() => runRow(co.id, sendAction)}
                    >
                      {rowBusy ? "Sending…" : "Send to client"}
                    </button>
                  )}
                  {canDecide && co.status === "SENT" && (
                    <>
                      <button
                        className="btn btn-primary text-xs"
                        disabled={rowBusy}
                        onClick={() => runRow(co.id, approveAction)}
                      >
                        {rowBusy ? "Working…" : "Approve"}
                      </button>
                      <button
                        className="btn btn-destructive text-xs"
                        disabled={rowBusy}
                        onClick={() => runRow(co.id, declineAction)}
                      >
                        Decline
                      </button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
