"use client";

import { useRef, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { addEstimateLine } from "@/lib/actions/catalog";

export type PickerItem = {
  id: string;
  name: string;
  description: string | null;
  unit: string | null;
  unitPriceCents: number;
  codeNumber: string | null;
};

// Additive line editor for draft estimates: pick a catalog item to prefill
// description/unit price (stamping costItemId on the line), or type a manual
// free-text line exactly as before.
export default function AddLineForm({
  estimateId,
  items,
}: {
  estimateId: string;
  items: PickerItem[];
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<string>("");
  const descRef = useRef<HTMLInputElement>(null);
  const unitRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function onPick(id: string) {
    setPicked(id);
    const item = items.find((i) => i.id === id);
    if (!item) return;
    if (descRef.current) {
      descRef.current.value = item.description
        ? `${item.name} — ${item.description}`
        : item.name;
    }
    if (unitRef.current && item.unitPriceCents > 0) {
      unitRef.current.value = (item.unitPriceCents / 100).toFixed(2);
    }
  }

  function onSubmit(fd: FormData) {
    setError(null);
    start(async () => {
      const r = await addEstimateLine(estimateId, fd);
      if (!r.ok) {
        setError(r.error ?? "Could not add line");
        return;
      }
      formRef.current?.reset();
      setPicked("");
    });
  }

  return (
    <form ref={formRef} action={onSubmit} className="border-t border-glass-border px-6 py-4 flex flex-col gap-2">
      <span className="hh-label">Add line</span>
      <div className="flex flex-wrap gap-2 items-end">
        <div className="min-w-56">
          <label className="hh-caption block mb-1">From catalog (optional)</label>
          <select
            name="costItemId"
            className="input text-sm"
            value={picked}
            onChange={(e) => onPick(e.target.value)}
          >
            <option value="">— manual line —</option>
            {items.map((i) => (
              <option key={i.id} value={i.id}>
                {i.codeNumber ? `${i.codeNumber} · ` : ""}{i.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1 min-w-48">
          <label className="hh-caption block mb-1">Description</label>
          <input ref={descRef} name="description" className="input text-sm" required />
        </div>
        <div className="w-20">
          <label className="hh-caption block mb-1">Qty</label>
          <input name="quantity" type="number" step="0.5" defaultValue={1} className="input text-sm text-right" />
        </div>
        <div className="w-28">
          <label className="hh-caption block mb-1">Unit ($)</label>
          <input ref={unitRef} name="unit" type="number" step="0.01" className="input text-sm text-right" required />
        </div>
        <button className="btn-primary text-xs inline-flex items-center gap-1.5" disabled={pending}>
          {pending && <Loader2 size={12} className="animate-spin" />}
          Add
        </button>
      </div>
      {error && (
        <div className="flex items-center gap-2">
          <span className="hh-dot hh-dot--red" />
          <span className="hh-secondary">{error}</span>
        </div>
      )}
    </form>
  );
}
