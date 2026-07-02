import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/roles";
import PageHeader, { StatCard } from "@/components/PageHeader";
import { formatRelative } from "@/lib/utils";
import {
  PIPELINE_STAGE,
  CONSTRUCTION_PHASE,
  WARRANTY_PHASE,
} from "@/lib/taxonomy";

// Jobs dashboard — Henley's mini-JobTread home. Every number on this page is
// live from synced data; empty states point at the sync, never at mock data.
export default async function JobsDashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");
  const role = session.user.role as Role;
  if (role !== "CEO" && role !== "OFFICE") redirect("/dashboard");

  const jtWhere = { jobtreadJobId: { not: null } } as const;
  const [total, open, presale, warranty, closed, config] = await Promise.all([
    prisma.project.count({ where: jtWhere }),
    prisma.project.count({ where: { ...jtWhere, status: "OPEN" } }),
    prisma.project.count({ where: { ...jtWhere, status: "PRESALE" } }),
    prisma.project.count({ where: { ...jtWhere, status: "WARRANTY" } }),
    prisma.project.count({ where: { ...jtWhere, status: "CLOSED" } }),
    prisma.jobTreadConfig.findUnique({ where: { id: "singleton" } }).catch(() => null),
  ]);

  const groupCounts = async (field: "pipelineStage" | "constructionPhase" | "warrantyPhase") => {
    const rows = await prisma.project.groupBy({
      by: [field],
      where: { ...jtWhere, [field]: { not: null } },
      _count: { _all: true },
    });
    return new Map(rows.map((r) => [r[field] as string, r._count._all]));
  };
  const [byPipeline, byConstruction, byWarranty] = await Promise.all([
    groupCounts("pipelineStage"),
    groupCounts("constructionPhase"),
    groupCounts("warrantyPhase"),
  ]);

  const recentLogs = await prisma.dailyLog.findMany({
    where: { jobtreadId: { not: null } },
    orderBy: { date: "desc" },
    take: 5,
    include: { project: { select: { id: true, name: true } } },
  });

  const synced = total > 0;

  const axisPanel = (
    title: string,
    canonical: readonly string[],
    counts: Map<string, number>,
  ) => (
    <div className="hh-panel p-6 flex flex-col gap-2">
      <h2 className="hh-label">{title}</h2>
      {canonical.map((v) => (
        <div key={v} className="flex items-center justify-between">
          <span className="hh-secondary">{v}</span>
          <span className="hh-secondary tabular-nums">{counts.get(v) ?? 0}</span>
        </div>
      ))}
    </div>
  );

  return (
    <div>
      <PageHeader
        title="Jobs"
        subtitle={
          config?.lastSyncAt
            ? `Synced from JobTread ${formatRelative(config.lastSyncAt)} · ${total} jobs`
            : "Henley's operating view of every JobTread job."
        }
        actions={
          <Link href="/jobs/connection" className="btn-secondary text-xs">
            Connection & sync
          </Link>
        }
      />

      <div className="px-6 pb-8 flex flex-col gap-5">
        {!synced ? (
          <div className="hh-panel p-6">
            <h2 className="hh-label">No JobTread jobs yet</h2>
            <p className="hh-secondary mt-2">
              Run the first sync to pull the org&apos;s jobs, customers, vendors and daily
              logs into the Hub.
            </p>
            <Link href="/jobs/connection" className="btn-primary text-xs mt-4 inline-block">
              Go to Connection &amp; Sync
            </Link>
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Open" value={String(open)} hint="active jobsites" />
              <StatCard label="Presale" value={String(presale)} hint="pipeline jobs" />
              <StatCard label="Warranty" value={String(warranty)} hint="after-sales care" />
              <StatCard label="Closed" value={String(closed)} hint="completed jobs" />
            </div>

            <div className="grid gap-5 lg:grid-cols-3">
              {axisPanel("Sales Pipeline", PIPELINE_STAGE, byPipeline)}
              {axisPanel("Construction Phase", CONSTRUCTION_PHASE, byConstruction)}
              {axisPanel("Warranty Phase", WARRANTY_PHASE, byWarranty)}
            </div>

            <div className="hh-panel p-6 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <h2 className="hh-label">Recent daily logs</h2>
                <Link href="/jobs/daily-logs" className="btn-ghost text-xs">
                  All logs →
                </Link>
              </div>
              {recentLogs.length === 0 ? (
                <span className="hh-secondary">No synced daily logs yet.</span>
              ) : (
                recentLogs.map((l) => (
                  <Link key={l.id} href={`/projects/${l.project.id}`} className="hh-row hh-row--flat">
                    <span className="hh-primary flex-1">{l.project.name}</span>
                    <span className="hh-secondary">{formatRelative(l.date)}</span>
                  </Link>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
