"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setUiTheme } from "@/lib/actions/uiTheme";

const OPTIONS = [
  { id: "glass", label: "Glass", desc: "Frosted, dark, photographic" },
  { id: "saas", label: "SaaS", desc: "Clean, light, solid" },
] as const;

function Swatch({ variant }: { variant: string }) {
  const outer =
    variant === "glass"
      ? { background: "linear-gradient(150deg,#141C2B,#0D1420)" }
      : { background: "#FAFAFB" };
  const inner =
    variant === "glass"
      ? { background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.28)" }
      : { background: "#FFFFFF", border: "1px solid #E9EAEE", boxShadow: "0 1px 2px rgba(16,17,20,0.10)" };
  return (
    <div className="mb-2 h-16 w-full overflow-hidden rounded-lg p-2" style={outer}>
      <div className="h-full w-full rounded-md" style={inner} />
    </div>
  );
}

export default function UiThemeSwitch({ initial }: { initial: string }) {
  const [value, setValue] = useState(initial === "saas" ? "saas" : "glass");
  const [pending, start] = useTransition();
  const router = useRouter();

  function choose(theme: string) {
    if (theme === value || pending) return;
    const prev = value;
    setValue(theme);
    start(async () => {
      try {
        await setUiTheme(theme);
        router.refresh();
      } catch {
        setValue(prev);
      }
    });
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {OPTIONS.map((o) => {
        const active = value === o.id;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => choose(o.id)}
            disabled={pending}
            aria-pressed={active}
            className={`text-left rounded-xl border p-3 transition-all ${
              active ? "border-accent ring-2 ring-accent-focus" : "border-glass-border hover:border-glass-border-hover"
            }`}
          >
            <Swatch variant={o.id} />
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-ink">{o.label}</span>
              {active && <span className="hh-badge hh-badge--success">Active</span>}
            </div>
            <div className="hh-caption mt-0.5">{o.desc}</div>
          </button>
        );
      })}
    </div>
  );
}
