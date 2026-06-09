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
          <div className="card p-5 text-sm text-slate-450">You have no projects assigned yet.</div>
        )}
        {projects.map((p) => {
          const next = p.milestones.find((m) => m.status !== "DONE");
          return (
            <Link key={p.id} href={`/projects/${p.id}`} className="card p-5 border border-white/5 hover:border-accent/40 hover:shadow-glass group transition-all">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-white group-hover:text-accent transition-colors">{p.name}</div>
                <span className={statusBadge(p.status)}>{statusLabel(p.status)}</span>
              </div>
              <div className="mt-1.5 text-xs text-slate-400">
                {p.client.name} · {p.address ?? "—"}
              </div>
              
              <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-slate-400 border-t border-white/5 pt-3">
                <div><span className="label block text-[10px] text-slate-500">Start Date</span><span className="text-white font-medium">{formatDate(p.startDate)}</span></div>
                <div><span className="label block text-[10px] text-slate-500">Target End</span><span className="text-white font-medium">{formatDate(p.targetEnd)}</span></div>
              </div>

              {next && (
                <div className="mt-4 rounded-lg bg-accent/10 border border-accent/20 px-3 py-2.5">
                  <div className="text-[9px] font-bold uppercase tracking-wider text-accent">
                    Next milestone
                  </div>
                  <div className="text-sm font-semibold text-white mt-0.5">{next.title}</div>
                  {next.dueDate && (
                    <div className="text-xs text-slate-350 mt-0.5">Due {formatDate(next.dueDate)}</div>
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
