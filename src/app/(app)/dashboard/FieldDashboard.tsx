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
      <div className="grid gap-4 p-6 md:grid-cols-2">
        {projects.length === 0 && (
          <div className="card p-5 text-sm text-slate-500">You have no projects assigned yet.</div>
        )}
        {projects.map((p) => {
          const next = p.milestones.find((m) => m.status !== "DONE");
          return (
            <Link key={p.id} href={`/projects/${p.id}`} className="card p-5 hover:border-brand-500/50">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">{p.name}</div>
                <span className={statusBadge(p.status)}>{statusLabel(p.status)}</span>
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {p.client.name} · {p.address ?? "—"}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-500">
                <div><span className="label block">Start</span>{formatDate(p.startDate)}</div>
                <div><span className="label block">Target</span>{formatDate(p.targetEnd)}</div>
              </div>
              {next && (
                <div className="mt-4 rounded-lg bg-brand-50 px-3 py-2">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-brand-700">
                    Next milestone
                  </div>
                  <div className="text-sm font-medium text-brand-900">{next.title}</div>
                  {next.dueDate && (
                    <div className="text-xs text-brand-700">Due {formatDate(next.dueDate)}</div>
                  )}
                </div>
              )}
              <div className="mt-3 text-xs text-brand-600">+ Add daily log →</div>
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
