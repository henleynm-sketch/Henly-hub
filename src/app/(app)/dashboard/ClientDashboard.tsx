import PageHeader from "@/components/PageHeader";
import { formatDate, formatRelative } from "@/lib/utils";

type Milestone = { id: string; title: string; status: string; dueDate: Date | null };
type Log = { id: string; date: Date; notes: string; photos?: string | null; author: { name: string } };
type Project = {
  id: string;
  name: string;
  address: string | null;
  status: string;
  startDate: Date | null;
  targetEnd: Date | null;
  client: { name: string };
  milestones: Milestone[];
  dailyLogs: Log[];
};

export default function ClientDashboard({
  project,
  userName,
}: {
  project: Project | null;
  userName: string;
}) {
  if (!project) {
    return (
      <>
        <PageHeader title={`Welcome, ${userName.split(" ")[0]}`} />
        <div className="p-6 text-sm text-ink-soft">
          We haven't set up your project yet. Your Henley project manager will reach out shortly.
        </div>
      </>
    );
  }

  const total = project.milestones.length || 1;
  const done = project.milestones.filter((m) => m.status === "DONE").length;
  const pct = Math.round((done / total) * 100);

  return (
    <>
      <PageHeader
        title={project.name}
        subtitle={project.address ?? "Your Henley project"}
      />
      <div className="space-y-6 p-6">
        {/* Progress Card */}
        <div className="glass-card p-6">
          <div className="flex items-end justify-between">
            <div>
              <div className="label text-ink-muted">Progress</div>
              <div className="text-2xl font-bold text-ink mt-0.5">{pct}%</div>
              <div className="text-xs text-ink-soft mt-0.5">
                {done} of {total} milestones complete
              </div>
            </div>
            <div className="text-right text-xs text-ink-soft">
              <div className="label text-ink-muted">Target completion</div>
              <div className="text-sm font-semibold text-ink mt-0.5">{formatDate(project.targetEnd)}</div>
            </div>
          </div>
          <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-row-bg">
            <div className="h-full bg-accent shadow-[0_0_8px_rgba(92,124,250,0.5)] rounded-full transition-all duration-500 ease-glass" style={{ width: `${pct}%` }} />
          </div>
        </div>

        {/* Milestones Card */}
        <section className="glass-card p-6 flex flex-col gap-4">
          <div className="border-b border-glass-border pb-3">
            <h2 className="text-sm font-semibold text-ink">Milestones</h2>
          </div>
          <ul className="space-y-2">
            {project.milestones.map((m) => (
              <li key={m.id} className="flex items-center justify-between rounded-[10px] px-4 py-3 bg-row-bg hover:bg-row-hover transition-colors">
                <div>
                  <div className="text-sm font-semibold text-ink">{m.title}</div>
                  {m.dueDate && (
                    <div className="text-xs text-ink-muted mt-0.5">Due {formatDate(m.dueDate)}</div>
                  )}
                </div>
                <span className={milestoneBadge(m.status)}>{milestoneLabel(m.status)}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Recent Updates Card */}
        <section className="glass-card p-6 flex flex-col gap-4">
          <div className="border-b border-glass-border pb-3">
            <h2 className="text-sm font-semibold text-ink">Recent updates from the team</h2>
          </div>
          <ul className="space-y-2">
            {project.dailyLogs.length === 0 && (
              <li className="py-2 text-sm text-ink-soft">No updates yet.</li>
            )}
            {project.dailyLogs.map((l) => {
              let photoUrls: string[] = [];
              if (l.photos) {
                try {
                  photoUrls = JSON.parse(l.photos);
                } catch (e) {
                  // Ignore parsing error
                }
              }
              return (
                <li key={l.id} className="flex flex-col gap-1 rounded-[10px] px-4 py-3 bg-row-bg hover:bg-row-hover transition-colors">
                  <div className="text-xs text-ink-muted font-medium">
                    {l.author.name} · {formatRelative(l.date)}
                  </div>
                  <div className="mt-2 text-sm text-ink-soft leading-relaxed">{l.notes}</div>
                  {photoUrls.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {photoUrls.map((url, idx) => (
                        <a
                          key={idx}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group relative block aspect-square w-16 h-16 md:w-20 md:h-20 overflow-hidden rounded-lg border border-glass-border bg-row-bg shadow-sm"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={url}
                            alt={`Attachment ${idx + 1}`}
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                        </a>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </>
  );
}

function milestoneBadge(s: string) {
  if (s === "DONE") return "badge-green";
  if (s === "IN_PROGRESS") return "badge-blue";
  if (s === "BLOCKED") return "badge-red";
  return "badge-slate";
}
function milestoneLabel(s: string) {
  return s.replace("_", " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}
