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
      <div className="grid gap-6 p-6 md:grid-cols-2 xl:grid-cols-3">
        {projects.length === 0 && (
          <div className="glass-card p-6 text-sm text-ink-soft">No projects to show.</div>
        )}
        {projects.map((p) => (
          <Link key={p.id} href={`/projects/${p.id}`} className="glass-card p-6">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-ink">{p.name}</div>
                {p.projectType && (
                  <div className="mt-0.5 text-xs text-ink-soft">{p.projectType}</div>
                )}
              </div>
              <span className={statusBadge(p.status)}>{p.status.replace("_", " ").toLowerCase()}</span>
            </div>
            <div className="mt-2 text-xs text-ink-soft">{p.client.name}{p.city ? ` · ${p.city}` : ""}</div>
            {p.currentPhase && (
              <div className="mt-3 rounded-[10px] bg-row-bg border border-glass-border px-3 py-2 text-xs text-ink-soft">
                <span className="font-semibold text-ink">Phase:</span> {p.currentPhase}
              </div>
            )}
            {p.team && (
              <div className="mt-2 text-xs text-ink-soft"><span className="font-semibold text-ink">With:</span> {p.team}</div>
            )}
            <div className="mt-4 grid grid-cols-3 gap-2 text-xs text-ink-soft border-t border-glass-border pt-3">
              {p.contractCents > 0 ? (
                <div><span className="label block text-[10px] text-ink-muted mb-0.5">Contract</span><span className="text-ink font-semibold">{formatMoney(p.contractCents)}</span></div>
              ) : (
                <div><span className="label block text-[10px] text-ink-muted mb-0.5">Milestones</span><span className="text-ink font-semibold">{p._count.milestones}</span></div>
              )}
              <div><span className="label block text-[10px] text-ink-muted mb-0.5">Target</span><span className="text-ink font-semibold">{formatDate(p.targetEnd)}</span></div>
              <div><span className="label block text-[10px] text-ink-muted mb-0.5">Logs</span><span className="text-ink font-semibold">{p._count.dailyLogs}</span></div>
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
