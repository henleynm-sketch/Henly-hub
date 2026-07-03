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
          <div className="hh-panel p-6 hh-secondary">You have no projects assigned yet.</div>
        )}
        {projects.map((p) => {
          const next = p.milestones.find((m) => m.status !== "DONE");
          return (
            <Link key={p.id} href={`/projects/${p.id}`} className="hh-panel p-6 group">
              <div className="flex items-center justify-between">
                <div className="hh-primary">{p.name}</div>
                <span className={statusBadge(p.status)}>{statusLabel(p.status)}</span>
              </div>
              <div className="mt-1.5 hh-secondary">
                {p.client.name} · {p.address ?? "—"}
              </div>

              <hr className="hh-divider" />
              <div className="grid grid-cols-2 gap-3">
                <div><span className="hh-label block">Start Date</span><span className="hh-primary">{formatDate(p.startDate)}</span></div>
                <div><span className="hh-label block">Target End</span><span className="hh-primary">{formatDate(p.targetEnd)}</span></div>
              </div>

              {next && (
                <div className="mt-4 hh-row flex-col !items-start !gap-0">
                  <div className="hh-label">
                    Next milestone
                  </div>
                  <div className="hh-primary mt-0.5">{next.title}</div>
                  {next.dueDate && (
                    <div className="hh-secondary mt-0.5">Due {formatDate(next.dueDate)}</div>
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
  if (s === "IN_PROGRESS") return "hh-badge hh-badge--success";
  if (s === "PLANNING") return "hh-badge";
  if (s === "ON_HOLD") return "hh-badge hh-badge--warning";
  if (s === "COMPLETE") return "hh-badge";
  return "hh-badge";
}
function statusLabel(s: string) {
  return s.replace("_", " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}
