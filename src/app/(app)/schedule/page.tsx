import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { canViewAllProjects, isInternal } from "@/lib/roles";
import type { Role } from "@/lib/roles";

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

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function priorityDot(p: string) {
  if (p === "HIGH") return "hh-dot--red";
  if (p === "LOW") return "hh-dot--blue";
  return "hh-dot--orange";
}

function msBadge(s: string) {
  if (s === "DONE") return "hh-badge hh-badge--success";
  if (s === "BLOCKED") return "hh-badge hh-badge--danger";
  return "hh-badge";
}

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ w?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");
  const role = session.user.role as Role;
  const userId = session.user.id;
  if (!isInternal(role)) {
    return <div className="p-8 hh-secondary">The schedule is internal to the Henley team.</div>;
  }

  const sp = await searchParams;
  const anchor = sp.w ? new Date(`${sp.w}T12:00:00`) : new Date();
  const weekStart = startOfWeek(isNaN(anchor.getTime()) ? new Date() : anchor);
  const weekEnd = addDays(weekStart, 5); // exclusive: Mon..Fri
  const today = new Date();

  const projectScope = canViewAllProjects(role)
    ? {}
    : { assignments: { some: { userId } } };

  const taskScope = canViewAllProjects(role)
    ? {}
    : {
        OR: [
          { assigneeId: userId },
          { createdById: userId },
          { project: { assignments: { some: { userId } } } },
        ],
      };

  const [tasks, milestones] = await Promise.all([
    prisma.task.findMany({
      where: {
        AND: [taskScope, { dueDate: { gte: weekStart, lt: weekEnd } }],
      },
      orderBy: { dueDate: "asc" },
      include: { project: true, assignee: true },
    }),
    prisma.milestone.findMany({
      where: {
        dueDate: { gte: weekStart, lt: weekEnd },
        project: projectScope,
      },
      orderBy: { dueDate: "asc" },
      include: { project: true },
    }),
  ]);

  const days = [0, 1, 2, 3, 4].map((i) => addDays(weekStart, i));
  const weekLabel = weekStart.toLocaleDateString("en-US", { month: "long", day: "numeric" });

  return (
    <>
      <PageHeader
        title="Schedule"
        subtitle={`Week of ${weekLabel} — tasks and milestones across ${canViewAllProjects(role) ? "every project" : "your projects"}.`}
        actions={
          <>
            <Link href={`/schedule?w=${ymd(addDays(weekStart, -7))}`} className="btn-secondary">← Prev</Link>
            <Link href="/schedule" className="btn-secondary">This week</Link>
            <Link href={`/schedule?w=${ymd(addDays(weekStart, 7))}`} className="btn-secondary">Next →</Link>
            <Link href="/tasks" className="btn-primary">Task board</Link>
          </>
        }
      />
      <div className="p-6">
        <div className="grid gap-4 md:grid-cols-5">
          {days.map((day) => {
            const isToday = sameDay(day, today);
            const dayTasks = tasks.filter((t) => t.dueDate && sameDay(t.dueDate, day));
            const dayMilestones = milestones.filter((m) => m.dueDate && sameDay(m.dueDate, day));
            return (
              <section
                key={ymd(day)}
                className={`hh-panel p-4 flex flex-col gap-3 ${isToday ? "border-accent" : ""}`}
              >
                <div className="flex items-baseline justify-between">
                  <span className="hh-label">
                    {day.toLocaleDateString("en-US", { weekday: "short" })}
                  </span>
                  <span className={isToday ? "text-accent font-bold text-lg" : "hh-primary text-lg"}>
                    {day.getDate()}
                  </span>
                </div>
                <hr className="hh-divider" />
                {dayTasks.length === 0 && dayMilestones.length === 0 && (
                  <div className="hh-caption text-center py-2">—</div>
                )}
                <ul className="space-y-2">
                  {dayMilestones.map((m) => (
                    <li key={m.id}>
                      <Link href={`/projects/${m.projectId}`} className="hh-row hh-row--flat flex-col !items-start !gap-1">
                        <span className={`${msBadge(m.status)} !ml-0`}>milestone</span>
                        <span className="hh-primary">{m.title}</span>
                        <span className="hh-caption">{m.project.name}</span>
                      </Link>
                    </li>
                  ))}
                  {dayTasks.map((t) => (
                    <li key={t.id}>
                      <Link href="/tasks" className="hh-row hh-row--flat flex-col !items-start !gap-1">
                        <span className="flex items-center gap-2">
                          <span className={`hh-dot ${priorityDot(t.priority)}`} />
                          <span className="hh-primary">{t.title}</span>
                        </span>
                        <span className="hh-caption">
                          {t.assignee?.name ?? "Unassigned"}
                          {t.project ? ` · ${t.project.name}` : ""}
                          {t.status === "DONE" ? " · done" : ""}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
        <p className="hh-caption mt-6">
          Tasks come from the task board; milestones from each project plan. Henley Tasks sync lands here once the two systems are connected.
        </p>
      </div>
    </>
  );
}
