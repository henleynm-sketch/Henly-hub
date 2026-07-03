"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Loader2, Plus, X } from "lucide-react";
import { attachJob, detachJob } from "@/lib/actions/engagements";

type JobRow = { id: string; name: string; code: string | null; status: string; constructionPhase?: string | null };

export default function EngagementJobs({
  engagementId,
  jobs,
  attachable,
}: {
  engagementId: string;
  jobs: JobRow[];
  attachable: JobRow[];
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState("");

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    start(async () => {
      const r = await fn();
      if (!r.ok) setError(r.error ?? "Action failed");
    });
  }

  return (
    <section className="hh-panel p-6 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="hh-label">Jobs in this project</h2>
        {pending && <Loader2 size={14} className="animate-spin opacity-60" />}
      </div>

      {jobs.length === 0 ? (
        <span className="hh-secondary">No jobs attached yet — add one below.</span>
      ) : (
        jobs.map((j) => (
          <div key={j.id} className="hh-row hh-row--flat">
            <Link href={`/jobs/${j.id}`} className="hh-primary flex-1 hover:underline">
              {j.name}
              {j.code && <span className="hh-caption ml-1.5">#{j.code}</span>}
            </Link>
            <span className="hh-badge">{j.status}</span>
            {j.constructionPhase && <span className="hh-secondary">{j.constructionPhase}</span>}
            <button
              className="btn-ghost !p-1.5"
              aria-label={`Remove ${j.name} from project`}
              disabled={pending}
              onClick={() => run(() => detachJob(j.id))}
            >
              <X size={13} />
            </button>
          </div>
        ))
      )}

      <div className="flex items-center gap-2 border-t border-glass-border pt-3">
        <select
          className="input flex-1 text-sm"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
        >
          <option value="">
            {attachable.length ? "Attach an existing job for this client…" : "No unattached jobs for this client"}
          </option>
          {attachable.map((j) => (
            <option key={j.id} value={j.id}>
              {j.name}
              {j.code ? ` (#${j.code})` : ""} · {j.status}
            </option>
          ))}
        </select>
        <button
          className="btn-secondary text-xs inline-flex items-center gap-1"
          disabled={pending || !selected}
          onClick={() =>
            run(async () => {
              const r = await attachJob(engagementId, selected);
              if (r.ok) setSelected("");
              return r;
            })
          }
        >
          <Plus size={13} /> Attach
        </button>
        <Link href="/projects/new" className="btn-primary text-xs whitespace-nowrap">
          + New job
        </Link>
      </div>

      {error && (
        <div className="flex items-center gap-2">
          <span className="hh-dot hh-dot--red" />
          <span className="hh-secondary">{error}</span>
        </div>
      )}
    </section>
  );
}
