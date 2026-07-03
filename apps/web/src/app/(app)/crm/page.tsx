import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/PageHeader";
import JobsBoard from "@/components/jobs/JobsBoard";
import NewLeadModal from "./NewLeadModal";
import type { BoardJob } from "@/lib/jobBoard";

// CRM pipeline lens — the generalized Jobs board locked to the Sales Pipeline
// axis (one board implementation; the old P2 PipelineBoard is absorbed).
// Cards open the CRM deal page; drag writes pipelineStage through the same
// validated action as /jobs/board. Deal timeline + activity logging live on
// /crm/[id] and are untouched.
export default async function CRMPage() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role ?? "";
  const canEdit = role === "OFFICE" || role === "CEO";

  const projects = await prisma.project.findMany({
    where: { archivedAt: null },
    include: { client: { select: { name: true } } },
    orderBy: { updatedAt: "desc" },
  });

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

  return (
    <>
      <PageHeader title="Sales pipeline" actions={canEdit ? <NewLeadModal /> : undefined} />
      <JobsBoard
        views={[]}
        jobs={jobs}
        canDrag={canEdit}
        isCeo={role === "CEO"}
        userId={session?.user?.id ?? ""}
        lockedGroupBy="pipelineStage"
        cardLinkBase="/crm"
      />
    </>
  );
}
