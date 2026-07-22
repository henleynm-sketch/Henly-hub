import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { isPending } from "@/lib/roles";
import SignOutButton from "@/components/SignOutButton";

// Waiting-for-access holding screen. A registered/SSO account with the PENDING
// role can reach nothing but this until the CEO assigns a real role. Lives
// outside the (app) group, so there's no sidebar, nav, or data — by design.
export default async function PendingPage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");
  if (!isPending(session.user.role)) redirect("/dashboard");

  return (
    <div className="min-h-screen grid place-items-center p-6">
      <div className="hh-panel w-full max-w-md p-8 flex flex-col items-center gap-4 text-center">
        <div className="hh-brand-logo" role="img" aria-label="Henley Contracting" />
        <h1 className="hh-display text-xl font-bold text-ink">Waiting for access</h1>
        <p className="hh-secondary">
          Thanks for registering{session.user.name ? `, ${session.user.name}` : ""}. Your account
          is set up but doesn&apos;t have access yet — an administrator needs to assign your role.
          You&apos;ll see the Hub as soon as that&apos;s done.
        </p>
        <p className="hh-caption">Signed in as {session.user.email}</p>
        <div className="pt-1">
          <SignOutButton />
        </div>
      </div>
    </div>
  );
}
