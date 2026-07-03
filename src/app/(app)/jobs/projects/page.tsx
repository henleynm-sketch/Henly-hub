import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/roles";
import PageHeader from "@/components/PageHeader";
import NewEngagementForm from "@/components/jobs/NewEngagementForm";

const OPEN_STATUSES = ["OPEN", "WARRANTY", "PRESALE"];

// Projects = client engagements grouping Jobs. Ungrouped jobs are honest:
// they show in the triage line, never auto-assigned.
export default async function EngagementsPage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");
  const role = session.user.role as Role;
  if (role !== "CEO" && role !== "OFFICE") redirect("/dashboard");

  const [engagements, ungrouped, clients] = await Promise.all([
    prisma.engagement.findMany({
      orderBy: { updatedAt: "desc" },
      include: {
        client: { select: { name: true } },
        jobs: { select: { id: true, status: true } },
      },
    }),
    prisma.project.count({ where: { engagementId: null, archivedAt: null } }),
    prisma.client.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <div>
      <PageHeader
        title="Projects"
        subtitle={`${engagements.length} projects · ${ungrouped} jobs not yet in a project`}
      />
      <div className="px-6 pb-8 flex flex-col gap-5 max-w-4xl">
        <NewEngagementForm clients={clients} />

        {engagements.length === 0 ? (
          <div className="hh-panel p-6">
            <span className="hh-secondary">
              No projects yet. Create one above, then attach its jobs — e.g. a design
              job and a construction job under one engagement.
            </span>
          </div>
        ) : (
          <div className="hh-panel overflow-x-auto !p-0">
            <table className="min-w-full text-sm">
              <thead className="border-b border-glass-border">
                <tr>
                  <th className="hh-label px-5 py-3 text-left">Project</th>
                  <th className="hh-label px-5 py-3 text-left">Client</th>
                  <th className="hh-label px-5 py-3 text-left">Status</th>
                  <th className="hh-label px-5 py-3 text-right">Open jobs</th>
                  <th className="hh-label px-5 py-3 text-right">Total jobs</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-glass-border">
                {engagements.map((e) => {
                  const open = e.jobs.filter((j) => OPEN_STATUSES.includes(j.status)).length;
                  return (
                    <tr key={e.id} className="hh-row--flat">
                      <td className="px-5 py-3">
                        <Link href={`/jobs/projects/${e.id}`} className="hh-primary hover:underline">
                          {e.name}
                        </Link>
                      </td>
                      <td className="px-5 py-3 hh-secondary">{e.client.name}</td>
                      <td className="px-5 py-3">
                        <span className={e.status === "ACTIVE" ? "hh-badge hh-badge--success" : "hh-badge"}>
                          {e.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums hh-primary">{open}</td>
                      <td className="px-5 py-3 text-right tabular-nums hh-secondary">{e.jobs.length}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
