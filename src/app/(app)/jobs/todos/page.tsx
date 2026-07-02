import { auth } from "@/auth";
import { redirect } from "next/navigation";
import type { Role } from "@/lib/roles";
import PageHeader from "@/components/PageHeader";
import {
  fetchOpenJobTreadTodos,
  isJobTreadConfigured,
  jobTreadJobUrl,
  type JTTodo,
} from "@/lib/jobtread";
import Link from "next/link";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

// Live view of JobTread to-dos. NOTHING here is persisted — Henley Tasks is
// the task master; this is a window into JobTread, fetched per request.
export default async function JobsTodosPage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");
  const role = session.user.role as Role;
  if (role !== "CEO" && role !== "OFFICE") redirect("/dashboard");

  const configured = await isJobTreadConfigured();

  let todos: JTTodo[] | null = null;
  let error: string | null = null;
  if (configured) {
    try {
      todos = await fetchOpenJobTreadTodos();
    } catch (err) {
      error = err instanceof Error ? err.message : "JobTread request failed";
    }
  }

  const byJob = new Map<string, { jobName: string; jobId: string | null; items: JTTodo[] }>();
  for (const t of todos ?? []) {
    const key = t.jobId ?? "__org__";
    if (!byJob.has(key)) {
      byJob.set(key, { jobName: t.jobName ?? "Organization (no job)", jobId: t.jobId, items: [] });
    }
    byJob.get(key)!.items.push(t);
  }

  return (
    <div>
      <PageHeader
        title="To-Dos"
        subtitle="Live from JobTread — read-only. Henley Tasks remains the task master."
      />
      <div className="px-6 pb-8 flex flex-col gap-5 max-w-4xl">
        {!configured ? (
          <div className="hh-panel p-6">
            <span className="hh-secondary">JobTread is not connected.</span>{" "}
            <Link href="/jobs/connection" className="btn-secondary text-xs ml-2">
              Connection &amp; Sync
            </Link>
          </div>
        ) : error ? (
          <div className="hh-panel p-6 flex items-start gap-2">
            <span className="hh-dot hh-dot--red mt-1" />
            <div>
              <span className="hh-primary">JobTread is unreachable right now.</span>
              <p className="hh-secondary mt-1 break-all">{error}</p>
            </div>
          </div>
        ) : (todos ?? []).length === 0 ? (
          <div className="hh-panel p-6">
            <span className="hh-secondary">No open to-dos in JobTread.</span>
          </div>
        ) : (
          [...byJob.values()].map((group) => (
            <section key={group.jobId ?? "org"} className="hh-panel p-6 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <h2 className="hh-label">{group.jobName}</h2>
                {group.jobId && (
                  <a
                    href={jobTreadJobUrl(group.jobId)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-ghost text-xs"
                  >
                    Open in JobTread ↗
                  </a>
                )}
              </div>
              {group.items.map((t) => (
                <div key={t.id} className="hh-row hh-row--flat !items-start flex-col sm:flex-row sm:!items-center">
                  <div className="flex-1 min-w-0">
                    <span className="hh-primary">{t.name}</span>
                    {t.description && <p className="hh-secondary mt-0.5 line-clamp-1">{t.description}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {t.typeName && <span className="hh-badge">{t.typeName}</span>}
                    {t.assignees.length > 0 && (
                      <span className="hh-secondary">{t.assignees.join(", ")}</span>
                    )}
                    {t.endDate && <span className="hh-secondary">due {formatDate(new Date(t.endDate))}</span>}
                  </div>
                </div>
              ))}
            </section>
          ))
        )}
      </div>
    </div>
  );
}
