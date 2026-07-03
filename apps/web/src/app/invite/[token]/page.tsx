import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hashToken } from "@/lib/auth-org";
import { acceptInvite } from "@/lib/actions/auth";
import { ROLE_LABELS, type Role } from "@/lib/roles";

export default async function InvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const sp = await searchParams;

  const inv = await prisma.invite
    .findUnique({
      where: { tokenHash: await hashToken(token) },
      include: { organization: { select: { name: true } } },
    })
    .catch(() => null);

  const invalid =
    !inv || inv.revokedAt !== null || inv.acceptedAt !== null || inv.expiresAt < new Date();

  async function submit(formData: FormData) {
    "use server";
    formData.set("token", token);
    const r = await acceptInvite(formData);
    if (r && !r.ok) redirect(`/invite/${token}?error=${encodeURIComponent(r.error ?? "failed")}`);
  }

  return (
    <div className="min-h-screen grid place-items-center p-6">
      <div className="hh-panel w-full max-w-sm p-7 flex flex-col gap-4">
        <h1 className="hh-display text-lg font-bold text-ink">Join Henley Hub</h1>
        {invalid ? (
          <>
            <p className="hh-secondary">
              This invitation is invalid, expired, or already used. Ask your administrator
              to send a fresh one.
            </p>
            <Link href="/sign-in" className="btn-secondary text-center">
              Go to sign in
            </Link>
          </>
        ) : (
          <>
            <div className="hh-row hh-row--flat flex-col !items-start !gap-1">
              <span className="hh-primary">{inv.organization.name}</span>
              <span className="hh-secondary">
                {inv.email} · joining as{" "}
                <span className="hh-primary">{ROLE_LABELS[inv.role as Role] ?? inv.role}</span>
              </span>
            </div>
            {sp.error && (
              <div className="flex items-start gap-2">
                <span className="hh-dot hh-dot--red mt-1" />
                <span className="hh-secondary">{sp.error}</span>
              </div>
            )}
            <form action={submit} className="flex flex-col gap-3">
              <div>
                <label className="hh-label block mb-1.5">Your name</label>
                <input name="name" className="input" autoComplete="name" required />
              </div>
              <div>
                <label className="hh-label block mb-1.5">Password (min 10 characters)</label>
                <input name="password" type="password" className="input" autoComplete="new-password" required minLength={10} />
              </div>
              <div>
                <label className="hh-label block mb-1.5">Confirm password</label>
                <input name="confirm" type="password" className="input" autoComplete="new-password" required minLength={10} />
              </div>
              <button className="btn-primary w-full" type="submit">
                Create account &amp; sign in
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
