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
        {/* Overview Stat Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Active clients" value={String(clientCount)} hint="Across all stages" />
          <StatCard label="Projects in flight" value={String(activeProjects)} tone="good" />
          <StatCard label="Open pipeline" value={formatMoney(pipelineCents)} hint={`${openEstimates} draft + sent estimates`} />
          <StatCard label="QuickBooks" value="Not connected" tone="warn" hint="Connect to push invoices" />
        </div>

        {/* Dashboard Grid */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Inbox Activity */}
          <section className="glass-card lg:col-span-2">
            <div className="flex items-center justify-between border-b border-white/5 px-5 py-4">
              <h2 className="text-sm font-semibold text-white">Recent inbox activity</h2>
              <Link href="/inbox" className="text-xs text-accent hover:text-accent-hover hover:underline transition-colors">Open inbox</Link>
            </div>
            <ul className="divide-y divide-white/5">
              {threads.length === 0 && <li className="p-5 text-sm text-slate-550">Nothing yet.</li>}
              {threads.map((t) => (
                <li key={t.id} className="flex items-start gap-3 px-5 py-3.5 hover:bg-white/[0.02] transition-colors">
                  <ChannelDot channel={t.channel} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold text-white">{t.client?.name ?? "Unknown"}</span>
                      <span className="text-xs text-slate-500 font-medium">· {t.channel.toLowerCase()}</span>
                      {t.unread > 0 && <span className="badge-blue ml-1.5">{t.unread} new</span>}
                    </div>
                    <div className="truncate text-sm text-slate-300 mt-0.5">{t.subject}</div>
                    {t.messages[0] && (
                      <div className="mt-1 truncate text-xs text-slate-450 leading-relaxed">{t.messages[0].body}</div>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 font-medium whitespace-nowrap">{formatRelative(t.lastAt)}</div>
                </li>
              ))}
            </ul>
          </section>

          {/* Daily Logs */}
          <section className="glass-card">
            <div className="border-b border-white/5 px-5 py-4">
              <h2 className="text-sm font-semibold text-white">Latest daily logs</h2>
            </div>
            <ul className="divide-y divide-white/5">
              {recentLogs.length === 0 && <li className="p-5 text-sm text-slate-550">No logs yet.</li>}
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
                  <li key={l.id} className="px-5 py-4 hover:bg-white/[0.02] transition-colors">
                    <div className="text-sm font-semibold text-white">{l.project.name}</div>
                    <div className="text-xs text-slate-500 font-medium mt-0.5">
                      {l.author.name} · {formatRelative(l.date)}
                    </div>
                    <div className="mt-2 line-clamp-2 text-sm text-slate-350 leading-relaxed">{l.notes}</div>
                    {photoUrls.length > 0 && (
                      <div className="mt-3 flex gap-1.5">
                        {photoUrls.slice(0, 5).map((url, idx) => (
                          <div
                            key={idx}
                            className="aspect-square w-8 h-8 overflow-hidden rounded border border-white/10 bg-white/5"
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
    EMAIL: "bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]",
    SMS: "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]",
    IN_APP: "bg-violet-500 shadow-[0_0_8px_rgba(139,92,246,0.5)]",
    CALL_NOTE: "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]",
  }[channel] ?? "bg-slate-400";
  return <span className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${tone}`} />;
}
