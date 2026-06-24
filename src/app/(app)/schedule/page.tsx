import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/PageHeader";
import type { Role } from "@/lib/roles";
import GanttClient from "./GanttClient";

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string }>;
}) {
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user) redirect("/sign-in");

  const role   = session.user.role as Role;
  const userId = session.user.id;
  const isField = role === "FIELD" || role === "SUB";

  // Projects accessible to this user
  const projects = await prisma.project.findMany({
    where: isField
      ? { assignments: { some: { userId } }, archivedAt: null }
      : { archivedAt: null },
    orderBy: { name: "asc" },
    select: { id: true, name: true, client: { select: { name: true } } },
  });

  const projectId = sp.projectId ?? projects[0]?.id ?? null;

  // Tasks for the selected project (field sees only their assigned tasks)
  const tasks = projectId
    ? await prisma.scheduleTask.findMany({
        where: {
          projectId,
          ...(isField ? { assigneeId: userId } : {}),
        },
        include: {
          assignee:  { select: { id: true, name: true } },
          dependsOn: { select: { id: true, name: true } },
        },
        orderBy: [{ order: "asc" }, { startDate: "asc" }],
      })
    : [];

  // Team member list for the assignee picker (managers only)
  const teamMembers =
    role === "CEO" || role === "OFFICE"
      ? await prisma.user.findMany({
          where: { active: true },
          select: { id: true, name: true, role: true },
          orderBy: { name: "asc" },
        })
      : [];

  const selectedProject = projects.find((p) => p.id === projectId) ?? null;

  const serialisedTasks = tasks.map((t) => ({
    id:                   t.id,
    projectId:            t.projectId,
    name:                 t.name,
    startDate:            t.startDate.toISOString(),
    endDate:              t.endDate.toISOString(),
    baselineStartDate:    t.baselineStartDate?.toISOString() ?? null,
    baselineEndDate:      t.baselineEndDate?.toISOString()   ?? null,
    progress:             t.progress,
    assigneeId:           t.assigneeId,
    assigneeName:         t.assignee?.name ?? null,
    dependsOnId:          t.dependsOnId,
    dependsOnName:        t.dependsOn?.name ?? null,
    order:                t.order,
  }));

  return (
    <>
      <PageHeader
        title="Schedule"
        subtitle={
          selectedProject
            ? `${selectedProject.client.name} — ${selectedProject.name}`
            : "Project Gantt timeline with baseline and progress tracking"
        }
      />
      <div className="p-6">
        <GanttClient
          projects={projects}
          selectedProjectId={projectId}
          tasks={serialisedTasks}
          teamMembers={teamMembers}
          role={role}
          userId={userId}
        />
      </div>
    </>
  );
}
