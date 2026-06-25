import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { isInternal } from "@/lib/roles";
import type { Role } from "@/lib/roles";
import PageHeader from "@/components/PageHeader";
import { listTasks } from "@/lib/henleyTasks";
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
  }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");
  if (!isInternal(session.user.role as Role)) redirect("/dashboard");

  const sp = await searchParams;
  const limit = Math.min(Number(sp.limit) || 50, 200);
  const offset = Math.max(Number(sp.offset) || 0, 0);

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
    sp.offset, sp.limit,
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
      />
    </>
  );
}
