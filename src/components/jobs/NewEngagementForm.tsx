"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { createEngagement } from "@/lib/actions/engagements";

export default function NewEngagementForm({ clients }: { clients: { id: string; name: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function onSubmit(fd: FormData) {
    setError(null);
    start(async () => {
      const r = await createEngagement(fd);
      if (!r.ok) {
        setError(r.error ?? "Could not create project");
        return;
      }
      setOpen(false);
      if (r.id) router.push(`/jobs/projects/${r.id}`);
    });
  }

  if (!open) {
    return (
      <div>
        <button className="btn-primary text-xs inline-flex items-center gap-1" onClick={() => setOpen(true)}>
          <Plus size={13} /> New project
        </button>
      </div>
    );
  }

  return (
    <form action={onSubmit} className="hh-panel p-5 flex flex-col gap-3 max-w-md">
      <h2 className="hh-label">New project</h2>
      <div>
        <label className="hh-label block mb-1.5">Client</label>
        <select name="clientId" className="input" required>
          <option value="">Select…</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="hh-label block mb-1.5">Project name</label>
        <input name="name" className="input" placeholder="e.g. Bailey — 85 Lakeview engagement" required />
      </div>
      <div>
        <label className="hh-label block mb-1.5">Description</label>
        <textarea name="description" rows={2} className="input" />
      </div>
      {error && (
        <div className="flex items-center gap-2">
          <span className="hh-dot hh-dot--red" />
          <span className="hh-secondary">{error}</span>
        </div>
      )}
      <div className="flex gap-2 justify-end">
        <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
          Cancel
        </button>
        <button className="btn-primary inline-flex items-center gap-1.5" disabled={pending}>
          {pending && <Loader2 size={14} className="animate-spin" />}
          Create
        </button>
      </div>
    </form>
  );
}
