import { prisma } from "@/lib/prisma";
import { unsubscribeToken } from "@/lib/notifications/templates";
import { redirect } from "next/navigation";

/**
 * Public unsubscribe (no auth). GET shows a confirm button so link-scanning
 * mail security tools can't unsubscribe people by prefetching; the server
 * action verifies the HMAC token and records the suppression.
 */
export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; email?: string; done?: string }>;
}) {
  const sp = await searchParams;
  const email = (sp.email ?? "").toLowerCase();
  const token = sp.token ?? "";
  const valid = Boolean(email && token && unsubscribeToken(email) === token);

  async function confirm() {
    "use server";
    if (!valid) return;
    const exists = await prisma.notificationUnsubscribe.findFirst({ where: { email } });
    if (!exists) {
      await prisma.notificationUnsubscribe.create({ data: { email, token, scope: "all" } });
    }
    redirect(`/unsubscribe?done=1&email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}`);
  }

  return (
    <div className="min-h-screen grid place-items-center p-6">
      <div className="hh-panel max-w-md w-full p-6 flex flex-col gap-3">
        <h1 className="hh-display text-xl font-bold text-ink">Email preferences</h1>
        {sp.done ? (
          <p className="hh-secondary">
            {email} is unsubscribed from Henley Hub notification emails. If this was a
            mistake, contact hello@henleycontracting.com.
          </p>
        ) : valid ? (
          <>
            <p className="hh-secondary">
              Stop all Henley Hub notification emails to <span className="hh-primary">{email}</span>?
            </p>
            <form action={confirm}>
              <button className="btn-primary" type="submit">
                Unsubscribe
              </button>
            </form>
          </>
        ) : (
          <p className="hh-secondary">This unsubscribe link is invalid or incomplete.</p>
        )}
      </div>
    </div>
  );
}
