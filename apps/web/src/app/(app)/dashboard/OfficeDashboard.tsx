import Link from "next/link";
import PageHeader, { StatCard } from "@/components/PageHeader";
import { prisma } from "@/lib/prisma";
import { formatMoney, formatRelative } from "@/lib/utils";
import type { Role } from "@/lib/roles";
import { getDashboardAnalytics } from "@/lib/services/dashboardService";
import { PipelineValueBar, CountDonut, ActivityTrend } from "@/components/dashboard/Charts";

type ActivityKind = "logs" | "estimates" | "selections" | "files";
type ActivityEntry = {
  id: string;
  ts: Date;
  actor: string;
  text: string;
  project: string | null;
  href: string;
  kind: ActivityKind;
};

const ACTIVITY_FILTERS: { key: string; label: string }[] = [
  { key: "all", label: "All" },
  { key: "logs", label: "Daily logs" },
  { key: "estimates", label: "Estimates" },
  { key: "selections", label: "Selections" },
  { key: "files", label: "Files" },
];

function startOfWeek(d: Date) {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  return copy;
}

function addDays(d: Date, n: number) {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}

function fmtDay(d: Date) {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default async function OfficeDashboard({
  role,
  activity = "all",
}: {
  role: Role;
  activity?: string;
}) {
  const now = new Date();
  const cutoff = addDays(now, -14);
  const weekStart = startOfWeek(now);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const analytics = await getDashboardAnalytics();

  const [
    recentLogs,
    recentDocs,
    recentEstimates,
    recentSelections,
    weekMilestones,
    weekScheduleTasks,
    unreadAgg,
    timePending,
    selectionsPending,
    logsThisWeek,
    clientUpdatesThisMonth,
    qboToken,
  ] = await Promise.all([
    prisma.dailyLog.findMany({
      where: { createdAt: { gte: cutoff } },
      orderBy: { createdAt: "desc" },
      take: 25,
      include: { author: true, project: true },
    }),
    prisma.document.findMany({
      where: { createdAt: { gte: cutoff } },
      orderBy: { createdAt: "desc" },
      take: 25,
      include: { uploadedBy: true, project: true },
    }),
    prisma.estimate.findMany({
      where: { updatedAt: { gte: cutoff } },
      orderBy: { updatedAt: "desc" },
      take: 25,
      include: { author: true, client: true },
    }),
    prisma.selection.findMany({
      where: { decidedAt: { gte: cutoff } },
      orderBy: { decidedAt: "desc" },
      take: 25,
      include: { project: true },
    }),
    prisma.milestone.findMany({
      where: { dueDate: { gte: weekStart, lt: addDays(weekStart, 7) } },
      orderBy: { dueDate: "asc" },
      include: { project: true },
    }),
    // Real schedule phases (e.g. seeded from templates) overlapping this week.
    prisma.scheduleTask.findMany({
      where: {
        startDate: { lt: addDays(weekStart, 7) },
        endDate: { gte: weekStart },
        project: { archivedAt: null },
      },
      orderBy: { startDate: "asc" },
      include: { project: { select: { id: true, name: true } } },
      take: 25,
    }),
    prisma.thread.aggregate({ _sum: { unread: true } }),
    prisma.timeEntry.count({ where: { approved: false, clockOut: { not: null } } }),
    prisma.selection.count({ where: { status: "PROPOSED" } }),
    prisma.dailyLog.count({ where: { createdAt: { gte: weekStart } } }),

    prisma.dailyLog.count({ where: { clientVisible: true, createdAt: { gte: monthStart } } }),
    prisma.qBOToken.findUnique({ where: { id: "global" } }).catch(() => null),
  ]);

  const feed: ActivityEntry[] = [
    ...recentLogs.map((l) => ({
      id: `log-${l.id}`,
      ts: l.createdAt,
      actor: l.author.name,
      text: "added a daily log",
      project: l.project.name,
      href: `/projects/${l.projectId}`,
      kind: "logs" as const,
    })),
    ...recentDocs.map((d) => ({
      id: `doc-${d.id}`,
      ts: d.createdAt,
      actor: d.uploadedBy?.name ?? "Someone",
      text: `uploaded ${d.name}`,
      project: d.project?.name ?? null,
      href: "/files",
      kind: "files" as const,
    })),
    ...recentEstimates.map((e) => ({
      id: `est-${e.id}`,
      ts: e.updatedAt,
      actor: e.author.name,
      text: `estimate ${e.number} → ${e.status.toLowerCase()}`,
      project: e.client.name,
      href: `/estimates/${e.id}`,
      kind: "estimates" as const,
    })),
    ...recentSelections.map((s) => ({
      id: `sel-${s.id}`,
      ts: s.decidedAt ?? new Date(0),
      actor: "Client",
      text: `selection ${s.category} ${s.status.toLowerCase()}`,
      project: s.project.name,
      href: `/projects/${s.projectId}`,
      kind: "selections" as const,
    })),
  ]
    .filter((e) => activity === "all" || e.kind === activity)
    .sort((a, b) => b.ts.getTime() - a.ts.getTime())
    .slice(0, 25);

  const hasAgenda = weekScheduleTasks.length > 0 || weekMilestones.length > 0;
  const unreadTotal = unreadAgg._sum.unread ?? 0;

  return (
    <>
      <PageHeader
        title={role === "CEO" ? "Owner dashboard" : "Office dashboard"}
        subtitle="Pipeline, projects in flight, and what needs your attention."
        actions={
          <>
            <Link href="/clients/new" className="btn-secondary">New lead</Link>
            <Link href="/estimates/new" className="btn-primary">New estimate</Link>
          </>
        }
      />

      <div className="space-y-6 p-6">
        {/* Row 1 — counters (real derived numbers via dashboardService) */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Active clients"
            value={String(analytics.kpis.activeClients)}
            hint={`with an open job · ${analytics.kpis.totalClients} total`}
          />
          <StatCard
            label="Jobs in flight"
            value={String(analytics.kpis.jobsInFlight)}
            tone="good"
            hint="open + presale + warranty"
          />
          <StatCard
            label="Open pipeline"
            value={formatMoney(analytics.kpis.openPipelineCents)}
            hint="Draft + sent estimates"
          />
          <StatCard
            label="On the clock now"
            value={String(analytics.kpis.clockedInNow)}
            tone={analytics.kpis.clockedInNow > 0 ? "good" : "default"}
            hint={analytics.kpis.clockedInNow === 1 ? "1 person clocked in" : `${analytics.kpis.clockedInNow} people clocked in`}
          />
        </div>

        {/* Analytics grid — every number reconciles with its source surface */}
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="hh-panel p-6">
            <div className="flex items-center justify-between pb-2">
              <h2 className="hh-label">Pipeline value by stage</h2>
              <Link href="/jobs/board" className="btn-ghost text-xs">Board →</Link>
            </div>
            <p className="hh-caption pb-2">
              Open estimate $ attributed to each client&apos;s most-advanced staged job
              {analytics.unstagedPipelineCents > 0
                ? ` · ${formatMoney(analytics.unstagedPipelineCents)} unstaged`
                : ""}
            </p>
            <PipelineValueBar data={analytics.pipelineByStage} />
          </section>

          <section className="hh-panel p-6">
            <div className="flex items-center justify-between pb-2">
              <h2 className="hh-label">Jobs by construction phase</h2>
              <Link href="/jobs/board" className="btn-ghost text-xs">Board →</Link>
            </div>
            {analytics.byConstructionPhase.some((s) => s.count > 0) ? (
              <CountDonut data={analytics.byConstructionPhase} />
            ) : (
              <p className="hh-secondary py-8">No jobs carry a construction phase yet.</p>
            )}
          </section>

          <section className="hh-panel p-6">
            <h2 className="hh-label pb-2">Jobs by status &amp; division</h2>
            <div className="grid grid-cols-2 gap-2">
              <CountDonut data={analytics.byStatus} height={190} />
              {analytics.byDivision.some((s) => s.count > 0) ? (
                <CountDonut data={analytics.byDivision} height={190} />
              ) : (
                <p className="hh-secondary self-center">No division set on any job yet.</p>
              )}
            </div>
          </section>

          <section className="hh-panel p-6">
            <h2 className="hh-label pb-2">Activity — last 8 weeks</h2>
            <ActivityTrend data={analytics.activityTrend} />
          </section>

          <section className="hh-panel p-6 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h2 className="hh-label">Warranty</h2>
              <Link href="/jobs/board" className="btn-ghost text-xs">Warranty view →</Link>
            </div>
            {analytics.warrantyByPhase.some((s) => s.count > 0) ? (
              analytics.warrantyByPhase
                .filter((s) => s.count > 0)
                .map((s) => (
                  <div key={s.label} className="flex items-center justify-between">
                    <span className="hh-secondary">{s.label}</span>
                    <span className="hh-primary tabular-nums">{s.count}</span>
                  </div>
                ))
            ) : (
              <p className="hh-secondary">No jobs in a warranty phase.</p>
            )}
          </section>

          <section className="hh-panel p-6 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h2 className="hh-label">Vendor compliance</h2>
              <Link href="/vendors" className="btn-ghost text-xs">Vendors →</Link>
            </div>
            <div className="flex items-center justify-between">
              <span className="hh-secondary">Missing W-9</span>
              <span className="hh-primary tabular-nums">{analytics.vendorCompliance.missingW9}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="hh-secondary">COI expiring in 30 days</span>
              <span className="hh-primary tabular-nums">{analytics.vendorCompliance.expiringSoon}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="hh-secondary">COI expired</span>
              <span className="hh-primary tabular-nums">{analytics.vendorCompliance.expired}</span>
            </div>
            <hr className="hh-divider" />
            <div className="flex items-center justify-between">
              <h2 className="hh-label">Henley Tasks</h2>
              <Link href="/tasks" className="btn-ghost text-xs">Tasks →</Link>
            </div>
            {analytics.tasks.ok ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="hh-secondary">Open</span>
                  <span className="hh-primary tabular-nums">{analytics.tasks.open}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="hh-secondary">Due today</span>
                  <span className="hh-primary tabular-nums">{analytics.tasks.dueToday}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="hh-secondary">Overdue</span>
                  <span className={analytics.tasks.overdue > 0 ? "hh-primary tabular-nums" : "hh-secondary tabular-nums"}>
                    {analytics.tasks.overdue}
                  </span>
                </div>
              </>
            ) : (
              <p className="hh-secondary">Henley Tasks unavailable right now.</p>
            )}
          </section>
        </div>

        <section className="hh-panel overflow-x-auto">
          <div className="border-b border-glass-border px-6 py-4">
            <h2 className="hh-label">This month vs last</h2>
          </div>
          <table className="min-w-full text-sm">
            <thead className="border-b border-glass-border">
              <tr>
                <th className="hh-label px-5 py-3 text-left">Metric</th>
                <th className="hh-label px-5 py-3 text-right">This month</th>
                <th className="hh-label px-5 py-3 text-right">Last month</th>
                <th className="hh-label px-5 py-3 text-right">Δ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-glass-border">
              {analytics.comparison.map((r) => {
                const d = r.thisMonth - r.lastMonth;
                return (
                  <tr key={r.metric} className="hh-row--flat">
                    <td className="px-5 py-3 hh-primary">{r.metric}</td>
                    <td className="px-5 py-3 text-right tabular-nums hh-primary">{r.thisMonth}</td>
                    <td className="px-5 py-3 text-right tabular-nums hh-secondary">{r.lastMonth}</td>
                    <td className={`px-5 py-3 text-right tabular-nums ${d > 0 ? "hh-primary" : "hh-secondary"}`}>
                      {d === 0 ? "—" : d > 0 ? `+${d}` : String(d)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        {/* Row 2 — activity feed */}
        <section className="hh-panel p-6 flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <h2 className="hh-label">Recent activity · last 14 days</h2>
            <div className="flex items-center gap-1.5 overflow-x-auto touch-scroll">
              {ACTIVITY_FILTERS.map((f) => (
                <Link
                  key={f.key}
                  href={f.key === "all" ? "/dashboard" : `/dashboard?activity=${f.key}`}
                  className={`hh-badge !ml-0 ${activity === f.key ? "" : "opacity-60 hover:opacity-100"}`}
                >
                  {f.label}
                </Link>
              ))}
            </div>
          </div>
          <ul className="space-y-1">
            {feed.length === 0 && (
              <li className="py-2 flex flex-col gap-1">
                <span className="hh-secondary">Quiet two weeks — nothing logged.</span>
                <Link href="/projects" className="hh-caption text-accent hover:underline">
                  Log activity from a project →
                </Link>
              </li>
            )}
            {feed.map((e) => (
              <li key={e.id}>
                <Link href={e.href} className="hh-row hh-row--flat !gap-3">
                  <span className="hh-secondary flex-1 min-w-0 truncate">
                    <span className="hh-primary">{e.actor}</span> {e.text}
                    {e.project ? <span className="hh-caption"> on {e.project}</span> : null}
                  </span>
                  <span className="hh-caption whitespace-nowrap">{formatRelative(e.ts)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* Row 3 — agenda + action items */}
        <div className="grid gap-6 lg:grid-cols-2 items-start">
          <section className="hh-panel p-6 flex flex-col gap-3">
            <h2 className="hh-label">This week&apos;s agenda</h2>
            {!hasAgenda ? (
              <div className="flex flex-col gap-1 py-2">
                <span className="hh-secondary">Nothing scheduled this week.</span>
                <Link href="/schedule" className="hh-caption text-accent hover:underline">
                  Apply a template on a job to build the schedule →
                </Link>
              </div>
            ) : (
              <ul className="space-y-1">
                {weekScheduleTasks.map((t) => (
                  <li key={`st-${t.id}`}>
                    <Link href={`/schedule?projectId=${t.projectId}`} className="hh-row hh-row--flat !gap-3">
                      <span className="hh-dot hh-dot--blue" />
                      <span className="hh-secondary flex-1 min-w-0 truncate">
                        <span className="hh-primary">{t.project.name}</span> · {t.name}
                      </span>
                      <span className="hh-caption whitespace-nowrap">
                        {fmtDay(t.startDate)} – {fmtDay(t.endDate)}
                      </span>
                    </Link>
                  </li>
                ))}
                {weekMilestones.map((m) => (
                  <li key={`ms-${m.id}`}>
                    <Link href={`/projects/${m.projectId}`} className="hh-row hh-row--flat !gap-3">
                      <span className="hh-dot hh-dot--purple" />
                      <span className="hh-secondary flex-1 min-w-0 truncate">
                        <span className="hh-primary">{m.project.name}</span> · {m.title}
                      </span>
                      <span className="hh-caption whitespace-nowrap">
                        {m.dueDate ? fmtDay(m.dueDate) : ""}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="hh-panel p-6 flex flex-col gap-3">
            <h2 className="hh-label">Action items for you</h2>
            <ul className="space-y-1">
              <li>
                <Link href="/inbox" className="hh-row !gap-3">
                  <span className="hh-dot hh-dot--blue" />
                  <span className="hh-secondary flex-1">Unread messages</span>
                  <span className="hh-primary">{unreadTotal}</span>
                </Link>
              </li>
              <li>
                <Link href="/projects" className="hh-row !gap-3">
                  <span className="hh-dot hh-dot--orange" />
                  <span className="hh-secondary flex-1">Time entries awaiting approval</span>
                  <span className="hh-primary">{timePending}</span>
                </Link>
              </li>
              <li>
                <Link href="/projects" className="hh-row !gap-3">
                  <span className="hh-dot hh-dot--purple" />
                  <span className="hh-secondary flex-1">Selections needing a decision</span>
                  <span className="hh-primary">{selectionsPending}</span>
                </Link>
              </li>
            </ul>
          </section>
        </div>

        {/* Row 4 — weekly counters + QuickBooks */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <StatCard label="Daily logs this week" value={String(logsThisWeek)} />
          <StatCard label="Client updates this month" value={String(clientUpdatesThisMonth)} hint="Client-visible logs" />
          <StatCard
            label="QuickBooks"
            value={qboToken ? "Connected" : "Not connected"}
            tone={qboToken ? "good" : "warn"}
            hint={qboToken ? `Realm ${qboToken.realmId}` : "Connect to push invoices"}
          />
        </div>
      </div>
    </>
  );
}
