"use client";

/**
 * DailyLogStructuredFields
 *
 * Renders the P7 structured fields added to DailyLog:
 *   anticipatedDelays, materialDeliveries, safetyIncidents,
 *   tradesOnsite, unplannedTasks, internalNotes
 *
 * Props:
 *   mode="form"  — renders editable inputs (use inside <form>)
 *   mode="view"  — renders read-only display of saved values
 *   isClientView — when true, internalNotes is fully omitted
 *   defaultValues — pre-fills form fields when editing an existing log
 *   values — the saved values used in view mode
 */

export type DailyLogStructuredValues = {
  anticipatedDelays?: boolean;
  materialDeliveries?: boolean;
  safetyIncidents?: string | null;
  tradesOnsite?: string | null;
  unplannedTasks?: string | null;
  internalNotes?: string | null;
};

type FormProps = {
  mode: "form";
  isClientView?: never;
  defaultValues?: DailyLogStructuredValues;
  values?: never;
};

type ViewProps = {
  mode: "view";
  isClientView: boolean;
  defaultValues?: never;
  values: DailyLogStructuredValues;
};

type Props = FormProps | ViewProps;

// ─── Small helpers ────────────────────────────────────────────────────────────

function Section({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-xl p-4 space-y-3"
      style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}
    >
      {children}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="text-[10px] font-bold uppercase tracking-widest"
      style={{ color: "var(--ink-muted)" }}
    >
      {children}
    </div>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label text-xs">{label}</label>
      <div className="mt-0.5">{children}</div>
    </div>
  );
}

function CheckRow({
  name,
  label,
  sublabel,
  defaultChecked,
}: {
  name: string;
  label: string;
  sublabel?: string;
  defaultChecked?: boolean;
}) {
  return (
    <div className="flex items-start gap-2">
      <input
        type="checkbox"
        id={name}
        name={name}
        value="true"
        defaultChecked={defaultChecked}
        className="mt-0.5 rounded"
      />
      <div>
        <label htmlFor={name} className="text-sm text-ink cursor-pointer select-none">
          {label}
        </label>
        {sublabel && <p className="text-xs text-ink-muted">{sublabel}</p>}
      </div>
    </div>
  );
}

function ViewField({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted mb-0.5">
        {label}
      </div>
      <p className="text-sm text-ink whitespace-pre-wrap">{value}</p>
    </div>
  );
}

function BoolView({ label, value }: { label: string; value: boolean | undefined }) {
  if (!value) return null;
  return (
    <div
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
      style={{
        background: "rgba(234,179,8,0.10)",
        color: "var(--hh-dot-yellow,#eab308)",
        border: "1px solid rgba(234,179,8,0.20)",
      }}
    >
      ⚠ {label}
    </div>
  );
}

// ─── Internal-only badge ──────────────────────────────────────────────────────

function InternalBadge() {
  return (
    <span
      className="ml-1 text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wide"
      style={{ background: "rgba(239,68,68,0.10)", color: "var(--hh-dot-red,#ef4444)" }}
    >
      Internal only
    </span>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export default function DailyLogStructuredFields(props: Props) {
  if (props.mode === "form") {
    const dv = props.defaultValues ?? {};
    return (
      <div className="space-y-3">
        <Section>
          <SectionTitle>Site conditions</SectionTitle>

          <CheckRow
            name="anticipatedDelays"
            label="Anticipated delays"
            sublabel="Check if any delays are expected today"
            defaultChecked={dv.anticipatedDelays ?? false}
          />
          <CheckRow
            name="materialDeliveries"
            label="Material pickups / deliveries"
            sublabel="Check if materials are being picked up or delivered"
            defaultChecked={dv.materialDeliveries ?? false}
          />
        </Section>

        <Section>
          <SectionTitle>Daily detail</SectionTitle>

          <FieldRow label="Trades onsite">
            <input
              className="input text-sm w-full"
              name="tradesOnsite"
              placeholder="e.g. Framing, Electrical, Plumbing"
              defaultValue={dv.tradesOnsite ?? ""}
            />
          </FieldRow>

          <FieldRow label="Unplanned tasks">
            <textarea
              className="input text-sm w-full"
              name="unplannedTasks"
              rows={2}
              placeholder="Any work that wasn't in today's plan…"
              defaultValue={dv.unplannedTasks ?? ""}
            />
          </FieldRow>

          <FieldRow label="Safety incidents">
            <textarea
              className="input text-sm w-full"
              name="safetyIncidents"
              rows={2}
              placeholder="Describe any safety incidents or near-misses (leave blank if none)…"
              defaultValue={dv.safetyIncidents ?? ""}
            />
          </FieldRow>
        </Section>

        <Section>
          <SectionTitle>
            Internal notes <InternalBadge />
          </SectionTitle>
          <p className="text-xs text-ink-muted">
            These notes are never shared with the client.
          </p>
          <textarea
            className="input text-sm w-full"
            name="internalNotes"
            rows={3}
            placeholder="Office / PM notes — not visible to client…"
            defaultValue={dv.internalNotes ?? ""}
          />
        </Section>
      </div>
    );
  }

  // ── View mode ──────────────────────────────────────────────────────────────
  const v = props.values;
  const isClientView = props.isClientView;

  const hasBoolAlerts = v.anticipatedDelays || v.materialDeliveries;
  const hasDetail     = v.tradesOnsite || v.unplannedTasks || v.safetyIncidents;
  const hasInternal   = !isClientView && v.internalNotes;

  if (!hasBoolAlerts && !hasDetail && !hasInternal) return null;

  return (
    <div className="space-y-3">
      {/* Bool flags as badges */}
      {hasBoolAlerts && (
        <div className="flex flex-wrap gap-2">
          <BoolView label="Anticipated delays"       value={v.anticipatedDelays} />
          <BoolView label="Material pickups/deliveries" value={v.materialDeliveries} />
        </div>
      )}

      {/* Detail fields */}
      {hasDetail && (
        <Section>
          <SectionTitle>Daily detail</SectionTitle>
          <ViewField label="Trades onsite"   value={v.tradesOnsite} />
          <ViewField label="Unplanned tasks" value={v.unplannedTasks} />
          <ViewField label="Safety incidents" value={v.safetyIncidents} />
        </Section>
      )}

      {/* Internal notes — never shown to clients */}
      {hasInternal && (
        <Section>
          <SectionTitle>
            Internal notes <InternalBadge />
          </SectionTitle>
          <p className="text-sm text-ink whitespace-pre-wrap">{v.internalNotes}</p>
        </Section>
      )}
    </div>
  );
}
