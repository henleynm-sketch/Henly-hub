import { fetchJobTodos, jobTreadJobUrl, type JTTodo } from "@/lib/jobtread";
import { formatDate } from "@/lib/utils";

// Per-job JobTread panel — CEO/Office only, rendered only when the project is
// linked to a JobTread job. To-dos are fetched live and NEVER persisted
// (Henley Tasks is the task master). Fails gracefully when JT is unreachable.
export default async function JobTreadPanel({ jobtreadJobId }: { jobtreadJobId: string }) {
  let todos: JTTodo[] | null = null;
  let error: string | null = null;
  try {
    todos = await fetchJobTodos(jobtreadJobId);
  } catch (err) {
    error = err instanceof Error ? err.message : "JobTread request failed";
  }

  return (
    <section className="hh-panel p-6 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="hh-label">JobTread</h2>
        <a
          href={jobTreadJobUrl(jobtreadJobId)}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-ghost text-xs"
        >
          Open in JobTread ↗
        </a>
      </div>
      {error ? (
        <div className="flex items-start gap-2">
          <span className="hh-dot hh-dot--red mt-1" />
          <div>
            <span className="hh-secondary">JobTread is unreachable right now.</span>
            <p className="hh-caption mt-1 break-all">{error}</p>
          </div>
        </div>
      ) : (todos ?? []).length === 0 ? (
        <span className="hh-secondary">No open to-dos on this job.</span>
      ) : (
        <ul className="space-y-2">
          {todos!.map((t) => (
            <li key={t.id} className="hh-row hh-row--flat !items-start flex-col sm:flex-row sm:!items-center">
              <div className="flex-1 min-w-0">
                <span className="hh-primary">{t.name}</span>
                {t.description && <p className="hh-secondary mt-0.5 line-clamp-1">{t.description}</p>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {t.typeName && <span className="hh-badge">{t.typeName}</span>}
                {t.assignees.length > 0 && <span className="hh-secondary">{t.assignees.join(", ")}</span>}
                {t.endDate && <span className="hh-secondary">due {formatDate(new Date(t.endDate))}</span>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
