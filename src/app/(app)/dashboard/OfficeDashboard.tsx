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
          <section className="glass-card lg:col-span-2 p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-glass-border pb-3">
              <h2 className="text-sm font-semibold text-ink">Recent inbox activity</h2>
              <Link href="/inbox" className="text-xs text-accent hover:text-accent-hover hover:underline transition-colors font-medium">Open inbox</Link>
            </div>
            <ul className="space-y-2">
              {threads.length === 0 && <li className="py-2 text-sm text-ink-soft">Nothing yet.</li>}
              {threads.map((t) => (
                <li key={t.id} className="flex items-start gap-3 rounded-[10px] px-4 py-3 bg-row-bg hover:bg-row-hover hover:text-ink transition-colors">
                  <ChannelDot channel={t.channel} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold text-ink">{t.client?.name ?? "Unknown"}</span>
                      <span className="text-xs text-ink-muted font-medium">· {t.channel.toLowerCase()}</span>
                      {t.unread > 0 && <span className="badge-blue ml-1.5">{t.unread} new</span>}
                    </div>
                    <div className="truncate text-sm text-ink mt-0.5 font-semibold">{t.subject}</div>
                    {t.messages[0] && (
                      <div className="mt-1 truncate text-xs text-ink-soft leading-relaxed">{t.messages[0].body}</div>
                    )}
                  </div>
                  <div className="text-xs text-ink-muted font-medium whitespace-nowrap">{formatRelative(t.lastAt)}</div>
                </li>
              ))}
            </ul>
          </section>

          {/* Daily Logs */}
          <section className="glass-card p-6 flex flex-col gap-4">
            <div className="border-b border-glass-border pb-3">
              <h2 className="text-sm font-semibold text-ink">Latest daily logs</h2>
            </div>
            <ul className="space-y-2">
              {recentLogs.length === 0 && <li className="py-2 text-sm text-ink-soft">No logs yet.</li>}
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
                  <li key={l.id} className="flex flex-col gap-1 rounded-[10px] px-4 py-3 bg-row-bg hover:bg-row-hover transition-colors">
                    <div className="text-sm font-semibold text-ink">{l.project.name}</div>
                    <div className="text-xs text-ink-muted font-medium mt-0.5">
                      {l.author.name} · {formatRelative(l.date)}
                    </div>
                    <div className="mt-2 line-clamp-2 text-sm text-ink-soft leading-relaxed">{l.notes}</div>
                    {photoUrls.length > 0 && (
                      <div className="mt-3 flex gap-1.5">
                        {photoUrls.slice(0, 5).map((url, idx) => (
                          <div
                            key={idx}
                            className="aspect-square w-8 h-8 overflow-hidden rounded border border-glass-border bg-row-bg"
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
  return <span className={`mt-1.5 h-2.5 w-2.5 rounded-full shrink-0 ${tone}`} />;
}
