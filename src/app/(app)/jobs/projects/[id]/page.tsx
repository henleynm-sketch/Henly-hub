import Link from "next/link";
import { auth } from "@/auth";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/roles";
import PageHeader from "@/components/PageHeader";
import EngagementJobs from "@/components/jobs/EngagementJobs";

export default async function EngagementDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/sign-in");
  const role = session.user.role as Role;
  if (role !== "CEO" && role !== "OFFICE") redirect("/dashboard");

  const e = await prisma.engagement.findUnique({
    where: { id },
    include: {
      client: { select: { id: true, name: true } },
      jobs: {
        where: { archivedAt: null },
        orderBy: { updatedAt: "desc" },
        select: { id: true, name: true, code: true, status: true, constructionPhase: true },
      },
    },
  });
  if (!e) notFound();

  // Attachable = same client, not archived, not already in a project.
  const attachable = await prisma.project.findMany({
    where: { clientId: e.clientId, engagementId: null, archivedAt: null },
    orderBy: { updatedAt: "desc" },
    select: { id: true, name: true, code: true, status: true },
  });

  return (
    <div>
      <PageHeader
        title={e.name}
        subtitle={`${e.client.name} · ${e.status} · ${e.jobs.length} jobs`}
        actions={
          <Link href={`/clients/${e.client.id}`} className="btn-secondary text-xs">
            View client
          </Link>
        }
      />
      <div className="px-6 pb-8 flex flex-col gap-5 max-w-4xl">
        {e.description && (
          <div className="hh-panel p-5">
            <p className="hh-secondary whitespace-pre-wrap">{e.description}</p>
          </div>
        )}
        <EngagementJobs
          engagementId={e.id}
          jobs={e.jobs}
          attachable={attachable}
        />
      </div>
    </div>
  );
}
