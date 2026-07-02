import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/roles";
import PageHeader from "@/components/PageHeader";
import JobsTable from "@/components/jobs/JobsTable";

export default async function JobsListPage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");
  const role = session.user.role as Role;
  if (role !== "CEO" && role !== "OFFICE") redirect("/dashboard");

  const projects = await prisma.project.findMany({
    where: { archivedAt: null },
    orderBy: [{ code: "desc" }],
    include: { client: { select: { name: true } } },
  });

  return (
    <div>
      <PageHeader
        title="All Jobs"
        subtitle={`${projects.length} jobs`}
        actions={
          <Link href="/projects/new" className="btn-primary text-xs">
            + Job
          </Link>
        }
      />
      <div className="px-6 pb-8">
        <JobsTable
          rows={projects.map((p) => ({
            id: p.id,
            name: p.name,
            clientName: p.client.name,
            address: p.address,
            code: p.code,
            status: p.status,
            pipelineStage: p.pipelineStage,
            constructionPhase: p.constructionPhase,
            jobtread: Boolean(p.jobtreadJobId),
          }))}
        />
      </div>
    </div>
  );
}
