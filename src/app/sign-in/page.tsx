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
    <main className="grid min-h-screen place-items-center bg-slate-50 px-6">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-6 flex items-center gap-2 justify-center">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-brand-600 text-white">
            <span className="text-sm font-bold">H</span>
          </div>
          <span className="text-lg font-semibold">Henley Hub</span>
        </Link>

        <div className="card p-6">
          <h1 className="text-xl font-semibold">Sign in</h1>
          <p className="mt-1 text-sm text-slate-500">Enter your hub credentials.</p>

          {sp.error && (
            <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              That email or password didn't match.
            </div>
          )}

          <form action={handleSignIn} className="mt-5 space-y-3">
            <input type="hidden" name="callbackUrl" value={sp.callbackUrl ?? "/dashboard"} />
            <div>
              <label className="label">Email</label>
              <input className="input mt-1" name="email" type="email" required autoComplete="email" />
            </div>
            <div>
              <label className="label">Password</label>
              <input
                className="input mt-1"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                defaultValue="demo"
              />
            </div>
            <button className="btn-primary w-full justify-center" type="submit">
              Sign in
            </button>
          </form>
        </div>

        <div className="card mt-4 p-5">
          <div className="label">Demo logins (password: demo)</div>
          <ul className="mt-2 grid gap-1 text-sm">
            {demoLogins.map((d) => (
              <li key={d.email} className="flex justify-between">
                <span className="font-mono text-slate-700">{d.email}</span>
                <span className="text-slate-500">{d.role}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </main>
  );
}
