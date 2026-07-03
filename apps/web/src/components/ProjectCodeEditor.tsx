"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Hash, Pencil } from "lucide-react";
import { setProjectCode } from "@/app/(app)/projects/[id]/projectCodeActions";

// Derive a short editable code proposal from a source name (client or project).
function proposeCode(source: string): string {
  const letters = source.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  return (letters.slice(0, 4) || "JOB");
}

export default function ProjectCodeEditor({
  projectId,
  code,
  proposeFrom,
  canEdit,
  compact = false,
}: {
  projectId: string;
  code: string | null;
  proposeFrom: string;
  canEdit: boolean;
  compact?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(code ?? "");
  const [error, setError] = useState<string | null>(null);

  function save() {
    setError(null);
    start(async () => {
      const r = await setProjectCode(projectId, value);
      if (r.ok) {
        setEditing(false);
        router.refresh();
      } else {
        setError(r.error ?? "Could not save");
      }
    });
  }

  if (editing) {
    return (
      <div className="inline-flex flex-col gap-1">
        <div className="inline-flex items-center gap-1.5">
          <input
            className="input text-sm py-1 w-28 uppercase"
            value={value}
            placeholder="Code"
            maxLength={12}
            onChange={(e) => setValue(e.target.value.toUpperCase())}
          />
          <button
            type="button"
            className="btn-secondary text-xs"
            disabled={pending}
            onClick={() => setValue(proposeCode(proposeFrom))}
          >
            Generate
          </button>
          <button type="button" className="btn-primary text-xs" disabled={pending} onClick={save}>
            {pending ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            className="btn-ghost text-xs"
            onClick={() => {
              setEditing(false);
              setValue(code ?? "");
              setError(null);
            }}
          >
            Cancel
          </button>
        </div>
        {error && <span className="hh-caption" style={{ color: "var(--hh-dot-red)" }}>{error}</span>}
      </div>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      {code ? (
        <span className={`hh-chip ${compact ? "text-xs" : ""} inline-flex items-center gap-1`}>
          <Hash className="h-3 w-3" />
          {code}
        </span>
      ) : (
        <span className="hh-caption">No code</span>
      )}
      {canEdit && (
        <button
          type="button"
          className="btn-ghost text-xs inline-flex items-center gap-1"
          onClick={() => {
            setValue(code ?? "");
            setEditing(true);
            setError(null);
          }}
        >
          <Pencil className="h-3 w-3" />
          {code ? "Edit" : "Set code"}
        </button>
      )}
    </span>
  );
}
