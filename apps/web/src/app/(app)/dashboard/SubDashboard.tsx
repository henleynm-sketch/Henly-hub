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
};

export default function SubDashboard({
  projects,
  userName,
}: {
  projects: Project[];
  userName: string;
}) {
  return (
    <>
      <PageHeader
        title={`Welcome, ${userName.split(" ")[0]}`}
        subtitle="Your scopes across active Henley projects."
      />
      <div className="grid gap-6 p-6 md:grid-cols-2">
        {projects.length === 0 && (
          <div className="hh-panel p-6 hh-secondary">No scopes assigned yet.</div>
        )}
        {projects.map((p) => (
          <Link key={p.id} href={`/projects/${p.id}`} className="hh-panel p-6 group">
            <div className="flex items-center justify-between">
              <div className="hh-primary">{p.name}</div>
              <span className="hh-badge">Subcontract</span>
            </div>
            <div className="mt-1 hh-secondary">{p.address ?? "—"}</div>

            <hr className="hh-divider" />
            <div className="grid grid-cols-2 gap-3">
              <div><span className="hh-label block">Start Date</span><span className="hh-primary">{formatDate(p.startDate)}</span></div>
              <div><span className="hh-label block">Target End</span><span className="hh-primary">{formatDate(p.targetEnd)}</span></div>
            </div>

            <div className="mt-4 hh-row hh-caption italic">
              Subs see only their assigned scope, schedule, and documents.
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
