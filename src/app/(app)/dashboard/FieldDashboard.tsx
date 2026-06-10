import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { formatDate } from "@/lib/utils";

type Project = {
  id: string;
  name: string;
  address: string | null;
  status: string;
  startDate: Date | null;
  targetEnd: Date | null;
  client: { name: string };
  milestones: { id: string; title: string; status: string; dueDate: Date | null }[];
};

export default function FieldDashboard({
  projects,
  userName,
}: {
  projects: Project[];
  userName: string;
}) {
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  return (
    <>
      <PageHeader
        title={`Hey ${userName.split(" ")[0]}`}
        subtitle={`Today is ${today}. Here are your active jobs.`}
        actions={<Link href="/projects" className="btn-secondary">All my jobs</Link>}
      />
      <div className="grid gap-6 p-6 md:grid-cols-2">
        {projects.length === 0 && (
          <div className="glass-card p-6 text-sm text-ink-soft">You have no projects assigned yet.</div>
        )}
        {projects.map((p) => {
          const next = p.milestones.find((m) => m.status !== "DONE");
          return (
            <Link key={p.id} href={`/projects/${p.id}`} className="glass-card p-6 group">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-ink group-hover:text-accent transition-colors">{p.name}</div>
                <span className={statusBadge(p.status)}>{statusLabel(p.status)}</span>
              </div>
              <div className="mt-1.5 text-xs text-ink-soft">
                {p.client.name} · {p.address ?? "—"}
              </div>
              
              <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-ink-soft border-t border-glass-border pt-3">
                <div><span className="label block text-[10px] text-ink-muted">Start Date</span><span className="text-ink font-medium">{formatDate(p.startDate)}</span></div>
                <div><span className="label block text-[10px] text-ink-muted">Target End</span><span className="text-ink font-medium">{formatDate(p.targetEnd)}</span></div>
              </div>

              {next && (
                <div className="mt-4 rounded-[10px] bg-row-bg border border-glass-border px-4 py-3">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">
                    Next milestone
                  </div>
                  <div className="text-sm font-semibold text-ink mt-0.5">{next.title}</div>
                  {next.dueDate && (
                    <div className="text-xs text-ink-soft mt-0.5">Due {formatDate(next.dueDate)}</div>
                  )}
                </div>
              )}
              
              <div className="mt-4 text-xs text-accent font-semibold flex items-center gap-1 group-hover:translate-x-1 transition-transform duration-200">
                <span>+ Add daily log</span>
                <span>→</span>
              </div>
            </Link>
          );
        })}
      </div>
    </>
  );
}

function statusBadge(s: string) {
  if (s === "IN_PROGRESS") return "badge-green";
  if (s === "PLANNING") return "badge-blue";
  if (s === "ON_HOLD") return "badge-amber";
  if (s === "COMPLETE") return "badge-slate";
  return "badge-slate";
}
function statusLabel(s: string) {
  return s.replace("_", " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}
