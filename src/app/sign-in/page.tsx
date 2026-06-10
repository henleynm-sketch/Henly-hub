import Link from "next/link";
import { signIn } from "@/auth";
import { redirect } from "next/navigation";

const demoLogins = [
  { email: "kyle@henleyhub.com", role: "CEO / Owner" },
  { email: "morgan@henleyhub.com", role: "Office / Sales" },
  { email: "jess@henleyhub.com", role: "Field crew lead" },
  { email: "tile-pro@subs.com", role: "Subcontractor" },
  { email: "rachel.t@example.com", role: "Client" },
];

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; callbackUrl?: string }>;
}) {
  const sp = await searchParams;
  async function handleSignIn(formData: FormData) {
    "use server";
    const email = String(formData.get("email") || "");
    const password = String(formData.get("password") || "");
    const callbackUrl = String(formData.get("callbackUrl") || "/dashboard");
    try {
      await signIn("credentials", { email, password, redirectTo: callbackUrl });
    } catch (err) {
      if ((err as Error).message?.includes("NEXT_REDIRECT")) throw err;
      redirect(`/sign-in?error=invalid&callbackUrl=${encodeURIComponent(callbackUrl)}`);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-canvas px-6 py-12">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-8 flex items-center gap-2.5 justify-center">
          <div className="grid h-10 w-10 place-items-center rounded-[10px] bg-accent text-white shadow-lg">
            <span className="text-base font-bold tracking-tight">H</span>
          </div>
          <span className="text-xl font-bold tracking-tight text-ink">Henley Hub</span>
        </Link>

        <div className="glass-card p-6">
          <h1 className="text-xl font-bold text-ink">Sign in</h1>
          <p className="mt-1 text-sm text-ink-soft">Enter your hub credentials.</p>

          {sp.error && (
            <div className="mt-4 rounded-[10px] border border-rose-500/20 bg-rose-500/5 px-3 py-2.5 text-sm text-status-error font-medium shadow-sm">
              That email or password didn't match.
            </div>
          )}

          <form action={handleSignIn} className="mt-5 space-y-4">
            <input type="hidden" name="callbackUrl" value={sp.callbackUrl ?? "/dashboard"} />
            <div>
              <label className="label">Email</label>
              <input className="input mt-1.5" name="email" type="email" required autoComplete="email" />
            </div>
            <div>
              <label className="label">Password</label>
              <input
                className="input mt-1.5"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                defaultValue="demo"
              />
            </div>
            <button className="btn btn-primary w-full justify-center mt-2" type="submit">
              Sign in
            </button>
          </form>
        </div>

        <div className="glass-card mt-6 p-6">
          <div className="section-label mb-3">Demo logins (password: demo)</div>
          <ul className="grid gap-2">
            {demoLogins.map((d) => (
              <li key={d.email} className="list-row-item justify-between py-2 px-3 text-xs md:text-sm">
                <span className="font-mono text-ink-soft font-medium">{d.email}</span>
                <span className="text-ink-muted text-xs font-semibold uppercase tracking-wider">{d.role}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </main>
  );
}
