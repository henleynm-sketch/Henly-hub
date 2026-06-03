import Link from "next/link";
import PageHeader, { StatCard } from "@/components/PageHeader";
import { formatMoney, formatRelative } from "@/lib/utils";
import type { Role } from "@/lib/roles";

type Log = {
  id: string;
  notes: string;
  date: Date;
  photos?: string | null;
  project: { id: string; name: string };
  author: { name: string };
};
type ThreadWithLast = {
  id: string;
  subject: string;
  channel: string;
  lastAt: Date;
  unread: number;
  client: { id: string; name: string } | null;
  messages: { body: string }[];
};

export default function OfficeDashboard({
  role,
  clientCount,
  activeProjects,
  pipelineCents,
  openEstimates,
  recentLogs,
  threads,
}: {
  role: Role;
  clientCount: number;
  activeProjects: number;
  pipelineCents: number;
  openEstimates: number;
  recentLogs: Log[];
  threads: ThreadWithLast[];
}) {
  return (
    <>
      <PageHeader
        title={role === "CEO" ? "Owner dashboard" : "Office dashboard"}
        subtitle="Pipeline, projects in flight, and what needs your attention."
        actions={
          <>
            <Link href="/clients/new" className="btn-secondary">New lead</Link>
            <Link href="/estimates/new" className="btn-primary">New estimate</Link>
          </>
        }
      />

      <div className="space-y-6 p-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Active clients" value={String(clientCount)} hint="Across all stages" />
          <StatCard label="Projects in flight" value={String(activeProjects)} tone="good" />
          <StatCard label="Open pipeline" value={formatMoney(pipelineCents)} hint={`${openEstimates} draft + sent estimates`} />
          <StatCard label="QuickBooks" value="Not connected" tone="warn" hint="Connect to push invoices" />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <section className="card lg:col-span-2">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h2 className="text-sm font-semibold">Recent inbox activity</h2>
              <Link href="/inbox" className="text-xs text-brand-600 hover:underline">Open inbox</Link>
            </div>
            <ul className="divide-y divide-slate-100">
              {threads.length === 0 && <li className="p-5 text-sm text-slate-500">Nothing yet.</li>}
              {threads.map((t) => (
                <li key={t.id} className="flex items-start gap-3 px-5 py-3">
                  <ChannelDot channel={t.channel} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">{t.client?.name ?? "Unknown"}</span>
                      <span className="text-xs text-slate-400">· {t.channel.toLowerCase()}</span>
                      {t.unread > 0 && <span className="badge-blue">{t.unread} new</span>}
                    </div>
                    <div className="truncate text-sm text-slate-600">{t.subject}</div>
                    {t.messages[0] && (
                      <div className="mt-0.5 truncate text-xs text-slate-500">{t.messages[0].body}</div>
                    )}
                  </div>
                  <div className="text-xs text-slate-400">{formatRelative(t.lastAt)}</div>
                </li>
              ))}
            </ul>
          </section>

          <section className="card">
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="text-sm font-semibold">Latest daily logs</h2>
            </div>
            <ul className="divide-y divide-slate-100">
              {recentLogs.length === 0 && <li className="p-5 text-sm text-slate-500">No logs yet.</li>}
              {recentLogs.map((l) => {
                let photoUrls: string[] = [];
                if (l.photos) {
                  try {
                    photoUrls = JSON.parse(l.photos);
                  } catch (e) {
                    // Ignore parsing error
                  }
                }
                return (
                  <li key={l.id} className="px-5 py-3">
                    <div className="text-sm font-medium">{l.project.name}</div>
                    <div className="text-xs text-slate-500">
                      {l.author.name} · {formatRelative(l.date)}
                    </div>
                    <div className="mt-1 line-clamp-2 text-sm text-slate-600">{l.notes}</div>
                    {photoUrls.length > 0 && (
                      <div className="mt-1.5 flex gap-1">
                        {photoUrls.slice(0, 5).map((url, idx) => (
                          <div
                            key={idx}
                            className="aspect-square w-8 h-8 overflow-hidden rounded border border-slate-100 bg-slate-50"
                          >
                            <img
                              src={url}
                              alt="Log preview"
                              className="h-full w-full object-cover"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      </div>
    </>
  );
}

function ChannelDot({ channel }: { channel: string }) {
  const tone = {
    EMAIL: "bg-blue-500",
    SMS: "bg-emerald-500",
    IN_APP: "bg-violet-500",
    CALL_NOTE: "bg-amber-500",
  }[channel] ?? "bg-slate-400";
  return <span className={`mt-1.5 h-2 w-2 rounded-full ${tone}`} />;
}
