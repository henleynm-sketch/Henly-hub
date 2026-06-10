import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { canManageTeam, ROLE_LABELS, type Role } from "@/lib/roles";
import PageHeader from "@/components/PageHeader";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");
  const role = session.user.role as Role;
  if (!canManageTeam(role)) {
    return (
      <>
        <PageHeader title="Settings" />
        <div className="p-6 text-sm text-ink-muted">Owner access only.</div>
      </>
    );
  }
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    include: { client: true },
  });
  return (
    <>
      <PageHeader
        title="Team & access"
        subtitle="Everyone with a hub login. Roles drive what each person sees."
      />
      <div className="p-6">
        <section className="glass-card overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-row-bg border-b border-glass-border text-xs uppercase tracking-wider text-ink-muted">
              <tr>
                <th className="px-5 py-3.5 text-left font-medium">Name</th>
                <th className="px-5 py-3.5 text-left font-medium">Email</th>
                <th className="px-5 py-3.5 text-left font-medium">Role</th>
                <th className="px-5 py-3.5 text-left font-medium">Focus area</th>
                <th className="px-5 py-3.5 text-left font-medium">Linked client</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-glass-border">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-row-hover transition-colors">
                  <td className="px-5 py-3 text-ink font-semibold">{u.name}</td>
                  <td className="px-5 py-3 text-ink-soft">{u.email}</td>
                  <td className="px-5 py-3 text-ink">{ROLE_LABELS[u.role as Role] ?? u.role}</td>
                  <td className="px-5 py-3 text-ink-soft">{u.focusArea ?? "—"}</td>
                  <td className="px-5 py-3 text-ink-soft">{u.client?.name ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </>
  );
}
