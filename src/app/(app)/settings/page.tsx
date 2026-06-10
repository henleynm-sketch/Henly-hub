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
        <div className="p-6 hh-secondary">Owner access only.</div>
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
      </div>
    </>
  );
}
