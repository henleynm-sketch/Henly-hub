import PageHeader from "@/components/PageHeader";
import { formatDate, formatRelative } from "@/lib/utils";

type Milestone = { id: string; title: string; status: string; dueDate: Date | null };
type Log = { id: string; date: Date; notes: string; author: { name: string } };
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
        <div className="p-6 text-sm text-slate-500">
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
        <div className="card p-5">
          <div className="flex items-end justify-between">
            <div>
              <div className="label">Progress</div>
              <div className="text-2xl font-semibold">{pct}%</div>
              <div className="text-xs text-slate-500">
                {done} of {total} milestones complete
              </div>
            </div>
            <div className="text-right text-xs text-slate-500">
              <div className="label">Target completion</div>
              <div className="text-sm text-slate-700">{formatDate(project.targetEnd)}</div>
            </div>
          </div>
          <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div className="h-full bg-brand-600" style={{ width: `${pct}%` }} />
          </div>
        </div>

        <section className="card">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-sm font-semibold">Milestones</h2>
          </div>
          <ul className="divide-y divide-slate-100">
            {project.milestones.map((m) => (
              <li key={m.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <div className="text-sm font-medium">{m.title}</div>
                  {m.dueDate && (
                    <div className="text-xs text-slate-500">Due {formatDate(m.dueDate)}</div>
                  )}
                </div>
                <span className={milestoneBadge(m.status)}>{milestoneLabel(m.status)}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="card">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-sm font-semibold">Recent updates from the team</h2>
          </div>
          <ul className="divide-y divide-slate-100">
            {project.dailyLogs.length === 0 && (
              <li className="px-5 py-4 text-sm text-slate-500">No updates yet.</li>
            )}
            {project.dailyLogs.map((l) => (
              <li key={l.id} className="px-5 py-3">
                <div className="text-xs text-slate-500">
                  {l.author.name} · {formatRelative(l.date)}
                </div>
                <div className="mt-1 text-sm text-slate-700">{l.notes}</div>
              </li>
            ))}
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
