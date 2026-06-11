import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { canManageTeam, ROLE_LABELS, type Role } from "@/lib/roles";
import PageHeader from "@/components/PageHeader";
import { isM365Configured, syncInbox } from "@/lib/microsoft365";
import { revalidatePath } from "next/cache";
import { formatRelative } from "@/lib/utils";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ synced?: string; syncError?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");
  const role = session.user.role as Role;
  if (!canManageTeam(role)) {
    return (
      <>
        <PageHeader title="Settings" />
        <div className="p-6 hh-secondary">Owner access only.</div>
      </>
    );
  }
  const sp = await searchParams;
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    include: { client: true },
  });
  const m365Ready = isM365Configured();
  let lastSyncAt: Date | null = null;
  try {
    const row = await prisma.setting?.findUnique({ where: { key: "m365LastSync" } });
    if (row?.value) lastSyncAt = new Date(row.value);
  } catch {
    // Setting table not migrated yet — same as never synced.
  }

  async function syncNow() {
    "use server";
    const me = await auth();
    if (!me?.user || !canManageTeam(me.user.role as Role)) return;
    if (!isM365Configured()) return;
    try {
      const result = await syncInbox();
      try {
        await prisma.setting.upsert({
          where: { key: "m365LastSync" },
          update: { value: new Date().toISOString() },
          create: { key: "m365LastSync", value: new Date().toISOString() },
        });
      } catch {
        // Last-sync stamp is best-effort; the sync itself already succeeded.
      }
      revalidatePath("/settings");
      revalidatePath("/inbox");
      redirect(`/settings?synced=${result.fetched}-${result.created}`);
    } catch (err) {
      if ((err as Error).message?.includes("NEXT_REDIRECT")) throw err;
      redirect(`/settings?syncError=${encodeURIComponent((err as Error).message ?? "Sync failed")}`);
    }
  }

  return (
    <>
      <PageHeader
        title="Team & access"
        subtitle="Everyone with a hub login. Roles drive what each person sees."
      />
      <div className="p-6 space-y-6">
        <section className="hh-panel overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b border-glass-border">
              <tr>
                <th className="hh-label px-5 py-3.5 text-left">Name</th>
                <th className="hh-label px-5 py-3.5 text-left">Email</th>
                <th className="hh-label px-5 py-3.5 text-left">Role</th>
                <th className="hh-label px-5 py-3.5 text-left">Focus area</th>
                <th className="hh-label px-5 py-3.5 text-left">Linked client</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-glass-border">
              {users.map((u) => (
                <tr key={u.id} className="hh-row--flat">
                  <td className="px-5 py-3 hh-primary">{u.name}</td>
                  <td className="px-5 py-3 hh-secondary">{u.email}</td>
                  <td className="px-5 py-3 hh-primary">{ROLE_LABELS[u.role as Role] ?? u.role}</td>
                  <td className="px-5 py-3 hh-secondary">{u.focusArea ?? "—"}</td>
                  <td className="px-5 py-3 hh-secondary">{u.client?.name ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="hh-panel p-6 flex flex-col gap-4 max-w-2xl">
          <div className="flex items-center justify-between pb-1">
            <h2 className="hh-label">Microsoft 365</h2>
            {m365Ready ? (
              <span className="hh-badge hh-badge--success">connected</span>
            ) : (
              <span className="hh-badge hh-badge--warning">not configured</span>
            )}
          </div>

          {sp.synced && (
            <div className="hh-row !items-start">
              <span className="hh-dot hh-dot--green mt-1" />
              <span className="hh-secondary">
                Inbox synced — {sp.synced.split("-")[0]} fetched, {sp.synced.split("-")[1]} new messages.
              </span>
            </div>
          )}
          {sp.syncError && (
            <div className="hh-row !items-start">
              <span className="hh-dot hh-dot--red mt-1" />
              <span className="hh-secondary">Sync failed: {sp.syncError}</span>
            </div>
          )}

          {m365Ready ? (
            <>
              <p className="hh-secondary">
                Connected via app credentials. Pulls the shared mailbox into the unified inbox —
                threads dedupe on conversation, messages on message id.
              </p>
              <div className="flex items-center gap-3">
                <form action={syncNow}>
                  <button className="btn btn-primary" type="submit">Sync inbox now</button>
                </form>
                <span className="hh-caption">
                  {lastSyncAt ? `Last sync ${formatRelative(lastSyncAt)}` : "Last sync: never"}
                </span>
              </div>
            </>
          ) : (
            <>
              <p className="hh-secondary">
                Pulls the shared company mailbox into the unified inbox. Needs an Azure AD app
                registration with application permission <code className="hh-chip">Mail.Read</code> and
                admin consent, then these four values in <code className="hh-chip">.env</code>:
              </p>
              <ul className="space-y-1">
                <li><code className="hh-chip">M365_TENANT_ID</code></li>
                <li><code className="hh-chip">M365_CLIENT_ID</code></li>
                <li><code className="hh-chip">M365_CLIENT_SECRET</code></li>
                <li><code className="hh-chip">M365_MAILBOX</code></li>
              </ul>
            </>
          )}
        </section>
      </div>
    </>
  );
}
