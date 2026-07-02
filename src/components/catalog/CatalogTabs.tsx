"use client";

import { useMemo, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { Loader2, Pencil, Plus, Search } from "lucide-react";
import { cn, formatMoney } from "@/lib/utils";
import { saveCostItem, saveCostCode, saveCostType } from "@/lib/actions/catalog";

export type CatalogItem = {
  id: string;
  name: string;
  description: string | null;
  unit: string | null;
  unitCostCents: number;
  unitPriceCents: number;
  taxable: boolean;
  active: boolean;
  costTypeId: string | null;
  costCodeId: string | null;
};
export type CatalogCode = {
  id: string;
  number: string;
  name: string;
  parentId: string | null;
  active: boolean;
};
export type CatalogType = {
  id: string;
  name: string;
  defaultMarginPct: number;
  defaultMarkupPct: number;
  taxable: boolean;
};

type Tab = "items" | "codes" | "types";
type SheetState =
  | { kind: "item"; row: CatalogItem | null }
  | { kind: "code"; row: CatalogCode | null }
  | { kind: "type"; row: CatalogType | null }
  | null;

const bpsToPct = (bps: number) => (bps / 100).toFixed(2).replace(/\.?0+$/, "");

export default function CatalogTabs({
  items,
  codes,
  types,
  canEdit,
}: {
  items: CatalogItem[];
  codes: CatalogCode[];
  types: CatalogType[];
  canEdit: boolean;
}) {
  const [tab, setTab] = useState<Tab>("items");
  const [search, setSearch] = useState("");
  const [sheet, setSheet] = useState<SheetState>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const codeById = useMemo(() => new Map(codes.map((c) => [c.id, c])), [codes]);
  const typeById = useMemo(() => new Map(types.map((t) => [t.id, t])), [types]);

  const q = search.trim().toLowerCase();
  const fItems = useMemo(
    () =>
      items.filter(
        (i) =>
          !q ||
          i.name.toLowerCase().includes(q) ||
          (i.description ?? "").toLowerCase().includes(q) ||
          (codeById.get(i.costCodeId ?? "")?.number ?? "").toLowerCase().includes(q),
      ),
    [items, q, codeById],
  );
  const fCodes = useMemo(
    () => codes.filter((c) => !q || c.name.toLowerCase().includes(q) || c.number.toLowerCase().includes(q)),
    [codes, q],
  );
  const fTypes = useMemo(() => types.filter((t) => !q || t.name.toLowerCase().includes(q)), [types, q]);

  function submit(action: (fd: FormData) => Promise<{ ok: boolean; error?: string }>) {
    return (fd: FormData) => {
      setError(null);
      start(async () => {
        const r = await action(fd);
        if (!r.ok) setError(r.error ?? "Save failed");
        else setSheet(null);
      });
    };
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {(["items", "codes", "types"] as Tab[]).map((t) => (
          <button
            key={t}
            className={cn("btn-secondary text-xs capitalize", tab === t && "!bg-accent !text-white")}
            onClick={() => setTab(t)}
          >
            Cost {t} ({t === "items" ? items.length : t === "codes" ? codes.length : types.length})
          </button>
        ))}
        <div className="relative flex-1 max-w-xs ml-2">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 opacity-50" />
          <input
            className="input !pl-8 text-sm"
            placeholder="Search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {canEdit && (
          <button
            className="btn-primary text-xs ml-auto inline-flex items-center gap-1"
            onClick={() =>
              setSheet(
                tab === "items"
                  ? { kind: "item", row: null }
                  : tab === "codes"
                  ? { kind: "code", row: null }
                  : { kind: "type", row: null },
              )
            }
          >
            <Plus size={13} /> New
          </button>
        )}
      </div>

      <div className="hh-panel overflow-x-auto !p-0">
        {tab === "items" && (
          <table className="min-w-full text-sm">
            <thead className="border-b border-glass-border">
              <tr>
                <th className="hh-label px-5 py-3 text-left">Name</th>
                <th className="hh-label px-5 py-3 text-left">Code</th>
                <th className="hh-label px-5 py-3 text-left">Type</th>
                <th className="hh-label px-5 py-3 text-left">Unit</th>
                <th className="hh-label px-5 py-3 text-right">Unit cost</th>
                <th className="hh-label px-5 py-3 text-right">Unit price</th>
                {canEdit && <th className="px-2" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-glass-border">
              {fItems.map((i) => (
                <tr key={i.id} className={cn("hh-row--flat", !i.active && "opacity-50")}>
                  <td className="px-5 py-3 hh-primary">
                    {i.name}
                    {i.description && <div className="hh-caption line-clamp-1">{i.description}</div>}
                  </td>
                  <td className="px-5 py-3 hh-secondary">{codeById.get(i.costCodeId ?? "")?.number ?? "—"}</td>
                  <td className="px-5 py-3 hh-secondary">{typeById.get(i.costTypeId ?? "")?.name ?? "—"}</td>
                  <td className="px-5 py-3 hh-secondary">{i.unit ?? "—"}</td>
                  <td className="px-5 py-3 text-right hh-secondary tabular-nums">{formatMoney(i.unitCostCents)}</td>
                  <td className="px-5 py-3 text-right hh-primary tabular-nums">{formatMoney(i.unitPriceCents)}</td>
                  {canEdit && (
                    <td className="px-2 py-3">
                      <button className="btn-ghost !p-1.5" aria-label={`Edit ${i.name}`} onClick={() => setSheet({ kind: "item", row: i })}>
                        <Pencil size={13} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {fItems.length === 0 && (
                <tr><td colSpan={7} className="px-5 py-6 hh-secondary">No cost items{q ? " match" : " yet — run a sync or add one"}.</td></tr>
              )}
            </tbody>
          </table>
        )}

        {tab === "codes" && (
          <table className="min-w-full text-sm">
            <thead className="border-b border-glass-border">
              <tr>
                <th className="hh-label px-5 py-3 text-left">Number</th>
                <th className="hh-label px-5 py-3 text-left">Name</th>
                <th className="hh-label px-5 py-3 text-left">Parent</th>
                {canEdit && <th className="px-2" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-glass-border">
              {fCodes.map((c) => (
                <tr key={c.id} className="hh-row--flat">
                  <td className="px-5 py-3 hh-primary tabular-nums">{c.number}</td>
                  <td className="px-5 py-3 hh-secondary">{c.name}</td>
                  <td className="px-5 py-3 hh-secondary tabular-nums">
                    {c.parentId ? codeById.get(c.parentId)?.number ?? "—" : "—"}
                  </td>
                  {canEdit && (
                    <td className="px-2 py-3">
                      <button className="btn-ghost !p-1.5" aria-label={`Edit ${c.number}`} onClick={() => setSheet({ kind: "code", row: c })}>
                        <Pencil size={13} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {fCodes.length === 0 && (
                <tr><td colSpan={4} className="px-5 py-6 hh-secondary">No cost codes{q ? " match" : " yet — run a sync"}.</td></tr>
              )}
            </tbody>
          </table>
        )}

        {tab === "types" && (
          <table className="min-w-full text-sm">
            <thead className="border-b border-glass-border">
              <tr>
                <th className="hh-label px-5 py-3 text-left">Name</th>
                <th className="hh-label px-5 py-3 text-right">Margin %</th>
                <th className="hh-label px-5 py-3 text-right">Markup %</th>
                <th className="hh-label px-5 py-3 text-left">Taxable</th>
                {canEdit && <th className="px-2" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-glass-border">
              {fTypes.map((t) => (
                <tr key={t.id} className="hh-row--flat">
                  <td className="px-5 py-3 hh-primary">{t.name}</td>
                  <td className="px-5 py-3 text-right hh-secondary tabular-nums">{bpsToPct(t.defaultMarginPct)}</td>
                  <td className="px-5 py-3 text-right hh-secondary tabular-nums">{bpsToPct(t.defaultMarkupPct)}</td>
                  <td className="px-5 py-3 hh-secondary">{t.taxable ? "Yes" : "No"}</td>
                  {canEdit && (
                    <td className="px-2 py-3">
                      <button className="btn-ghost !p-1.5" aria-label={`Edit ${t.name}`} onClick={() => setSheet({ kind: "type", row: t })}>
                        <Pencil size={13} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Edit / create sheet */}
      {sheet &&
        createPortal(
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/55" onClick={() => setSheet(null)} />
            <div className="hh-panel relative w-full max-w-md max-h-[92vh] overflow-y-auto">
              <h3 className="hh-label">
                {sheet.row ? "Edit" : "New"} cost {sheet.kind}
              </h3>

              {sheet.kind === "item" && (
                <form action={submit(saveCostItem)} className="mt-3 flex flex-col gap-3">
                  <input type="hidden" name="id" value={sheet.row?.id ?? ""} />
                  <div>
                    <label className="hh-label block mb-1.5">Name</label>
                    <input name="name" className="input" defaultValue={sheet.row?.name ?? ""} required />
                  </div>
                  <div>
                    <label className="hh-label block mb-1.5">Description</label>
                    <textarea name="description" rows={2} className="input" defaultValue={sheet.row?.description ?? ""} />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="hh-label block mb-1.5">Unit</label>
                      <input name="unit" className="input" defaultValue={sheet.row?.unit ?? ""} placeholder="Each" />
                    </div>
                    <div>
                      <label className="hh-label block mb-1.5">Unit cost ($)</label>
                      <input name="unitCost" type="number" step="0.01" className="input text-right" defaultValue={sheet.row ? (sheet.row.unitCostCents / 100).toFixed(2) : ""} />
                    </div>
                    <div>
                      <label className="hh-label block mb-1.5">Unit price ($)</label>
                      <input name="unitPrice" type="number" step="0.01" className="input text-right" defaultValue={sheet.row ? (sheet.row.unitPriceCents / 100).toFixed(2) : ""} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="hh-label block mb-1.5">Cost type</label>
                      <select name="costTypeId" className="input" defaultValue={sheet.row?.costTypeId ?? ""}>
                        <option value="">—</option>
                        {types.map((t) => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="hh-label block mb-1.5">Cost code</label>
                      <select name="costCodeId" className="input" defaultValue={sheet.row?.costCodeId ?? ""}>
                        <option value="">—</option>
                        {codes.map((c) => (
                          <option key={c.id} value={c.id}>{c.number} · {c.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <label className="flex items-center gap-2 hh-secondary">
                    <input type="checkbox" name="taxable" defaultChecked={sheet.row?.taxable ?? false} /> Taxable
                  </label>
                  <SheetFooter pending={pending} error={error} onCancel={() => setSheet(null)} />
                </form>
              )}

              {sheet.kind === "code" && (
                <form action={submit(saveCostCode)} className="mt-3 flex flex-col gap-3">
                  <input type="hidden" name="id" value={sheet.row?.id ?? ""} />
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="hh-label block mb-1.5">Number</label>
                      <input name="number" className="input" defaultValue={sheet.row?.number ?? ""} required />
                    </div>
                    <div>
                      <label className="hh-label block mb-1.5">Name</label>
                      <input name="name" className="input" defaultValue={sheet.row?.name ?? ""} required />
                    </div>
                  </div>
                  <div>
                    <label className="hh-label block mb-1.5">Parent code</label>
                    <select name="parentId" className="input" defaultValue={sheet.row?.parentId ?? ""}>
                      <option value="">— top level —</option>
                      {codes
                        .filter((c) => c.id !== sheet.row?.id)
                        .map((c) => (
                          <option key={c.id} value={c.id}>{c.number} · {c.name}</option>
                        ))}
                    </select>
                  </div>
                  <SheetFooter pending={pending} error={error} onCancel={() => setSheet(null)} />
                </form>
              )}

              {sheet.kind === "type" && (
                <form action={submit(saveCostType)} className="mt-3 flex flex-col gap-3">
                  <input type="hidden" name="id" value={sheet.row?.id ?? ""} />
                  <div>
                    <label className="hh-label block mb-1.5">Name</label>
                    <input name="name" className="input" defaultValue={sheet.row?.name ?? ""} required />
                  </div>
                  <div>
                    <label className="hh-label block mb-1.5">Default margin (%)</label>
                    <input
                      name="marginPct"
                      type="number"
                      step="0.01"
                      className="input text-right"
                      defaultValue={sheet.row ? bpsToPct(sheet.row.defaultMarginPct) : "0"}
                    />
                    <p className="hh-caption mt-1">Markup is derived: margin ÷ (1 − margin).</p>
                  </div>
                  <label className="flex items-center gap-2 hh-secondary">
                    <input type="checkbox" name="taxable" defaultChecked={sheet.row?.taxable ?? false} /> Taxable
                  </label>
                  <SheetFooter pending={pending} error={error} onCancel={() => setSheet(null)} />
                </form>
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

function SheetFooter({
  pending,
  error,
  onCancel,
}: {
  pending: boolean;
  error: string | null;
  onCancel: () => void;
}) {
  return (
    <>
      {error && (
        <div className="flex items-center gap-2">
          <span className="hh-dot hh-dot--red" />
          <span className="hh-secondary">{error}</span>
        </div>
      )}
      <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end mt-1">
        <button type="button" className="btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn-primary inline-flex items-center gap-1.5" disabled={pending}>
          {pending && <Loader2 size={14} className="animate-spin" />}
          Save
        </button>
      </div>
    </>
  );
}
