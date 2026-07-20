import { auth, signIn } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

const ROLES = [
  { label: "CEO / Owner", email: "kyle@henleyhub.com", scope: "Everything — team, financials, all projects" },
  { label: "Office / PM", email: "morgan@henleyhub.com", scope: "CRM, projects, estimates, contracts, financials" },
  { label: "Field lead", email: "jess@henleyhub.com", scope: "Assigned jobs, daily logs, time clock" },
  { label: "Subcontractor", email: "tile-pro@subs.com", scope: "Assigned scopes, plans & permits, messages" },
  { label: "Client", email: "rachel.t@example.com", scope: "Their project, shared docs & updates only" },
];

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (session?.user) redirect("/dashboard");
  const sp = await searchParams;

  const [activeProjects, teamMembers] = await Promise.all([
    prisma.project.count({
      where: { status: { in: ["IN_PROGRESS", "FINISHING", "PERMITTING", "DESIGN", "CLOSING"] } },
    }),
    prisma.user.count({ where: { role: { not: "CLIENT" } } }),
  ]);

  async function handleSignIn(formData: FormData) {
    "use server";
    const email = String(formData.get("email") || "");
    const password = String(formData.get("password") || "");
    try {
      await signIn("credentials", { email, password, redirectTo: "/dashboard" });
    } catch (err) {
      if ((err as Error).message?.includes("NEXT_REDIRECT")) throw err;
      redirect("/?error=invalid");
    }
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <section
        className="relative hidden lg:flex flex-col justify-between p-12"
        style={{
          backgroundColor: "#0A0A0B",
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.045) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="grid h-12 w-12 place-items-center rounded-full"
            style={{ border: "1px solid rgba(255,255,255,0.35)", color: "#fff" }}
          >
            <span className="font-serif text-xl font-bold">H</span>
          </div>
          <div>
            <div className="font-serif text-2xl tracking-[0.18em] text-white">HENLEY</div>
            <div className="text-[10px] font-semibold tracking-[0.35em]" style={{ color: "#A0A4AC" }}>
              CONTRACTING LTD
            </div>
          </div>
        </div>

        <div>
          <h1 className="text-5xl xl:text-6xl font-black leading-[1.05] tracking-tight text-white">
            Build the plan.
            <br />
            Then build it <span style={{ color: "#E8621A" }}>for real.</span>
          </h1>
          <p className="mt-6 max-w-md text-base leading-relaxed" style={{ color: "#A0A4AC" }}>
            Henley Hub keeps every client, project, crew member and daily task in one place —
            from first call to final walkthrough.
          </p>
        </div>

        <div>
          <div className="flex gap-14">
            <div>
              <div className="text-3xl font-bold text-white">{activeProjects}</div>
              <div className="mt-1 text-xs" style={{ color: "#7C8088" }}>Active projects</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-white">{teamMembers}</div>
              <div className="mt-1 text-xs" style={{ color: "#7C8088" }}>Team members</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-white">8 AM–5 PM</div>
              <div className="mt-1 text-xs" style={{ color: "#7C8088" }}>Mon to Fri</div>
            </div>
          </div>
          <div className="mt-10 text-xs" style={{ color: "#7C8088" }}>
            © {new Date().getFullYear()} Henley Contracting Ltd.
          </div>
        </div>
      </section>

      {/* Sign-in panel */}
      <section className="flex items-center justify-center bg-white p-8">
        <div className="w-full max-w-sm">
          <div className="mb-10 flex items-center gap-3 lg:hidden">
            <div
              className="grid h-10 w-10 place-items-center rounded-full"
              style={{ border: "1px solid rgba(0,0,0,0.3)", color: "#141417" }}
            >
              <span className="font-serif text-lg font-bold">H</span>
            </div>
            <div>
              <div className="font-serif text-xl tracking-[0.18em]" style={{ color: "#141417" }}>HENLEY</div>
              <div className="text-[9px] font-semibold tracking-[0.35em]" style={{ color: "#5A616B" }}>
                CONTRACTING LTD
              </div>
            </div>
          </div>

          <div className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: "#E8621A" }}>
            Henley Hub · Sign in
          </div>
          <h2 className="mt-2 text-3xl font-bold tracking-tight" style={{ color: "#141417" }}>
            Welcome Back
          </h2>
          <p className="mt-2 text-sm" style={{ color: "#5A616B" }}>
            Sign in with your work email and password to get to work.
          </p>

          {sp.error && (
            <div
              className="mt-5 rounded-lg px-3 py-2.5 text-sm font-medium"
              style={{ background: "rgba(229,72,77,0.08)", border: "1px solid rgba(229,72,77,0.3)", color: "#C92A2A" }}
            >
              That email or password didn&apos;t match.
            </div>
          )}

          <form action={handleSignIn} className="mt-7 space-y-4">
            <div>
              <label className="text-sm font-medium" style={{ color: "#141417" }}>Work email</label>
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@henleycontracting.com"
                className="mt-1.5 w-full rounded-lg px-3.5 py-2.5 text-sm outline-none transition-colors bg-white"
                style={{ border: "1px solid rgba(0,0,0,0.18)", color: "#141417" }}
              />
            </div>
            <div>
              <label className="text-sm font-medium" style={{ color: "#141417" }}>Password</label>
              <input
                name="password"
                type="password"
                required
                autoComplete="current-password"
                className="mt-1.5 w-full rounded-lg px-3.5 py-2.5 text-sm outline-none transition-colors bg-white"
                style={{ border: "1px solid rgba(0,0,0,0.18)", color: "#141417" }}
              />
            </div>
            <button
              type="submit"
              className="w-full rounded-lg py-2.5 text-sm font-semibold text-white transition-colors"
              style={{ background: "#E8621A" }}
            >
              Sign in
            </button>
          </form>

          <div className="mt-4 text-center">
            <a href="mailto:henleynm@gmail.com?subject=Henley%20Hub%20password%20reset" className="text-sm" style={{ color: "#2563EB" }}>
              Forgot password?
            </a>
          </div>

          <div
            className="mt-8 rounded-lg p-4 text-sm leading-relaxed"
            style={{ background: "#F7F1E5", border: "1px solid rgba(0,0,0,0.08)", color: "#5A616B" }}
          >
            <span className="font-semibold" style={{ color: "#141417" }}>Henley Contracting.</span>{" "}
            Sign in with your work email and password. New here? Ask Nick to send you an invite.
          </div>

          <details className="mt-6">
            <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wider select-none" style={{ color: "#8A8F98" }}>
              Role access — what each login sees
            </summary>
            <ul className="mt-3 space-y-2.5">
              {ROLES.map((r) => (
                <li key={r.email} className="text-sm">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-semibold" style={{ color: "#141417" }}>{r.label}</span>
                    <span className="font-mono text-xs" style={{ color: "#8A8F98" }}>{r.email}</span>
                  </div>
                  <div className="text-xs" style={{ color: "#5A616B" }}>{r.scope}</div>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs" style={{ color: "#8A8F98" }}>
              Demo password for all accounts: <code className="font-mono" style={{ color: "#3A3F47" }}>demo</code>
            </p>
          </details>
        </div>
      </section>
    </main>
  );
}
