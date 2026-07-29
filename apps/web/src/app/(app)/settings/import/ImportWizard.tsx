"use client";

import { useState, useTransition } from "react";
import {
  inferMappingAction,
  previewImportAction,
  commitImportAction,
} from "./importActions";
import type {
  ImportMapping,
  ImportSummary,
  ImportSource,
  ImportField,
  ImportRowPreview,
} from "@/lib/importPresets";
import {
  IMPORT_SOURCES,
  IMPORT_SOURCE_LABELS,
  IMPORT_FIELDS,
  IMPORT_FIELD_LABELS,
} from "@/lib/importPresets";

type Step = "upload" | "mapping" | "preview" | "done";

export default function ImportWizard() {
  const [step, setStep] = useState<Step>("upload");
  const [csvText, setCsvText] = useState("");
  const [fileName, setFileName] = useState("");
  const [source, setSource] = useState<ImportSource>("generic");
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<ImportMapping>({});
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toMapping() {
    setError(null);
    startTransition(async () => {
      const res = await inferMappingAction(csvText, source);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setHeaders(res.headers);
      setMapping(res.mapping);
      setStep("mapping");
    });
  }

  function toPreview() {
    setError(null);
    startTransition(async () => {
      const res = await previewImportAction(csvText, source, mapping);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSummary(res.summary);
      setStep("preview");
    });
  }

  function commit() {
    setError(null);
    startTransition(async () => {
      const res = await commitImportAction(csvText, source, mapping);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSummary(res.summary);
      setStep("done");
    });
  }

  return (
    <div className="space-y-6">
      <StepRail step={step} />
      {error && (
        <div className="rounded-lg border border-red-300/40 bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {error}
        </div>
      )}

      {step === "upload" && (
        <div className="hh-panel space-y-4 p-5">
          <div>
            <label className="label">CSV file</label>
            <input
              type="file"
              accept=".csv,text/csv"
              className="input input-file mt-1"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                setFileName(f.name);
                setCsvText(await f.text());
              }}
            />
            {fileName && <p className="mt-2 hh-caption">{fileName} loaded.</p>}
          </div>
          <div>
            <label className="label">Source preset</label>
            <select
              className="input mt-1"
              value={source}
              onChange={(e) => setSource(e.target.value as ImportSource)}
            >
              {IMPORT_SOURCES.map((s) => (
                <option key={s} value={s}>
                  {IMPORT_SOURCE_LABELS[s]}
                </option>
              ))}
            </select>
            <p className="mt-2 hh-caption">
              The preset seeds the column auto-match; you can edit every mapping on the next step.
            </p>
          </div>
          <button className="btn-primary" disabled={!csvText || pending} onClick={toMapping}>
            {pending ? "Reading…" : "Continue to mapping"}
          </button>
        </div>
      )}

      {step === "mapping" && (
        <div className="hh-panel space-y-4 p-5">
          <p className="hh-caption">
            Auto-matched from the header row. Set a field to “— not mapped —” to leave it out.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {IMPORT_FIELDS.map((field: ImportField) => (
              <div key={field}>
                <label className="label">{IMPORT_FIELD_LABELS[field]}</label>
                <select
                  className="input mt-1"
                  value={mapping[field] ?? ""}
                  onChange={(e) =>
                    setMapping({ ...mapping, [field]: e.target.value || null })
                  }
                >
                  <option value="">— not mapped —</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button className="btn-secondary" onClick={() => setStep("upload")}>
              Back
            </button>
            <button className="btn-primary" disabled={pending} onClick={toPreview}>
              {pending ? "Checking…" : "Dry-run preview"}
            </button>
          </div>
        </div>
      )}

      {step === "preview" && summary && (
        <div className="space-y-4">
          <SummaryPanel summary={summary} />
          <PreviewTable rows={summary.preview} />
          <div className="flex gap-2">
            <button className="btn-secondary" onClick={() => setStep("mapping")}>
              Back to mapping
            </button>
            <button className="btn-primary" disabled={pending} onClick={commit}>
              {pending ? "Importing…" : "Confirm import"}
            </button>
          </div>
        </div>
      )}

      {step === "done" && summary && (
        <div className="space-y-4">
          <SummaryPanel summary={summary} />
          <PreviewTable rows={summary.preview} />
          <button
            className="btn-secondary"
            onClick={() => {
              setStep("upload");
              setCsvText("");
              setFileName("");
              setSummary(null);
            }}
          >
            Import another file
          </button>
        </div>
      )}
    </div>
  );
}

function StepRail({ step }: { step: Step }) {
  const steps: { key: Step; label: string }[] = [
    { key: "upload", label: "1 · Upload" },
    { key: "mapping", label: "2 · Map columns" },
    { key: "preview", label: "3 · Dry-run" },
    { key: "done", label: "4 · Imported" },
  ];
  return (
    <div className="flex flex-wrap gap-2">
      {steps.map((s) => (
        <span
          key={s.key}
          className={`hh-chip ${s.key === step ? "!text-ink" : "opacity-50"}`}
        >
          {s.label}
        </span>
      ))}
    </div>
  );
}

function SummaryPanel({ summary }: { summary: ImportSummary }) {
  const s = summary;
  return (
    <div className="hh-panel p-5">
      <h2 className="hh-label">{s.dryRun ? "Dry-run — nothing written yet" : "Import complete"}</h2>
      <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
        <Stat label="Rows parsed" value={s.rowsParsed} />
        <Stat label={s.dryRun ? "Clients to create" : "Clients created"} value={s.clientsCreated} />
        <Stat label="Clients matched" value={s.clientsMatched} />
        <Stat label={s.dryRun ? "Jobs to create" : "Jobs created"} value={s.jobsCreated} />
        <Stat label="Jobs skipped (duplicate)" value={s.jobsSkipped} />
        <Stat label="Projects (groups) created" value={s.engagementsCreated} />
        <Stat label="Unstaged" value={s.unstaged} />
        <Stat label="Non-dedupable (no email/phone)" value={s.nonDedupable} />
      </dl>
      <p className="mt-3 hh-caption">
        This importer creates Clients and Jobs. Group Jobs into Projects from the jobs list afterwards.
      </p>
      {s.skipped.length > 0 && (
        <div className="mt-3">
          <h3 className="hh-label">Skipped rows</h3>
          <ul className="mt-1 space-y-0.5 text-xs text-slate-400">
            {s.skipped.map((k) => (
              <li key={k.index}>
                Row {k.index}: {k.reason}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="hh-caption">{label}</dt>
      <dd className="font-semibold text-ink">{value}</dd>
    </div>
  );
}

function PreviewTable({ rows }: { rows: ImportRowPreview[] }) {
  if (rows.length === 0) return null;
  return (
    <div className="hh-panel overflow-x-auto !p-0">
      <div className="border-b border-glass-border px-5 py-3">
        <h2 className="hh-label">First {rows.length} mapped rows</h2>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th className="hh-label px-3 py-2 text-left">#</th>
            <th className="hh-label px-3 py-2 text-left">Client</th>
            <th className="hh-label px-3 py-2 text-left">Email / phone</th>
            <th className="hh-label px-3 py-2 text-left">Job</th>
            <th className="hh-label px-3 py-2 text-left">Stage</th>
            <th className="hh-label px-3 py-2 text-left">Client action</th>
            <th className="hh-label px-3 py-2 text-left">Job action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.index} className="border-t border-glass-border">
              <td className="px-3 py-2">{r.index}</td>
              <td className="px-3 py-2">
                {r.name}
                {r.nonDedupable && <span className="ml-1.5 hh-chip">no email/phone</span>}
              </td>
              <td className="px-3 py-2 text-slate-400">
                {[r.email, r.phone].filter(Boolean).join(" · ") || "—"}
              </td>
              <td className="px-3 py-2">{r.jobName}</td>
              <td className="px-3 py-2">
                {r.pipelineStage ?? (
                  <span className="hh-chip">unstaged{r.rawStage ? ` (“${r.rawStage}”)` : ""}</span>
                )}
              </td>
              <td className="px-3 py-2">{clientActionLabel(r.clientAction)}</td>
              <td className="px-3 py-2">
                {r.jobAction === "create" ? "Create job" : "Skip (duplicate)"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function clientActionLabel(a: ImportRowPreview["clientAction"]): string {
  switch (a) {
    case "create":
      return "Create client";
    case "match-email":
      return "Match by email";
    case "match-phone":
      return "Match by phone";
    case "match-name":
      return "Match by name";
  }
}
