import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { canViewAllProjects, canManageTeam, type Role } from "@/lib/roles";
import PageHeader from "@/components/PageHeader";
import JobsBoard from "@/components/jobs/JobsBoard";
import { listJobViews } from "@/lib/actions/jobViews";
import type { BoardJob } from "@/lib/jobBoard";

// Generalized Jobs board. Role-scoped: CEO/Office see and drag everything;
// Field/Sub see assigned projects read-only; Client sees only their own.
export default async function JobsBoardPage() {
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

  const [projects, viewsResult] = await Promise.all([
    prisma.project.findMany({
      where: { ...where, archivedAt: null },
      orderBy: { updatedAt: "desc" },
      include: { client: { select: { name: true } } },
    }),
    listJobViews(),
  ]);

  const jobs: BoardJob[] = projects.map((p) => ({
    id: p.id,
    name: p.name,
    code: p.code,
    clientName: p.client.name,
    status: p.status,
    pipelineStage: p.pipelineStage,
    constructionPhase: p.constructionPhase,
    warrantyPhase: p.warrantyPhase,
    division: p.division,
  }));

  const canDrag = role === "CEO" || role === "OFFICE";

  return (
    <div>
      <PageHeader
        title="Board"
        subtitle={
          canDrag
            ? "Drag jobs between columns to reclassify — the No Value column is the triage queue."
            : "Your jobs across the four pipelines (read-only)."
        }
      />
      <JobsBoard
        views={viewsResult.views ?? []}
        jobs={jobs}
        canDrag={canDrag}
        isCeo={canManageTeam(role)}
        userId={userId}
      />
    </div>
  );
}
