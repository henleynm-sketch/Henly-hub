import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/PageHeader";
import PipelineBoard from "./PipelineBoard";

export default async function CRMPage() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role ?? "";
  const canEdit = role === "OFFICE" || role === "CEO";

  const projects = await prisma.project.findMany({
    where: { archivedAt: null },
    select: {
      id: true,
      name: true,
      status: true,
      pipelineStage: true,
      jobType: true,
      contractCents: true,
      client: {
        select: { id: true, name: true, leadSource: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <>
      <PageHeader title="Sales pipeline" />
      <PipelineBoard projects={projects} canEdit={canEdit} />
    </>
  );
}
