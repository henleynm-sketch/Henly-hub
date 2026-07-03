"use client";

import { useRef, useState, useTransition } from "react";
import { logActivity } from "@/app/(app)/crm/actions";

type ActivityType = "NOTE" | "CALL" | "MEETING";

const TYPE_LABELS: Record<ActivityType, string> = {
  NOTE: "Add note",
  CALL: "Log call",
  MEETING: "Log meeting",
};

const TYPE_PLACEHOLDERS: Record<ActivityType, string> = {
  NOTE: "Add a note…",
  CALL: "What was discussed on the call?",
  MEETING: "Meeting notes and outcomes…",
};

export default function ClientActivityLogger({ clientId }: { clientId: string }) {
  const [type, setType] = useState<ActivityType>("NOTE");
  const [error, setError] = useState<string | null>(null);
  const [isPending, start] = useTransition();
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const body = bodyRef.current?.value.trim() ?? "";
    if (!body) return;
    setError(null);
    start(async () => {
      try {
        await logActivity({ type, body, clientId });
        if (bodyRef.current) bodyRef.current.value = "";
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to save");
      }
    });
  }

  return (
    <section className="hh-panel p-6">
      <h2 className="hh-label mb-4">Log activity</h2>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex gap-2">
          {(["NOTE", "CALL", "MEETING"] as ActivityType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={[
                "px-3 py-1 rounded text-xs font-medium border transition-colors",
                type === t
                  ? "bg-[var(--hh-accent)] text-white border-[var(--hh-accent)]"
                  : "border-[var(--hh-border)] text-[var(--hh-muted)] hover:border-[var(--hh-accent)]",
              ].join(" ")}
            >
              {TYPE_LABELS[t]}
            </button>
          ))}
        </div>

        <textarea
          ref={bodyRef}
          rows={3}
          className="input min-h-[80px] resize-y w-full"
          placeholder={TYPE_PLACEHOLDERS[type]}
          disabled={isPending}
          required
        />

        {error && <p className="text-xs text-rose-600">{error}</p>}

        <button
          type="submit"
          className="btn-primary text-xs px-4 py-2"
          disabled={isPending}
        >
          {isPending ? "Saving…" : "Save"}
        </button>
      </form>
    </section>
  );
}
