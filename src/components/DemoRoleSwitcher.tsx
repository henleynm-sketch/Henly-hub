"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

const ROLES = [
  { email: "kyle@henleyhub.com", label: "CEO / Owner", color: "hh-dot--red" },
  { email: "morgan@henleyhub.com", label: "Office / PM", color: "hh-dot--blue" },
  { email: "jess@henleyhub.com", label: "Field — Lead", color: "hh-dot--green" },
  { email: "tile-pro@subs.com", label: "Sub — Tile", color: "hh-dot--orange" },
  { email: "rachel.t@example.com", label: "Client — Tomlinson", color: "hh-dot--purple" },
];

export default function DemoRoleSwitcher({ currentEmail }: { currentEmail?: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function switchTo(email: string) {
    setError(null);
    const res = await fetch("/api/demo/switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Switch failed");
      return;
    }
    start(() => {
      router.refresh();
      router.push("/dashboard");
    });
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {open ? (
        <div className="hh-panel w-72 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="hh-label">
                Demo: switch role
              </div>
              <div className="hh-caption font-mono">Dev mode only</div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="hh-close"
              aria-label="Close"
            >
              ×
            </button>
          </div>
          <ul className="space-y-1">
            {ROLES.map((r) => {
              const active = r.email === currentEmail;
              return (
                <li key={r.email}>
                  <button
                    disabled={pending || active}
                    onClick={() => switchTo(r.email)}
                    className={`hh-row w-full text-left ${
                      active ? "hh-row--active cursor-default" : "hh-row--flat"
                    }`}
                  >
                    <span className={`hh-dot ${r.color}`} />
                    <span className="flex-1 min-w-0">
                      <div className="hh-primary truncate">{r.label}</div>
                      <div className="hh-secondary truncate">{r.email}</div>
                    </span>
                    {active && <span className="hh-badge">active</span>}
                  </button>
                </li>
              );
            })}
          </ul>
          {error && (
            <div className="border-t border-glass-border pt-2 text-xs text-rose-400 font-semibold">{error}</div>
          )}
          <div>
            <hr className="hh-divider" />
            <div className="hh-caption leading-normal flex items-center justify-between">
              <span>Password for all demo users:</span>
              <code className="hh-chip">demo</code>
            </div>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="rounded-full bg-slate-900 border border-white/10 px-4 py-2.5 text-xs font-bold text-white shadow-lg transition-all hover:bg-slate-800 active:scale-95 flex items-center gap-1.5"
        >
          <span>🔄</span>
          <span>Switch role (demo)</span>
        </button>
      )}
    </div>
  );
}
