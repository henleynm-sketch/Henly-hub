import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/roles";
import PageHeader from "@/components/PageHeader";
import JobsTable from "@/components/jobs/JobsTable";

const OPEN_STATUSES = ["OPEN", "WARRANTY", "PRESALE"];

export default async function JobsListPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string; bucket?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");
  const role = session.user.role as Role;
  if (role !== "CEO" && role !== "OFFICE") redirect("/dashboard");

  // Read-only drill-through filters from the CRM roll-up columns.
  const sp = await searchParams;
  const clientId = (sp.clientId ?? "").trim() || null;
  const bucket = sp.bucket === "open" || sp.bucket === "closed" ? sp.bucket : null;

  const projects = await prisma.project.findMany({
    where: {
      archivedAt: null,
      ...(clientId ? { clientId } : {}),
      ...(bucket === "open" ? { status: { in: OPEN_STATUSES } } : {}),
      ...(bucket === "closed" ? { status: "CLOSED" } : {}),
    },
    orderBy: [{ code: "desc" }],
    include: { client: { select: { name: true } } },
  });

  const filterClient = clientId ? await prisma.client.findUnique({ where: { id: clientId }, select: { name: true } }) : null;

  return (
    <div>
      <PageHeader
        title={filterClient ? `Jobs — ${filterClient.name}` : "All Jobs"}
        subtitle={`${projects.length} jobs${bucket ? ` · ${bucket}` : ""}${filterClient ? " · filtered from CRM" : ""}`}
        actions={
          <Link href="/projects/new" className="btn-primary text-xs">
            + Job
          </Link>
        }
      />
      <div className="px-6 pb-8 flex flex-col gap-3">
        {(filterClient || bucket) && (
          <div>
            <Link href="/jobs/list" className="btn-ghost text-xs">
              ← Clear filter, show all jobs
            </Link>
          </div>
        )}
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
