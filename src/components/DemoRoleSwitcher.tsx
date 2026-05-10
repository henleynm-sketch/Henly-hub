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
        <div className="w-72 rounded-xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Demo: switch role
              </div>
              <div className="text-[10px] text-slate-400">Dev mode only</div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-slate-400 hover:text-slate-700"
              aria-label="Close"
            >
              ×
            </button>
          </div>
          <ul className="p-2">
            {ROLES.map((r) => {
              const active = r.email === currentEmail;
              return (
                <li key={r.email}>
                  <button
                    disabled={pending || active}
                    onClick={() => switchTo(r.email)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm ${
                      active ? "bg-slate-100 text-slate-500" : "hover:bg-slate-50"
                    }`}
                  >
                    <span className={`h-2 w-2 rounded-full ${r.color}`} />
                    <span className="flex-1">
                      <div className="font-medium">{r.label}</div>
                      <div className="text-xs text-slate-500">{r.email}</div>
                    </span>
                    {active && <span className="text-[10px] uppercase text-slate-400">current</span>}
                  </button>
                </li>
              );
            })}
          </ul>
          {error && (
            <div className="border-t border-slate-100 px-4 py-2 text-xs text-rose-600">{error}</div>
          )}
          <div className="border-t border-slate-100 px-4 py-2 text-[10px] text-slate-400">
            Password for all demo users: <code>demo</code>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="rounded-full bg-slate-900 px-4 py-2 text-xs font-medium text-white shadow-lg hover:bg-slate-700"
        >
          🔄 Switch role (demo)
        </button>
      )}
    </div>
  );
}
