import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { canViewAllProjects } from "@/lib/roles";
import type { Role } from "@/lib/roles";
import { formatRelative } from "@/lib/utils";

const STAGES = ["LEAD", "QUALIFIED", "PROPOSAL", "WON", "ACTIVE", "PAST", "LOST"];

export default async function ClientsPage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");
  const role = session.user.role as Role;
  if (!canViewAllProjects(role) && role !== "FIELD") {
    return <div className="p-8 text-sm text-slate-500">CRM is only visible to office staff.</div>;
  }

  const clients = await prisma.client.findMany({
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { projects: true, threads: true } } },
  });

  const byStage = STAGES.map((s) => ({
    stage: s,
    items: clients.filter((c) => c.stage === s),
  }));

  return (
    <>
      <PageHeader
        title="CRM"
        subtitle="Every client and lead, with stage and last activity."
        actions={<Link href="/clients/new" className="btn-primary">+ New lead</Link>}
      />
      <div className="space-y-6 p-6">
        <section className="card overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3 text-left font-medium">Client</th>
                <th className="px-5 py-3 text-left font-medium">Stage</th>
                <th className="px-5 py-3 text-left font-medium">Source</th>
                <th className="px-5 py-3 text-left font-medium">Projects</th>
                <th className="px-5 py-3 text-left font-medium">Threads</th>
                <th className="px-5 py-3 text-left font-medium">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {clients.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3">
                    <Link href={`/clients/${c.id}`} className="font-medium text-slate-900 hover:text-brand-700">
                      {c.name}
                    </Link>
                    <div className="text-xs text-slate-500">{c.primaryEmail ?? "—"}</div>
                  </td>
                  <td className="px-5 py-3"><span className={stageBadge(c.stage)}>{c.stage}</span></td>
                  <td className="px-5 py-3 text-slate-600">{c.source ?? "—"}</td>
                  <td className="px-5 py-3 text-slate-600">{c._count.projects}</td>
                  <td className="px-5 py-3 text-slate-600">{c._count.threads}</td>
                  <td className="px-5 py-3 text-slate-500">{formatRelative(c.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Pipeline</h2>
          <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-7">
            {byStage.map((col) => (
              <div key={col.stage} className="rounded-xl bg-slate-100/60 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                    {col.stage}
                  </span>
                  <span className="text-xs text-slate-500">{col.items.length}</span>
                </div>
                <ul className="space-y-2">
                  {col.items.map((c) => (
                    <li key={c.id}>
                      <Link
                        href={`/clients/${c.id}`}
                        className="block rounded-lg bg-white p-3 shadow-sm hover:ring-1 hover:ring-brand-500/30"
                      >
                        <div className="text-sm font-medium">{c.name}</div>
                        <div className="text-xs text-slate-500">{c.city ?? c.source ?? ""}</div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}

function stageBadge(s: string) {
  if (s === "LEAD") return "badge-slate";
  if (s === "QUALIFIED") return "badge-blue";
  if (s === "PROPOSAL") return "badge-violet";
  if (s === "WON" || s === "ACTIVE") return "badge-green";
  if (s === "PAST") return "badge-slate";
  if (s === "LOST") return "badge-red";
  return "badge-slate";
}
