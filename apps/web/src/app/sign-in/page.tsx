import Link from "next/link";
import { redirect } from "next/navigation";
import { signIn } from "@/auth";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/api/rateLimit";
import { startGoogleSignIn, startMicrosoftSignIn } from "@/lib/actions/oauth";

const demoLogins = [
  { label: "CEO", email: "kyle@henleyhub.com" },
  { label: "Office", email: "morgan@henleyhub.com" },
  { label: "Field", email: "jess@henleyhub.com" },
  { label: "Sub", email: "tile-pro@subs.com" },
  { label: "Client", email: "rachel.t@example.com" },
];

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; callbackUrl?: string; notice?: string }>;
}) {
  const sp = await searchParams;
  const callbackUrl = sp.callbackUrl ?? "/dashboard";

  const [orgName, logoData, logoMime] = await Promise.all([
    prisma.setting.findUnique({ where: { key: "org.name" } }).catch(() => null),
    prisma.setting.findUnique({ where: { key: "org.logoData" } }).catch(() => null),
    prisma.setting.findUnique({ where: { key: "org.logoMime" } }).catch(() => null),
  ]);
  const logoUrl =
    logoData?.value && logoMime?.value ? `data:${logoMime.value};base64,${logoData.value}` : null;

  async function doSignIn(formData: FormData) {
    "use server";
    const email = String(formData.get("email") || "").trim().toLowerCase();
    const password = String(formData.get("password") || "");
    // Per-email throttle reusing the token-bucket pattern.
    const rl = rateLimit(`login:${email}`, "write");
    if (!rl.ok) {
      redirect(`/sign-in?error=rate&callbackUrl=${encodeURIComponent(callbackUrl)}`);
    }
    try {
      await signIn("credentials", { email, password, redirectTo: callbackUrl });
    } catch (err) {
      if ((err as { digest?: string })?.digest?.startsWith("NEXT_REDIRECT")) throw err;
      redirect(`/sign-in?error=invalid&callbackUrl=${encodeURIComponent(callbackUrl)}`);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center p-6">
      <div className="hh-panel w-full max-w-sm p-7 flex flex-col gap-4">
        <div className="flex flex-col items-center gap-2 pb-1">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="h-10 max-w-44 object-contain" />
          ) : (
            <div className="hh-brand-logo" role="img" aria-label="Henley Contracting" />
          )}
          <h1 className="hh-display text-lg font-bold text-ink">
            {orgName?.value ?? "Henley Hub"}
          </h1>
        </div>

        {sp.notice === "signed-out" && (
          <div className="hh-row hh-row--flat">
            <span className="hh-dot hh-dot--green" />
            <span className="hh-secondary">You&apos;re signed out.</span>
          </div>
        )}
        {sp.notice === "reset-done" && (
          <div className="hh-row hh-row--flat">
            <span className="hh-dot hh-dot--green" />
            <span className="hh-secondary">Password updated — sign in with the new one.</span>
          </div>
        )}
        {sp.error && (
          <div className="flex items-start gap-2">
            <span className="hh-dot hh-dot--red mt-1" />
            <span className="hh-secondary">
              {sp.error === "rate"
                ? "Too many attempts — wait a minute and try again."
                : sp.error === "google_unconfigured"
                ? "Google sign-in isn't set up yet — use your email and password for now."
                : sp.error === "microsoft_unconfigured"
                ? "Microsoft sign-in isn't set up yet — use your email and password for now."
                : "That email and password combination didn't work."}
            </span>
          </div>
        )}

        <form action={doSignIn} className="flex flex-col gap-3">
          <div>
            <label className="hh-label block mb-1.5">Email</label>
            <input name="email" type="email" className="input" autoComplete="email" required />
          </div>
          <div>
            <label className="hh-label block mb-1.5">Password</label>
            <input
              name="password"
              type="password"
              className="input"
              autoComplete="current-password"
              required
            />
          </div>
          <button className="btn-primary w-full" type="submit">
            Sign in
          </button>
        </form>

        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-glass-border" />
          <span className="hh-caption">or</span>
          <div className="h-px flex-1 bg-glass-border" />
        </div>
        <form action={startGoogleSignIn}>
          <button className="btn-secondary w-full" type="submit">Continue with Google</button>
        </form>
        <form action={startMicrosoftSignIn}>
          <button className="btn-secondary w-full" type="submit">Continue with Microsoft</button>
        </form>

        <div className="flex items-center justify-between">
          <Link href="/forgot-password" className="hh-secondary text-sm hover:underline">
            Forgot password?
          </Link>
          <Link href="/register" className="hh-secondary text-sm hover:underline">
            Create account
          </Link>
        </div>

        {process.env.NODE_ENV === "development" && (
          <div className="border-t border-glass-border pt-3">
            <div className="hh-caption mb-1.5">Demo users (dev builds only) · password: demo</div>
            <div className="flex flex-wrap gap-1.5">
              {demoLogins.map((d) => (
                <span key={d.email} className="hh-chip" title={d.email}>
                  {d.label}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
