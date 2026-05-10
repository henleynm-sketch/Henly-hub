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
      <div className="grid gap-4 p-6 md:grid-cols-2">
        {projects.length === 0 && (
          <div className="card p-5 text-sm text-slate-500">No scopes assigned yet.</div>
        )}
        {projects.map((p) => (
          <Link key={p.id} href={`/projects/${p.id}`} className="card p-5 hover:border-brand-500/50">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">{p.name}</div>
              <span className="badge-violet">Subcontract</span>
            </div>
            <div className="mt-1 text-xs text-slate-500">{p.address ?? "—"}</div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-500">
              <div><span className="label block">Start</span>{formatDate(p.startDate)}</div>
              <div><span className="label block">Target</span>{formatDate(p.targetEnd)}</div>
            </div>
            <div className="mt-3 text-xs text-slate-500">
              Subs see only their assigned scope, schedule, and documents.
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
