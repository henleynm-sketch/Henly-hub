import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import type { Role } from "@/lib/roles";
import { canViewAllProjects } from "@/lib/roles";
import { formatDate, formatMoney } from "@/lib/utils";

export default async function ProjectsPage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");
  const role = session.user.role as Role;
  const userId = session.user.id;
  const clientId = session.user.clientId;

  const where = canViewAllProjects(role)
    ? {}
    : role === "CLIENT" && clientId
    ? { clientId }
    : { assignments: { some: { userId } } };

  const projects = await prisma.project.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    include: {
      client: true,
      _count: { select: { milestones: true, dailyLogs: true } },
    },
  });

  return (
    <>
      <PageHeader
        title="Projects"
        subtitle={canViewAllProjects(role) ? "Every active and past project." : "Your assigned projects."}
        actions={
          canViewAllProjects(role) ? (
            <Link href="/projects/new" className="btn-primary">+ New project</Link>
          ) : undefined
        }
      />
      <div className="grid gap-4 p-6 md:grid-cols-2 xl:grid-cols-3">
        {projects.length === 0 && (
          <div className="card p-5 text-sm text-slate-500">No projects to show.</div>
        )}
        {projects.map((p) => (
          <Link key={p.id} href={`/projects/${p.id}`} className="card p-5 hover:border-brand-500/50">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{p.name}</div>
                {p.projectType && (
                  <div className="mt-0.5 text-xs text-slate-500">{p.projectType}</div>
                )}
              </div>
              <span className={statusBadge(p.status)}>{p.status.replace("_", " ").toLowerCase()}</span>
            </div>
            <div className="mt-2 text-xs text-slate-500">{p.client.name}{p.city ? ` · ${p.city}` : ""}</div>
            {p.currentPhase && (
              <div className="mt-3 rounded-md bg-slate-50 px-2 py-1.5 text-xs text-slate-700">
                <span className="font-medium">Phase:</span> {p.currentPhase}
              </div>
            )}
            {p.team && (
              <div className="mt-1.5 text-xs text-slate-500"><span className="font-medium">With:</span> {p.team}</div>
            )}
            <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-slate-500">
              {p.contractCents > 0 ? (
                <div><span className="label block">Contract</span>{formatMoney(p.contractCents)}</div>
              ) : (
                <div><span className="label block">Milestones</span>{p._count.milestones}</div>
              )}
              <div><span className="label block">Target</span>{formatDate(p.targetEnd)}</div>
              <div><span className="label block">Logs</span>{p._count.dailyLogs}</div>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}

function statusBadge(s: string) {
  if (s === "IN_PROGRESS" || s === "FINISHING") return "badge-green";
  if (s === "PERMITTING" || s === "DESIGN") return "badge-blue";
  if (s === "PLANNING") return "badge-violet";
  if (s === "ON_HOLD") return "badge-amber";
  if (s === "WARRANTY" || s === "CLOSING") return "badge-amber";
  return "badge-slate";
}
