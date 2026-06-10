import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { isInternal } from "@/lib/roles";
import type { Role } from "@/lib/roles";
import { revalidatePath } from "next/cache";
import {
  WorksiteError,
  worksiteCreateTask,
  worksiteListTasks,
  worksiteListUsers,
  worksitePing,
  type WorksiteTask,
  type WorksiteUser,
} from "@/lib/worksite";

const COLUMN_LABELS: Record<string, string> = {
  todo: "Open",
  doing: "In progress",
  done: "Done",
};

function priorityDot(p: string) {
  if (p === "high") return "hh-dot--red";
  if (p === "low") return "hh-dot--blue";
  return "hh-dot--orange";
}

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ mine?: string; error?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");
  const role = session.user.role as Role;
  if (!isInternal(role)) {
    return <div className="p-8 hh-secondary">Tasks are internal to the Henley team.</div>;
  }
  const myEmail = session.user.email ?? "";
  const sp = await searchParams;
  const mineOnly = sp.mine === "1";

  const projects = await prisma.project.findMany({
    where: { status: { notIn: ["COMPLETE"] } },
    orderBy: { updatedAt: "desc" },
    select: { id: true, name: true },
  });
  const projectName = new Map(projects.map((p) => [p.id, p.name]));

  let unreachable: string | null = null;
  let statusEnums: string[] = [];
  let priorityEnums: string[] = [];
  let users: WorksiteUser[] = [];
  let tasks: WorksiteTask[] = [];

  try {
    const [ping, userList, taskList] = await Promise.all([
      worksitePing(),
      worksiteListUsers(),
      worksiteListTasks(),
    ]);
    statusEnums = ping.enums?.status?.length ? ping.enums.status : ["todo", "doing", "done"];
    priorityEnums = ping.enums?.priority?.length ? ping.enums.priority : ["high", "med", "low"];
    users = userList;
    tasks = taskList;
  } catch (err) {
    unreachable = err instanceof WorksiteError ? err.message : "Henley Tasks is unreachable";
    statusEnums = ["todo", "doing", "done"];
    priorityEnums = ["high", "med", "low"];
  }

  const userById = new Map(users.map((u) => [u.id, u]));
  const me = users.find((u) => u.email.toLowerCase() === myEmail.toLowerCase());

  const visible = mineOnly
    ? me
      ? tasks.filter((t) => t.assignees?.includes(me.id))
      : []
    : tasks;

  const defaultColumn = statusEnums[0];
  const byColumn = new Map<string, WorksiteTask[]>(statusEnums.map((s) => [s, []]));
  for (const t of visible) {
    const col = byColumn.has(t.status) ? t.status : defaultColumn;
    byColumn.get(col)!.push(t);
  }

  const canCreate = role === "CEO" || role === "OFFICE";

  async function createTask(formData: FormData) {
    "use server";
    const meSession = await auth();
    if (!meSession?.user) return;
    const r = meSession.user.role as Role;
    if (r !== "CEO" && r !== "OFFICE") return;
    const title = String(formData.get("title") || "").trim();
    const assigneeId = String(formData.get("assigneeId") || "");
    if (!title || !assigneeId) redirect("/tasks?error=Title+and+assignee+are+required");
    try {
      await worksiteCreateTask({
        title,
        desc: String(formData.get("desc") || "") || undefined,
        projectId: String(formData.get("projectId") || "") || undefined,
        assigneeIds: [assigneeId],
        priority: String(formData.get("priority") || "med"),
        due: String(formData.get("due") || "") || undefined,
        creatorEmail: meSession.user.email ?? "",
      });
    } catch (err) {
      const msg = err instanceof WorksiteError ? err.message : "Could not reach Henley Tasks";
      redirect(`/tasks?error=${encodeURIComponent(msg)}`);
    }
    revalidatePath("/tasks");
    revalidatePath("/schedule");
    redirect("/tasks");
  }

  return (
    <>
      <PageHeader
        title="Tasks"
        subtitle="Live from Henley Tasks — one task system across office and field."
        actions={<Link href="/schedule" className="btn-secondary">Week view</Link>}
      />
      <div className="space-y-6 p-6">
        {unreachable && (
          <div className="hh-panel p-4 flex items-center gap-3">
            <span className="hh-dot hh-dot--red" />
            <div>
              <div className="hh-primary">Henley Tasks is unreachable</div>
              <div className="hh-secondary mt-0.5">
                {unreachable} — tasks live at tasks.henleycontracting.com; nothing is stored in the Hub.
              </div>
            </div>
          </div>
        )}
        {sp.error && !unreachable && (
          <div className="hh-panel p-4 flex items-center gap-3">
            <span className="hh-dot hh-dot--red" />
            <div className="hh-secondary">Task was not created: {sp.error}</div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-1.5">
          <Link href="/tasks" className={`hh-badge !ml-0 ${mineOnly ? "opacity-60 hover:opacity-100" : ""}`}>
            All tasks
          </Link>
          <Link href="/tasks?mine=1" className={`hh-badge !ml-0 ${mineOnly ? "" : "opacity-60 hover:opacity-100"}`}>
            Mine
          </Link>
        </div>

        {canCreate && !unreachable && (
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
                <select name="assigneeId" className="input" defaultValue={me?.id ?? ""} required>
                  <option value="" disabled>Select…</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="hh-label block mb-1.5">Due</label>
                <input name="due" type="date" className="input" />
              </div>
              <div className="md:col-span-1">
                <label className="hh-label block mb-1.5">Priority</label>
                <select name="priority" className="input" defaultValue={priorityEnums[1] ?? priorityEnums[0]}>
                  {priorityEnums.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-1">
                <button className="btn btn-primary w-full justify-center" type="submit">Add</button>
              </div>
            </form>
            <p className="hh-caption">
              Creates the task in Henley Tasks under your name. Field crew see it in their app immediately.
            </p>
          </section>
        )}

        {mineOnly && !me && !unreachable && (
          <div className="hh-panel p-6 hh-secondary">
            No Henley Tasks account matches {myEmail} — ask Nick to invite you there to see your tasks.
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-3 items-start">
          {statusEnums.map((status) => {
            const column = byColumn.get(status) ?? [];
            return (
              <section key={status} className="hh-panel p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between px-1">
                  <h2 className="hh-label">{COLUMN_LABELS[status] ?? status}</h2>
                  <span className="hh-secondary">{column.length}</span>
                </div>
                <ul className="space-y-2">
                  {column.length === 0 && (
                    <li className="px-1 py-2 hh-secondary">{unreachable ? "—" : "Nothing here."}</li>
                  )}
                  {column.map((t) => (
                    <li key={t.id} className="hh-row flex-col !items-start !gap-1">
                      <div className="flex items-center gap-2 w-full">
                        <span className={`hh-dot ${priorityDot(t.priority)}`} />
                        <span className="hh-primary flex-1">{t.title}</span>
                      </div>
                      {t.projectId && projectName.has(t.projectId) && (
                        <div className="hh-secondary">{projectName.get(t.projectId)}</div>
                      )}
                      <div className="hh-caption">
                        {(t.assignees ?? [])
                          .map((id) => userById.get(id)?.name ?? "Unknown")
                          .join(", ") || "Unassigned"}
                        {t.due ? ` · due ${t.due}` : ""}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>

        <p className="hh-caption">
          Tasks are managed in Henley Tasks (status changes, edits, completion happen there) — the Hub reads and creates through its API and stores nothing locally.
        </p>
      </div>
    </>
  );
}
