import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Check } from "lucide-react";
import AuthForm from "./AuthForm";

const FEATURES = [
  "Role-aware access, top to bottom",
  "Live job costing into QuickBooks",
  "Daily logs and time straight from the field",
];

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const session = await auth();
  if (session?.user) redirect("/dashboard");
  const sp = await searchParams;

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      {/* Left — form panel (light) */}
      <section className="flex items-center justify-center bg-white px-6 py-10 sm:px-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-full border border-neutral-300">
              <span className="font-serif text-lg font-bold text-neutral-900">H</span>
            </div>
            <span className="text-sm font-semibold uppercase tracking-[0.2em] text-neutral-900">
              Henley Hub
            </span>
          </div>
          <AuthForm initialError={sp.error} initialNotice={sp.notice} />
        </div>
      </section>

      {/* Right — marketing panel (dark, hidden on mobile) */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-neutral-950 p-12 text-white lg:flex">
        <div className="text-xs font-semibold uppercase tracking-[0.3em] text-white/50">Henley Hub</div>

        <div className="max-w-md">
          <h2 className="font-serif text-5xl font-semibold leading-[1.08] tracking-tight">
            Every job, one hub.
          </h2>
          <p className="mt-6 text-base leading-relaxed text-white/70">
            CRM, projects, daily logs, time, estimates, and files — role-aware and in sync. The
            single system Henley runs on, from first lead to final walkthrough.
          </p>
          <ul className="mt-8 space-y-3.5">
            {FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-3">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-accent/20 text-accent">
                  <Check size={13} strokeWidth={3} />
                </span>
                <span className="text-sm text-white/85">{f}</span>
              </li>
            ))}
          </ul>

          {/* Glass-framed product preview (placeholder — drop in a real screenshot) */}
          <div className="mt-10 rounded-2xl border border-white/10 bg-white/5 p-2.5 backdrop-blur-sm">
            <div className="overflow-hidden rounded-xl border border-white/10">
              <div className="flex items-center gap-1.5 border-b border-white/10 px-3 py-2">
                <span className="h-2 w-2 rounded-full bg-white/20" />
                <span className="h-2 w-2 rounded-full bg-white/20" />
                <span className="h-2 w-2 rounded-full bg-white/20" />
                <span className="ml-2 text-[10px] uppercase tracking-widest text-white/30">
                  Henley Hub · Dashboard
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 p-3">
                <div className="h-12 rounded-lg bg-white/5" />
                <div className="h-12 rounded-lg bg-white/5" />
                <div className="h-12 rounded-lg bg-white/5" />
                <div className="col-span-2 h-20 rounded-lg bg-white/5" />
                <div className="h-20 rounded-lg bg-accent/25" />
              </div>
            </div>
          </div>
        </div>

        <div className="text-xs text-white/40">
          © {new Date().getFullYear()} Henley Contracting Ltd.
        </div>
      </aside>
    </main>
  );
}
