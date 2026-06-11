import Link from "next/link";
import PageHeader, { StatCard } from "@/components/PageHeader";
import { prisma } from "@/lib/prisma";
import { formatMoney, formatRelative } from "@/lib/utils";
import type { Role } from "@/lib/roles";

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

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
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

  const [
    clientCount,
    activeProjects,
    pipeline,
    clockedInNow,
    recentLogs,
    recentDocs,
    recentEstimates,
    recentSelections,
    weekMilestones,
    unreadAgg,
    timePending,
    selectionsPending,
    logsThisWeek,
    clientUpdatesThisMonth,
    qboToken,
  ] = await Promise.all([
    prisma.client.count(),
    prisma.project.count({
      where: { status: { in: ["IN_PROGRESS", "FINISHING", "PERMITTING", "DESIGN", "CLOSING"] } },
    }),
    prisma.estimate.aggregate({ _sum: { totalCents: true }, where: { status: { in: ["DRAFT", "SENT"] } } }),
    prisma.timeEntry.count({ where: { clockOut: null } }),
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

  const agendaDays = [0, 1, 2, 3, 4, 5, 6].map((i) => addDays(weekStart, i));
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
        {/* Row 1 — counters */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Active clients" value={String(clientCount)} hint="Across all stages" />
          <StatCard label="Projects in flight" value={String(activeProjects)} tone="good" />
          <StatCard label="Open pipeline" value={formatMoney(pipeline._sum.totalCents ?? 0)} hint="Draft + sent estimates" />
          <StatCard
            label="On the clock now"
            value={String(clockedInNow)}
            tone={clockedInNow > 0 ? "good" : "default"}
            hint={clockedInNow === 1 ? "1 person clocked in" : `${clockedInNow} people clocked in`}
          />
        </div>

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
            {feed.length === 0 && <li className="py-2 hh-secondary">Quiet two weeks — nothing logged.</li>}
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
            <ul className="space-y-1">
              {agendaDays.map((day) => {
                const items = weekMilestones.filter((m) => m.dueDate && sameDay(m.dueDate, day));
                const isToday = sameDay(day, now);
                const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                return (
                  <li key={day.toISOString()} className="hh-row hh-row--flat flex-col !items-start !gap-1">
                    <span className={isToday ? "hh-label text-accent" : "hh-label"}>
                      {day.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                      {isToday ? " · today" : ""}
                    </span>
                    {items.length === 0 ? (
                      <span className="hh-caption">{isWeekend ? "Non-workday" : "—"}</span>
                    ) : (
                      items.map((m) => (
                        <Link key={m.id} href={`/projects/${m.projectId}`} className="hh-secondary">
                          <span className="hh-primary">{m.project.name}</span> · {m.title}
                        </Link>
                      ))
                    )}
                  </li>
                );
              })}
            </ul>
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
