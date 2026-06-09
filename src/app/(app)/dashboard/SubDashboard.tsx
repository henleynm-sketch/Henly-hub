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
          <div className="glass-card p-5 text-sm text-slate-450">No scopes assigned yet.</div>
        )}
        {projects.map((p) => (
          <Link key={p.id} href={`/projects/${p.id}`} className="glass-card p-5 group">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-white group-hover:text-accent transition-colors">{p.name}</div>
              <span className="badge-violet">Subcontract</span>
            </div>
            <div className="mt-1 text-xs text-slate-400">{p.address ?? "—"}</div>
            
            <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-slate-400 border-t border-white/5 pt-3">
              <div><span className="label block text-[10px] text-slate-500">Start Date</span><span className="text-white font-medium">{formatDate(p.startDate)}</span></div>
              <div><span className="label block text-[10px] text-slate-500">Target End</span><span className="text-white font-medium">{formatDate(p.targetEnd)}</span></div>
            </div>
            
            <div className="mt-4 text-xs text-slate-450 leading-relaxed italic bg-white/[0.02] border border-white/5 rounded-md p-2">
              Subs see only their assigned scope, schedule, and documents.
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
