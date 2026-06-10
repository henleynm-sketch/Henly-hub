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
          <div className="glass-card p-6 text-sm text-ink-soft">No scopes assigned yet.</div>
        )}
        {projects.map((p) => (
          <Link key={p.id} href={`/projects/${p.id}`} className="glass-card p-6 group">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-ink group-hover:text-accent transition-colors">{p.name}</div>
              <span className="badge-violet">Subcontract</span>
            </div>
            <div className="mt-1 text-xs text-ink-soft">{p.address ?? "—"}</div>
            
            <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-ink-soft border-t border-glass-border pt-3">
              <div><span className="label block text-[10px] text-ink-muted">Start Date</span><span className="text-ink font-medium">{formatDate(p.startDate)}</span></div>
              <div><span className="label block text-[10px] text-ink-muted">Target End</span><span className="text-ink font-medium">{formatDate(p.targetEnd)}</span></div>
            </div>
            
            <div className="mt-4 text-xs text-ink-soft leading-relaxed italic bg-row-bg border border-glass-border rounded-[10px] p-3">
              Subs see only their assigned scope, schedule, and documents.
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
