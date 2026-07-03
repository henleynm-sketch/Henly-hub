"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, Pencil, Trash2, Check, X, AlertTriangle, CheckCircle2,
  Clock, Search, Filter, Building2,
} from "lucide-react";
import { createVendor, updateVendor, deleteVendor } from "./vendorActions";

// ─── Types ────────────────────────────────────────────────────────────────────

type Vendor = {
  id: string;
  name: string;
  trade: string | null;
  type: string | null;
  email: string | null;
  officePhone: string | null;
  fax: string | null;
  division: string | null;
  w9OnFile: boolean;
  emailOptOut: boolean;
  coiExpiresAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

type Props = {
  vendors: Vendor[];
  vendorTrades: string[];
  vendorTypes: string[];
  divisions: string[];
  complianceSummary: {
    expiredCount: number;
    expiringCount: number;
    missingW9Count: number;
  };
};

// ─── COI status helpers ───────────────────────────────────────────────────────

type CoiStatus = "expired" | "expiring" | "ok" | "none";

function getCoiStatus(coiExpiresAt: string | null): CoiStatus {
  if (!coiExpiresAt) return "none";
  const exp = new Date(coiExpiresAt);
  const now = new Date();
  const days30 = new Date();
  days30.setDate(now.getDate() + 30);
  if (exp < now)    return "expired";
  if (exp <= days30) return "expiring";
  return "ok";
}

function CoiBadge({ coiExpiresAt }: { coiExpiresAt: string | null }) {
  const status = getCoiStatus(coiExpiresAt);
  if (status === "none") {
    return (
      <span className="text-xs text-ink-muted italic">No COI</span>
    );
  }
  const date = new Date(coiExpiresAt!).toLocaleDateString("en-CA");
  const config = {
    expired:  { icon: <AlertTriangle size={11} />, label: `Expired ${date}`,   bg: "rgba(239,68,68,0.10)",   color: "var(--hh-dot-red,#ef4444)",   border: "rgba(239,68,68,0.20)" },
    expiring: { icon: <Clock size={11} />,         label: `Expires ${date}`,   bg: "rgba(234,179,8,0.10)",   color: "var(--hh-dot-yellow,#eab308)", border: "rgba(234,179,8,0.20)" },
    ok:       { icon: <CheckCircle2 size={11} />,  label: `Valid to ${date}`,  bg: "rgba(34,197,94,0.10)",   color: "var(--hh-dot-green,#22c55e)",  border: "rgba(34,197,94,0.20)" },
  }[status];

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
      style={{ background: config.bg, color: config.color, border: `1px solid ${config.border}` }}
    >
      {config.icon}
      {config.label}
    </span>
  );
}

function W9Badge({ onFile }: { onFile: boolean }) {
  return onFile ? (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
      style={{ background: "rgba(34,197,94,0.10)", color: "var(--hh-dot-green,#22c55e)", border: "1px solid rgba(34,197,94,0.20)" }}
    >
      <Check size={10} /> W-9
    </span>
  ) : (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
      style={{ background: "rgba(239,68,68,0.08)", color: "var(--hh-dot-red,#ef4444)", border: "1px solid rgba(239,68,68,0.18)" }}
    >
      <X size={10} /> W-9 missing
    </span>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ msg, ok, onDone }: { msg: string; ok: boolean; onDone: () => void }) {
  return (
    <div
      role="status"
      style={{
        position: "fixed", bottom: 24, right: 24, zIndex: 9999,
        padding: "10px 18px", borderRadius: 8, fontSize: 13, fontWeight: 600, color: "#fff",
        background: ok ? "var(--hh-dot-green,#22c55e)" : "var(--hh-dot-red,#ef4444)",
        boxShadow: "0 4px 16px rgba(0,0,0,0.18)",
      }}
    >
      {msg}
      <button onClick={onDone} style={{ marginLeft: 10, opacity: 0.7 }}>✕</button>
    </div>
  );
}

// ─── Vendor form ──────────────────────────────────────────────────────────────

function VendorForm({
  vendor,
  vendorTrades,
  vendorTypes,
  divisions,
  onSubmit,
  onCancel,
  pending,
}: {
  vendor?: Vendor;
  vendorTrades: string[];
  vendorTypes: string[];
  divisions: string[];
  onSubmit: (fd: FormData) => void;
  onCancel: () => void;
  pending: boolean;
}) {
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onSubmit(new FormData(e.currentTarget)); }}
      className="rounded-xl p-5 space-y-4"
      style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {/* Name */}
        <div className="sm:col-span-2">
          <label className="label text-xs">Vendor name *</label>
          <input className="input mt-0.5 text-sm" name="name" required defaultValue={vendor?.name ?? ""} placeholder="e.g. Smith Electric Ltd." />
        </div>

        {/* Trade */}
        <div>
          <label className="label text-xs">Trade</label>
          <select className="input mt-0.5 text-sm" name="trade" defaultValue={vendor?.trade ?? ""}>
            <option value="">— Select trade —</option>
            {vendorTrades.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        {/* Type */}
        <div>
          <label className="label text-xs">Vendor type</label>
          <select className="input mt-0.5 text-sm" name="type" defaultValue={vendor?.type ?? ""}>
            <option value="">— Select type —</option>
            {vendorTypes.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        {/* Email */}
        <div>
          <label className="label text-xs">Email</label>
          <input className="input mt-0.5 text-sm" name="email" type="email" defaultValue={vendor?.email ?? ""} />
        </div>

        {/* Phone */}
        <div>
          <label className="label text-xs">Office phone</label>
          <input className="input mt-0.5 text-sm" name="officePhone" defaultValue={vendor?.officePhone ?? ""} />
        </div>

        {/* Fax */}
        <div>
          <label className="label text-xs">Fax</label>
          <input className="input mt-0.5 text-sm" name="fax" defaultValue={vendor?.fax ?? ""} />
        </div>

        {/* Division */}
        <div>
          <label className="label text-xs">Division</label>
          <select className="input mt-0.5 text-sm" name="division" defaultValue={vendor?.division ?? ""}>
            <option value="">— Select division —</option>
            {divisions.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>

        {/* COI expiry */}
        <div>
          <label className="label text-xs">COI expires</label>
          <input
            className="input mt-0.5 text-sm"
            name="coiExpiresAt"
            type="date"
            defaultValue={
              vendor?.coiExpiresAt
                ? new Date(vendor.coiExpiresAt).toISOString().slice(0, 10)
                : ""
            }
          />
        </div>

        {/* W-9 on file */}
        <div className="flex items-center gap-2 sm:col-span-2">
          <input
            type="checkbox"
            id="w9OnFile"
            name="w9OnFile"
            value="true"
            defaultChecked={vendor?.w9OnFile ?? false}
            className="rounded"
          />
          <label htmlFor="w9OnFile" className="text-sm text-ink-soft">W-9 on file</label>
        </div>

        {/* Notification email opt-out */}
        <div className="flex items-center gap-2 sm:col-span-2">
          <input
            type="checkbox"
            id="emailOptOut"
            name="emailOptOut"
            value="true"
            defaultChecked={vendor?.emailOptOut ?? false}
            className="rounded"
          />
          <label htmlFor="emailOptOut" className="text-sm text-ink-soft">
            Opt out of notification emails (COI/W-9 reminders, assignments)
          </label>
        </div>

        {/* Notes */}
        <div className="sm:col-span-2">
          <label className="label text-xs">Notes</label>
          <textarea className="input mt-0.5 text-sm" name="notes" rows={2} defaultValue={vendor?.notes ?? ""} />
        </div>
      </div>

      <div className="flex gap-2 justify-end pt-1">
        <button type="button" onClick={onCancel} className="btn-ghost text-sm">Cancel</button>
        <button type="submit" className="btn-primary text-sm" disabled={pending}>
          {pending ? "Saving…" : vendor ? "Save changes" : "Add vendor"}
        </button>
      </div>
    </form>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

type FilterMode = "all" | "expiring" | "expired" | "missing-w9";

export default function VendorsClient({
  vendors,
  vendorTrades,
  vendorTypes,
  divisions,
  complianceSummary,
}: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterMode>("all");
  const [search, setSearch] = useState("");

  function flash(ok: boolean, msg: string) {
    setToast({ ok, msg });
    setTimeout(() => setToast(null), 4000);
  }

  // ── Filtered list ──────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = vendors;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (v) =>
          v.name.toLowerCase().includes(q) ||
          v.trade?.toLowerCase().includes(q) ||
          v.email?.toLowerCase().includes(q)
      );
    }
    if (filter === "expiring") {
      list = list.filter((v) => getCoiStatus(v.coiExpiresAt) === "expiring");
    } else if (filter === "expired") {
      list = list.filter((v) => getCoiStatus(v.coiExpiresAt) === "expired");
    } else if (filter === "missing-w9") {
      list = list.filter((v) => !v.w9OnFile);
    }
    return list;
  }, [vendors, search, filter]);

  // ── Mutations ──────────────────────────────────────────────────────────────
  function handleCreate(fd: FormData) {
    start(async () => {
      const r = await createVendor(fd);
      flash(r.ok, r.ok ? "Vendor added" : (r.error ?? "Failed"));
      if (r.ok) { setShowAdd(false); router.refresh(); }
    });
  }

  function handleUpdate(vendorId: string, fd: FormData) {
    start(async () => {
      const r = await updateVendor(vendorId, fd);
      flash(r.ok, r.ok ? "Saved" : (r.error ?? "Failed"));
      if (r.ok) { setEditId(null); router.refresh(); }
    });
  }

  function handleDelete(vendorId: string, name: string) {
    if (!confirm(`Delete ${name}? This cannot be undone.`)) return;
    start(async () => {
      const r = await deleteVendor(vendorId);
      flash(r.ok, r.ok ? "Vendor deleted" : (r.error ?? "Failed"));
      if (r.ok) router.refresh();
    });
  }

  // ── Compliance banner ──────────────────────────────────────────────────────
  const { expiredCount, expiringCount, missingW9Count } = complianceSummary;
  const hasAlerts = expiredCount > 0 || expiringCount > 0 || missingW9Count > 0;

  return (
    <div className="space-y-5">

      {/* Compliance alert banner */}
      {hasAlerts && (
        <div
          className="rounded-xl p-4 flex flex-wrap gap-4 items-center"
          style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.18)" }}
        >
          <AlertTriangle size={16} style={{ color: "var(--hh-dot-red,#ef4444)" }} className="shrink-0" />
          <span className="text-sm font-semibold" style={{ color: "var(--hh-dot-red,#ef4444)" }}>
            Compliance alerts:
          </span>
          {expiredCount  > 0 && <span className="text-sm text-ink">{expiredCount} COI expired</span>}
          {expiringCount > 0 && <span className="text-sm text-ink">{expiringCount} COI expiring within 30 days</span>}
          {missingW9Count > 0 && <span className="text-sm text-ink">{missingW9Count} missing W-9</span>}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* Search */}
        <div className="relative flex-1 min-w-48">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted" />
          <input
            className="input pl-8 text-sm w-full"
            placeholder="Search vendors…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Filter chips */}
        <div className="flex gap-1 flex-wrap">
          {(
            [
              { key: "all",        label: "All" },
              { key: "expired",    label: `Expired COI${expiredCount  ? ` (${expiredCount})`  : ""}` },
              { key: "expiring",   label: `Expiring soon${expiringCount ? ` (${expiringCount})` : ""}` },
              { key: "missing-w9", label: `Missing W-9${missingW9Count ? ` (${missingW9Count})` : ""}` },
            ] as { key: FilterMode; label: string }[]
          ).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className="text-xs px-3 py-1.5 rounded-full font-medium transition-colors"
              style={{
                background: filter === key ? "var(--accent)" : "var(--glass-bg)",
                color: filter === key ? "#fff" : "var(--ink-soft)",
                border: filter === key ? "none" : "1px solid var(--glass-border)",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Add button */}
        <button onClick={() => setShowAdd((v) => !v)} className="btn-primary text-sm flex items-center gap-1 shrink-0">
          <Plus size={14} /> Add vendor
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <VendorForm
          vendorTrades={vendorTrades}
          vendorTypes={vendorTypes}
          divisions={divisions}
          onSubmit={handleCreate}
          onCancel={() => setShowAdd(false)}
          pending={pending}
        />
      )}

      {/* Vendor list */}
      {filtered.length === 0 ? (
        <div className="py-16 text-center">
          <Building2 size={32} className="mx-auto mb-3 text-ink-muted opacity-40" />
          <p className="text-sm text-ink-muted">
            {search || filter !== "all" ? "No vendors match the current filter." : "No vendors yet — add your first one above."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((vendor) => (
            <div key={vendor.id}>
              {editId === vendor.id ? (
                <VendorForm
                  vendor={vendor}
                  vendorTrades={vendorTrades}
                  vendorTypes={vendorTypes}
                  divisions={divisions}
                  onSubmit={(fd) => handleUpdate(vendor.id, fd)}
                  onCancel={() => setEditId(null)}
                  pending={pending}
                />
              ) : (
                <div
                  className="rounded-xl p-4"
                  style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}
                >
                  <div className="flex items-start justify-between gap-3">
                    {/* Left: name + meta */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-ink">{vendor.name}</span>
                        {vendor.trade && (
                          <span
                            className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                            style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)", color: "var(--ink-soft)" }}
                          >
                            {vendor.trade}
                          </span>
                        )}
                        {vendor.type && (
                          <span
                            className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                            style={{ background: "rgba(92,124,250,0.08)", border: "1px solid rgba(92,124,250,0.18)", color: "var(--accent)" }}
                          >
                            {vendor.type}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5">
                        {vendor.email && (
                          <span className="text-xs text-ink-muted">{vendor.email}</span>
                        )}
                        {vendor.officePhone && (
                          <span className="text-xs text-ink-muted">{vendor.officePhone}</span>
                        )}
                        {vendor.division && (
                          <span className="text-xs text-ink-muted">{vendor.division}</span>
                        )}
                      </div>
                      {/* Compliance badges */}
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        <W9Badge onFile={vendor.w9OnFile} />
                        <CoiBadge coiExpiresAt={vendor.coiExpiresAt} />
                      </div>
                      {vendor.notes && (
                        <p className="text-xs text-ink-muted mt-1.5 line-clamp-1">{vendor.notes}</p>
                      )}
                    </div>

                    {/* Right: actions */}
                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={() => setEditId(vendor.id)}
                        className="p-1.5 rounded text-ink-muted hover:text-ink transition-colors"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(vendor.id, vendor.name)}
                        disabled={pending}
                        className="p-1.5 rounded text-ink-muted hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {toast && <Toast msg={toast.msg} ok={toast.ok} onDone={() => setToast(null)} />}
    </div>
  );
}
