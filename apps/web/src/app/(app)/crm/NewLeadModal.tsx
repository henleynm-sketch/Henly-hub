"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LEAD_SOURCE } from "@/lib/taxonomy";
import { createLead } from "./actions";

export default function NewLeadModal() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, start] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = (fd.get("name") as string | null)?.trim() ?? "";
    const email = (fd.get("email") as string | null)?.trim() ?? "";
    const phone = (fd.get("phone") as string | null)?.trim() ?? "";
    const leadSource = (fd.get("leadSource") as string | null) ?? "";

    if (!name) {
      setError("Name is required.");
      return;
    }
    if (!email && !phone) {
      setError("Add an email or a phone number.");
      return;
    }
    setError(null);

    start(async () => {
      try {
        const result = await createLead({
          name,
          email: email || undefined,
          phone: phone || undefined,
          leadSource: leadSource || undefined,
        });
        formRef.current?.reset();
        setOpen(false);
        router.push(`/crm/${result.projectId}`);
      } catch (err: unknown) {
        setError(
          err instanceof Error ? err.message : "Failed to create lead"
        );
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => { setError(null); setOpen(true); }}
        className="btn-primary text-sm"
      >
        + New lead
      </button>

      {open && (
        /* backdrop */
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={() => setOpen(false)}
        >
          {/* panel */}
          <div
            className="hh-panel w-full max-w-md shadow-2xl p-8 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold">New lead</h2>

            <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="hh-label block">Name *</label>
                <input
                  name="name"
                  className="input w-full"
                  placeholder="e.g. Johnson Family"
                  required
                  disabled={isPending}
                />
              </div>

              <div className="space-y-1">
                <label className="hh-label block">Email</label>
                <input
                  name="email"
                  type="email"
                  className="input w-full"
                  placeholder="contact@example.com"
                  disabled={isPending}
                />
              </div>

              <div className="space-y-1">
                <label className="hh-label block">Phone</label>
                <input
                  name="phone"
                  type="tel"
                  className="input w-full"
                  placeholder="+1 (555) 000-0000"
                  disabled={isPending}
                />
              </div>

              <div className="space-y-1">
                <label className="hh-label block">Lead source</label>
                <select
                  name="leadSource"
                  className="input w-full"
                  disabled={isPending}
                >
                  <option value="">— select source —</option>
                  {LEAD_SOURCE.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              {error && (
                <p className="text-xs text-rose-600">{error}</p>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="submit"
                  className="btn-primary flex-1"
                  disabled={isPending}
                >
                  {isPending ? "Creating…" : "Create lead"}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setOpen(false)}
                  disabled={isPending}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
