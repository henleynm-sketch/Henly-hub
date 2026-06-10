"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

const ROLES = [
  { email: "kyle@henleyhub.com", label: "CEO / Owner", color: "bg-rose-500" },
  { email: "morgan@henleyhub.com", label: "Office / PM", color: "bg-blue-500" },
  { email: "jess@henleyhub.com", label: "Field — Lead", color: "bg-emerald-500" },
  { email: "tile-pro@subs.com", label: "Sub — Tile", color: "bg-amber-500" },
  { email: "rachel.t@example.com", label: "Client — Tomlinson", color: "bg-violet-500" },
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
        <div className="w-72 p-5 rounded-[24px] border border-glass-border bg-glass-bg/95 shadow-glass backdrop-blur-glass text-ink flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">
                Demo: switch role
              </div>
              <div className="text-[10px] text-ink-soft font-mono">Dev mode only</div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-ink-soft hover:text-ink text-lg font-bold transition-colors"
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
                    className={`flex w-full items-center gap-3 rounded-[10px] px-4 py-3 text-left text-sm transition-all ${
                      active 
                        ? "bg-row-active text-ink font-semibold cursor-default" 
                        : "text-ink-soft hover:bg-row-hover hover:text-ink"
                    }`}
                  >
                    <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${r.color}`} />
                    <span className="flex-1 min-w-0">
                      <div className="font-semibold truncate text-ink">{r.label}</div>
                      <div className="text-xs text-ink-soft truncate">{r.email}</div>
                    </span>
                    {active && <span className="text-[9px] font-bold uppercase text-accent border border-accent/20 bg-accent/10 px-1.5 py-0.5 rounded-full shrink-0">active</span>}
                  </button>
                </li>
              );
            })}
          </ul>
          {error && (
            <div className="border-t border-glass-border pt-2 text-xs text-rose-400 font-semibold">{error}</div>
          )}
          <div className="border-t border-glass-border pt-3 text-[10px] text-ink-soft leading-normal flex items-center justify-between">
            <span>Password for all demo users:</span>
            <code className="bg-chip-bg text-chip-text px-1.5 py-0.5 rounded font-mono">demo</code>
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
