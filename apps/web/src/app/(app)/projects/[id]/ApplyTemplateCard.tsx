"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LayoutTemplate } from "lucide-react";
import { applyTemplate } from "@/app/(app)/templates/templateActions";

type Template = { id: string; name: string };

export default function ApplyTemplateCard({
  projectId,
  jobType,
  templates,
}: {
  projectId: string;
  jobType: string | null;
  templates: Template[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [selected, setSelected] = useState(templates[0]?.id ?? "");
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  if (!jobType || templates.length === 0) return null;

  function handleApply() {
    if (!selected) return;
    start(async () => {
      const r = await applyTemplate(projectId, selected);
      setMsg({ text: r.ok ? "Template applied" : (r.error ?? "Failed"), ok: r.ok });
      if (r.ok) router.refresh();
      setTimeout(() => setMsg(null), 4000);
    });
  }

  return (
    <div
      className="card p-4"
      style={{ border: "1px solid var(--glass-border)" }}
    >
      <div className="flex items-center gap-2 mb-3">
        <LayoutTemplate size={14} className="text-accent" />
        <span className="text-sm font-semibold text-ink">Apply template</span>
        <span
          className="text-[10px] px-2 py-0.5 rounded-full font-medium"
          style={{
            background: "var(--accent-10, rgba(92,124,250,0.1))",
            color: "var(--accent)",
            border: "1px solid var(--accent-20, rgba(92,124,250,0.2))",
          }}
        >
          {jobType}
        </span>
      </div>

      <div className="flex gap-2 items-center">
        <select
          className="input flex-1 text-sm"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          disabled={pending}
        >
          {templates.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <button
          onClick={handleApply}
          className="btn-primary text-sm shrink-0"
          disabled={pending || !selected}
        >
          {pending ? "Applying…" : "Apply"}
        </button>
      </div>

      {msg && (
        <p
          className="text-xs mt-2 font-medium"
          style={{ color: msg.ok ? "var(--hh-dot-green, #22c55e)" : "var(--hh-dot-red, #ef4444)" }}
        >
          {msg.text}
        </p>
      )}
    </div>
  );
}
