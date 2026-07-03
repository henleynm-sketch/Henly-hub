"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Copy, ExternalLink, Loader2, MapPin } from "lucide-react";
import { geocodeProject, setProjectTaxRate } from "@/lib/actions/location";

export type LocationCardData = {
  projectId: string;
  address: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  taxRateBps: number;
  mapsUrl: string;
  osmEmbedUrl: string | null; // null when no coords
};

export default function LocationCard({ data, canEdit }: { data: LocationCardData; canEdit: boolean }) {
  const [pending, start] = useTransition();
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingTax, setEditingTax] = useState(false);

  const fullAddress = [data.address, data.city].filter(Boolean).join(", ");

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }

  function onLocate() {
    setError(null);
    start(async () => {
      const r = await geocodeProject(data.projectId);
      if (!r.ok) setError(r.error ?? "Could not locate");
      else flash("Pin placed");
    });
  }

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(fullAddress);
      flash("Address copied");
    } catch {
      flash("Copy failed");
    }
  }

  function onTaxSave(formData: FormData) {
    setError(null);
    const pct = parseFloat(String(formData.get("taxRate") || ""));
    start(async () => {
      const r = await setProjectTaxRate(data.projectId, pct);
      if (!r.ok) setError(r.error ?? "Could not save tax rate");
      else {
        setEditingTax(false);
        flash("Tax rate saved");
      }
    });
  }

  return (
    <section className="hh-panel p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="hh-label">Location</h2>
        <div className="flex items-center gap-2">
          {editingTax && canEdit ? (
            <form action={onTaxSave} className="flex items-center gap-1">
              <input
                name="taxRate"
                type="number"
                step="0.01"
                min="0"
                max="30"
                defaultValue={(data.taxRateBps / 100).toFixed(2).replace(/\.?0+$/, "")}
                className="input !w-20 text-xs text-right"
                autoFocus
              />
              <button className="btn-primary text-xs" disabled={pending}>
                Save
              </button>
              <button type="button" className="btn-ghost text-xs" onClick={() => setEditingTax(false)}>
                ×
              </button>
            </form>
          ) : (
            <button
              className="hh-badge"
              title={canEdit ? "Edit tax rate" : undefined}
              onClick={() => canEdit && setEditingTax(true)}
            >
              Tax Rate {(data.taxRateBps / 100).toFixed(2).replace(/\.?0+$/, "")}%
            </button>
          )}
        </div>
      </div>

      {!fullAddress ? (
        <div className="flex flex-col items-start gap-2">
          <span className="hh-secondary">No address on this job yet.</span>
          <Link href={`/projects/${data.projectId}`} className="btn-secondary text-xs">
            Add an address
          </Link>
        </div>
      ) : (
        <>
          {data.osmEmbedUrl ? (
            <iframe
              src={data.osmEmbedUrl}
              title={`Map of ${fullAddress}`}
              loading="lazy"
              className="w-full rounded-xl border border-glass-border"
              style={{ height: 220 }}
            />
          ) : (
            <button
              className="btn-secondary text-xs inline-flex items-center gap-1.5 self-start"
              disabled={pending || !canEdit}
              onClick={onLocate}
              title={canEdit ? undefined : "CEO/Office can place the pin"}
            >
              {pending ? <Loader2 size={13} className="animate-spin" /> : <MapPin size={13} />}
              Locate on map
            </button>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <span className="hh-secondary flex-1 min-w-0 truncate" title={fullAddress}>
              {fullAddress}
            </span>
            <button className="btn-ghost !p-1.5" aria-label="Copy address" onClick={onCopy}>
              <Copy size={13} />
            </button>
            <a
              href={data.mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary text-xs inline-flex items-center gap-1"
            >
              <ExternalLink size={12} />
              Google Maps
            </a>
          </div>
        </>
      )}

      {toast && (
        <div className="flex items-center gap-2">
          <span className="hh-dot hh-dot--green" />
          <span className="hh-secondary">{toast}</span>
        </div>
      )}
      {error && (
        <div className="flex items-start gap-2">
          <span className="hh-dot hh-dot--red mt-1" />
          <span className="hh-secondary break-all">{error}</span>
        </div>
      )}
    </section>
  );
}
