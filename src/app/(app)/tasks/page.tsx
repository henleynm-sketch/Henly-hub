import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { canViewAllProjects, isInternal } from "@/lib/roles";
import type { Role } from "@/lib/roles";
import { formatDate, formatRelative } from "@/lib/utils";
import { revalidatePath } from "next/cache";

const STATUSES = ["OPEN", "IN_PROGRESS", "DONE"] as const;
const PRIORITIES = ["LOW", "MEDIUM", "HIGH"] as const;

function priorityDot(p: string) {
  if (p === "HIGH") return "hh-dot--red";
  if (p === "LOW") return "hh-dot--blue";
  return "hh-dot--orange";
}

function columnLabel(s: string) {
  if (s === "OPEN") return "Open";
  if (s === "IN_PROGRESS") return "In progress";
  return "Done";
}

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ mine?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");
  const role = session.user.role as Role;
  const userId = session.user.id;
  if (!isInternal(role)) {
    return <div className="p-8 hh-secondary">Tasks are internal to the Henley team.</div>;
  }

  const sp = await searchParams;
  const mineOnly = sp.mine === "1";

  const scopeWhere = canViewAllProjects(role)
    ? {}
    : {
        OR: [
          { assigneeId: userId },
          { createdById: userId },
          { project: { assignments: { some: { userId } } } },
        ],
      };

  const where = mineOnly ? { AND: [scopeWhere, { assigneeId: userId }] } : scopeWhere;

  const [tasks, projects, team] = await Promise.all([
    prisma.task.findMany({
      where,
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
      include: { project: true, assignee: true },
    }),
    prisma.project.findMany({
      where: { status: { notIn: ["COMPLETE"] } },
      orderBy: { updatedAt: "desc" },
      select: { id: true, name: true },
    }),
    prisma.user.findMany({
      where: { role: { not: "CLIENT" } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const canCreate = role === "CEO" || role === "OFFICE" || role === "FIELD";
  const canManage = role === "CEO" || role === "OFFICE";
  const now = new Date();
  const openCount = tasks.filter((t) => t.status !== "DONE").length;
  const overdueCount = tasks.filter(
    (t) => t.status !== "DONE" && t.dueDate && t.dueDate < now
  ).length;

  async function createTask(formData: FormData) {
    "use server";
    const me = await auth();
    if (!me?.user) return;
    const r = me.user.role as Role;
    if (r !== "CEO" && r !== "OFFICE" && r !== "FIELD") return;
    const title = String(formData.get("title") || "").trim();
    if (!title) return;
    const priority = String(formData.get("priority") || "MEDIUM");
    const projectId = String(formData.get("projectId") || "") || null;
    const assigneeId = String(formData.get("assigneeId") || "") || null;
    const due = String(formData.get("dueDate") || "");
    await prisma.task.create({
      data: {
        title,
        priority: (PRIORITIES as readonly string[]).includes(priority) ? priority : "MEDIUM",
        projectId,
        assigneeId,
        dueDate: due ? new Date(`${due}T12:00:00`) : null,
        createdById: me.user.id,
      },
    });
    revalidatePath("/tasks");
    revalidatePath("/schedule");
  }

  async function setTaskStatus(formData: FormData) {
    "use server";
    const me = await auth();
    if (!me?.user || !isInternal(me.user.role as Role)) return;
    const id = String(formData.get("id") || "");
    const status = String(formData.get("status") || "");
    if (!(STATUSES as readonly string[]).includes(status)) return;
    const task = await prisma.task.findUnique({ where: { id } });
    if (!task) return;
    const r = me.user.role as Role;
    const allowed =
      r === "CEO" || r === "OFFICE" || task.assigneeId === me.user.id || task.createdById === me.user.id;
    if (!allowed) return;
    await prisma.task.update({
      where: { id },
      data: { status, completedAt: status === "DONE" ? new Date() : null },
    });
    revalidatePath("/tasks");
    revalidatePath("/schedule");
  }

  async function deleteTask(formData: FormData) {
    "use server";
    const me = await auth();
    if (!me?.user) return;
    const r = me.user.role as Role;
    if (r !== "CEO" && r !== "OFFICE") return;
    const id = String(formData.get("id") || "");
    await prisma.task.delete({ where: { id } }).catch(() => {});
    revalidatePath("/tasks");
    revalidatePath("/schedule");
  }

  return (
    <>
      <PageHeader
        title="Tasks"
        subtitle={`${openCount} open${overdueCount > 0 ? ` · ${overdueCount} overdue` : ""}`}
        actions={
          <Link href="/schedule" className="btn-secondary">Week view</Link>
        }
      />
      <div className="space-y-6 p-6">
        <div className="flex flex-wrap items-center gap-1.5">
          <Link href="/tasks" className={`hh-badge !ml-0 ${mineOnly ? "opacity-60 hover:opacity-100" : ""}`}>
            All tasks
          </Link>
          <Link href="/tasks?mine=1" className={`hh-badge !ml-0 ${mineOnly ? "" : "opacity-60 hover:opacity-100"}`}>
            Mine
          </Link>
        </div>

        {canCreate && (
          <section className="hh-panel p-6 flex flex-col gap-4">
            <h2 className="hh-label">New task</h2>
            <form action={createTask} className="grid gap-3 md:grid-cols-12 md:items-end">
              <div className="md:col-span-4">
                <label className="hh-label block mb-1.5">Title</label>
                <input name="title" className="input" placeholder="Order windows for Vargas addition" required />
              </div>
              <div className="md:col-span-2">
                <label className="hh-label block mb-1.5">Project</label>
                <select name="projectId" className="input" defaultValue="">
                  <option value="">— none —</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="hh-label block mb-1.5">Assignee</label>
                <select name="assigneeId" className="input" defaultValue={userId}>
                  <option value="">Unassigned</option>
                  {team.map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="hh-label block mb-1.5">Due</label>
                <input name="dueDate" type="date" className="input" />
              </div>
              <div className="md:col-span-1">
                <label className="hh-label block mb-1.5">Priority</label>
                <select name="priority" className="input" defaultValue="MEDIUM">
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>{p.toLowerCase()}</option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-1">
                <button className="btn btn-primary w-full justify-center" type="submit">Add</button>
              </div>
            </form>
          </section>
        )}

        <div className="grid gap-6 lg:grid-cols-3 items-start">
          {STATUSES.map((status) => {
            const column = tasks.filter((t) => t.status === status);
            return (
              <section key={status} className="hh-panel p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between px-1">
                  <h2 className="hh-label">{columnLabel(status)}</h2>
                  <span className="hh-secondary">{column.length}</span>
                </div>
                <ul className="space-y-2">
                  {column.length === 0 && (
                    <li className="px-1 py-2 hh-secondary">Nothing here.</li>
                  )}
                  {column.map((t) => {
                    const overdue = t.status !== "DONE" && t.dueDate && t.dueDate < now;
                    return (
                      <li key={t.id} className="hh-row flex-col !items-start !gap-1">
                        <div className="flex items-center gap-2 w-full">
                          <span className={`hh-dot ${priorityDot(t.priority)}`} />
                          <span className="hh-primary flex-1">{t.title}</span>
                          {overdue && <span className="hh-badge hh-badge--danger">overdue</span>}
                        </div>
                        {t.project && (
                          <div className="hh-secondary">{t.project.name}</div>
                        )}
                        <div className="hh-caption">
                          {t.assignee?.name ?? "Unassigned"}
                          {t.dueDate ? ` · due ${formatDate(t.dueDate)}` : ""}
                          {t.status === "DONE" && t.completedAt ? ` · done ${formatRelative(t.completedAt)}` : ""}
                        </div>
                        <div className="mt-1 flex items-center gap-1">
                          {t.status === "OPEN" && (
                            <form action={setTaskStatus}>
                              <input type="hidden" name="id" value={t.id} />
                              <input type="hidden" name="status" value="IN_PROGRESS" />
                              <button className="btn btn-ghost text-xs" type="submit">Start</button>
                            </form>
                          )}
                          {t.status !== "DONE" && (
                            <form action={setTaskStatus}>
                              <input type="hidden" name="id" value={t.id} />
                              <input type="hidden" name="status" value="DONE" />
                              <button className="btn btn-ghost text-xs" type="submit">Done</button>
                            </form>
                          )}
                          {t.status === "DONE" && (
                            <form action={setTaskStatus}>
                              <input type="hidden" name="id" value={t.id} />
                              <input type="hidden" name="status" value="OPEN" />
                              <button className="btn btn-ghost text-xs" type="submit">Reopen</button>
                            </form>
                          )}
                          {canManage && (
                            <form action={deleteTask}>
                              <input type="hidden" name="id" value={t.id} />
                              <button className="btn btn-ghost text-xs" type="submit">Delete</button>
                            </form>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      </div>
    </>
  );
}
