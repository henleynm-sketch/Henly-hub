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
  // Office roles: the Projects surface is the engagement hierarchy under
  // /jobs/projects — this legacy job-card grid stays only as the scoped
  // "my jobs" view for Field/Sub/Client (time clock + dashboards link here).
  if (role === "CEO" || role === "OFFICE") redirect("/jobs/projects");

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
          <div className="hh-panel p-6 hh-secondary">No projects to show.</div>
        )}
        {projects.map((p) => (
          <Link key={p.id} href={`/projects/${p.id}`} className="hh-panel p-6">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="hh-primary truncate">{p.name}</div>
                {p.projectType && (
                  <div className="mt-0.5 hh-secondary">{p.projectType}</div>
                )}
              </div>
              <span className={statusBadge(p.status)}>{p.status.replace("_", " ").toLowerCase()}</span>
            </div>
            <div className="mt-2 hh-secondary">{p.client.name}{p.city ? ` · ${p.city}` : ""}</div>
            {p.currentPhase && (
              <div className="mt-3 hh-row hh-secondary">
                <span className="hh-primary">Phase:</span> {p.currentPhase}
              </div>
            )}
            {p.team && (
              <div className="mt-2 hh-secondary"><span className="hh-primary">With:</span> {p.team}</div>
            )}
            <hr className="hh-divider" />
            <div className="grid grid-cols-3 gap-2">
              {p.contractCents > 0 ? (
                <div><span className="hh-label block mb-0.5">Contract</span><span className="hh-primary">{formatMoney(p.contractCents)}</span></div>
              ) : (
                <div><span className="hh-label block mb-0.5">Milestones</span><span className="hh-primary">{p._count.milestones}</span></div>
              )}
              <div><span className="hh-label block mb-0.5">Target</span><span className="hh-primary">{formatDate(p.targetEnd)}</span></div>
              <div><span className="hh-label block mb-0.5">Logs</span><span className="hh-primary">{p._count.dailyLogs}</span></div>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}

function statusBadge(s: string) {
  if (s === "IN_PROGRESS" || s === "FINISHING") return "hh-badge hh-badge--success";
  if (s === "PERMITTING" || s === "DESIGN") return "hh-badge";
  if (s === "PLANNING") return "hh-badge";
  if (s === "ON_HOLD") return "hh-badge hh-badge--warning";
  if (s === "WARRANTY" || s === "CLOSING") return "hh-badge hh-badge--warning";
  return "hh-badge";
}
