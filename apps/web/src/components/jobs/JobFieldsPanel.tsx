"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { GROUP_AXES, type GroupAxis } from "@/lib/jobBoard";
import { setProjectGroupField, setProjectMeta } from "@/lib/actions/jobViews";
import { JOB_TYPE } from "@/lib/taxonomy";

export type JobFields = {
  status: string;
  projectType: string | null;
  projectManager: string | null;
  salesRep: string | null;
  customerPO: string | null;
  pipelineStage: string | null;
  constructionPhase: string | null;
  warrantyPhase: string | null;
  division: string | null;
};

// The JobTread-style nine-field panel. Selects write through the same
// validated server actions as the board; text fields save on blur.
export default function JobFieldsPanel({
  projectId,
  fields,
  canEdit,
}: {
  projectId: string;
  fields: JobFields;
  canEdit: boolean;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function axisSelect(axis: GroupAxis, label: string, value: string | null, clearable = true) {
    const options = GROUP_AXES[axis] as readonly string[];
    return (
      <div className="flex items-center justify-between gap-2 py-1.5 border-b border-glass-border last:border-0">
        <span className="hh-secondary shrink-0">{label}</span>
        {canEdit ? (
          <select
            className="input !w-auto max-w-[60%] text-xs"
            value={value ?? ""}
            disabled={pending}
            onChange={(e) => {
              setError(null);
              const v = e.target.value || null;
              start(async () => {
                const r = await setProjectGroupField(projectId, axis, v);
                if (!r.ok) setError(r.error ?? "Save failed");
              });
            }}
          >
            {clearable && <option value="">—</option>}
            {options.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        ) : (
          <span className="hh-primary text-right">{value ?? "—"}</span>
        )}
      </div>
    );
  }

  function textField(key: "projectManager" | "salesRep" | "customerPO", label: string, value: string | null) {
    return (
      <div className="flex items-center justify-between gap-2 py-1.5 border-b border-glass-border last:border-0">
        <span className="hh-secondary shrink-0">{label}</span>
        {canEdit ? (
          <input
            className="input !w-auto max-w-[60%] text-xs text-right"
            defaultValue={value ?? ""}
            disabled={pending}
            onBlur={(e) => {
              if ((e.target.value || null) === (value ?? null)) return;
              setError(null);
              const v = e.target.value;
              start(async () => {
                const r = await setProjectMeta(projectId, { [key]: v });
                if (!r.ok) setError(r.error ?? "Save failed");
              });
            }}
          />
        ) : (
          <span className="hh-primary text-right">{value ?? "—"}</span>
        )}
      </div>
    );
  }

  return (
    <div className="hh-panel p-5 flex flex-col">
      <div className="flex items-center justify-between mb-1">
        <h2 className="hh-label">Job fields</h2>
        {pending && <Loader2 size={13} className="animate-spin opacity-60" />}
      </div>
      {axisSelect("status", "Status", fields.status, false)}
      <div className="flex items-center justify-between gap-2 py-1.5 border-b border-glass-border">
        <span className="hh-secondary shrink-0">Type</span>
        {canEdit ? (
          <select
            className="input !w-auto max-w-[60%] text-xs"
            value={fields.projectType ?? ""}
            disabled={pending}
            onChange={(e) => {
              setError(null);
              const v = e.target.value;
              start(async () => {
                const r = await setProjectMeta(projectId, { projectType: v });
                if (!r.ok) setError(r.error ?? "Save failed");
              });
            }}
          >
            <option value="">—</option>
            {JOB_TYPE.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        ) : (
          <span className="hh-primary text-right">{fields.projectType ?? "—"}</span>
        )}
      </div>
      {textField("projectManager", "Project Manager", fields.projectManager)}
      {textField("salesRep", "Sales Rep", fields.salesRep)}
      {textField("customerPO", "Customer PO", fields.customerPO)}
      {axisSelect("pipelineStage", "Pipeline Stage", fields.pipelineStage)}
      {axisSelect("constructionPhase", "Construction Phase", fields.constructionPhase)}
      {axisSelect("warrantyPhase", "Warranty Phase", fields.warrantyPhase)}
      {axisSelect("division", "Division", fields.division)}
      {error && (
        <div className="flex items-center gap-2 mt-2">
          <span className="hh-dot hh-dot--red" />
          <span className="hh-secondary">{error}</span>
        </div>
      )}
    </div>
  );
}
