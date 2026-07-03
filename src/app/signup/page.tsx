import Link from "next/link";
import { prisma } from "@/lib/prisma";

/**
 * The disabled SaaS door. Setting org.signupsEnabled defaults to false —
 * Henley Hub is invitation-only. The create-organization flow is structural
 * scaffolding for a future multi-tenant brief; no billing, no plans, and it
 * stays unreachable until the flag flips.
 */
export default async function SignupPage() {
  const flag = await prisma.setting
    .findUnique({ where: { key: "org.signupsEnabled" } })
    .catch(() => null);
  const enabled = flag?.value === "true";

  return (
    <div className="min-h-screen grid place-items-center p-6">
      <div className="hh-panel w-full max-w-sm p-7 flex flex-col gap-4">
        <h1 className="hh-display text-lg font-bold text-ink">Henley Hub</h1>
        {!enabled ? (
          <>
            <p className="hh-secondary">
              Henley Hub is invitation-only. If you work with Henley Contracting, ask your
              contact to send you an invite — it arrives by email and sets up your account
              with the right access.
            </p>
            <Link href="/sign-in" className="btn-primary text-center">
              Sign in instead
            </Link>
          </>
        ) : (
          <p className="hh-secondary">
            Organization creation is not available in this build. (Scaffold behind
            org.signupsEnabled — multi-tenant onboarding is a future project.)
          </p>
        )}
      </div>
    </div>
  );
}
