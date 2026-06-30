import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { isInternal } from "@/lib/roles";
import type { Role } from "@/lib/roles";
import PageHeader from "@/components/PageHeader";
import { listTasks, TASKS_WRITE_BACK_ENABLED } from "@/lib/henleyTasks";
import TaskView from "./TaskView";

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    priority?: string;
    assignee?: string;
    due_before?: string;
    due_after?: string;
    q?: string;
    offset?: string;
    limit?: string;
    view?: string;
  }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");
  const role = session.user.role as Role;
  if (!isInternal(role)) redirect("/dashboard");
  const canCreate = role === "CEO" || role === "OFFICE";

  const sp = await searchParams;
  const view = sp.view === "board" ? "board" : "list";
  const limit = Math.min(Number(sp.limit) || 50, 200);
  const offset = Math.max(Number(sp.offset) || 0, 0);

  // Both views paginate over the same live read; the Hub stores nothing.
  const result = await listTasks({
    status: sp.status || undefined,
    priority: sp.priority || undefined,
    assignee: sp.assignee || undefined,
    due_before: sp.due_before || undefined,
    due_after: sp.due_after || undefined,
    q: sp.q || undefined,
    limit,
    offset,
  });

  // Pass a filterKey so TaskView remounts its filter inputs when URL changes
  const filterKey = [
    sp.status, sp.priority, sp.assignee,
    sp.due_before, sp.due_after, sp.q,
    sp.offset, sp.limit, view,
  ].join("|");

  return (
    <>
      <PageHeader
        title="Tasks"
        subtitle="Live read from Henley Tasks. No task data is stored in the Hub."
      />
      <TaskView
        key={filterKey}
        result={result}
        filters={{
          status: sp.status,
          priority: sp.priority,
          assignee: sp.assignee,
          due_before: sp.due_before,
          due_after: sp.due_after,
          q: sp.q,
        }}
        limit={limit}
        offset={offset}
        view={view}
        canCreate={canCreate}
        writeBackEnabled={TASKS_WRITE_BACK_ENABLED}
      />
    </>
  );
}
