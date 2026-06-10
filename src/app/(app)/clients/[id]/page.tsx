import Link from "next/link";
import { notFound } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import { prisma } from "@/lib/prisma";
import { formatDate, formatMoney, formatRelative } from "@/lib/utils";

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      projects: { orderBy: { updatedAt: "desc" } },
      estimates: { orderBy: { createdAt: "desc" } },
      threads: {
        orderBy: { lastAt: "desc" },
        include: { messages: { take: 1, orderBy: { sentAt: "desc" } } },
      },
    },
  });
  if (!client) notFound();

  return (
    <>
      <PageHeader
        title={client.name}
        subtitle={`${client.stage} · ${client.city ?? "—"}, ${client.state ?? ""}`}
        actions={
          <>
            <Link href={`/inbox?clientId=${client.id}`} className="btn-secondary">Open inbox</Link>
            <Link href={`/estimates/new?clientId=${client.id}`} className="btn-primary">New estimate</Link>
          </>
        }
      />
      <div className="grid gap-6 p-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="glass-card p-6 flex flex-col gap-4">
            <div className="border-b border-glass-border pb-3">
              <h2 className="text-sm font-semibold text-ink">Projects</h2>
            </div>
            <ul className="space-y-2">
              {client.projects.length === 0 && (
                <li className="py-2 text-sm text-ink-soft">No projects yet.</li>
              )}
              {client.projects.map((p) => (
                <li key={p.id} className="flex items-center justify-between rounded-[10px] px-4 py-3 bg-row-bg hover:bg-row-hover transition-colors">
                  <div>
                    <Link href={`/projects/${p.id}`} className="text-sm font-semibold text-ink hover:text-accent transition-colors">
                      {p.name}
                    </Link>
                    <div className="text-xs text-ink-muted mt-0.5">
                      {p.address ?? "—"} · Target {formatDate(p.targetEnd)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-ink">{formatMoney(p.contractCents)}</div>
                    <div className="text-xs text-ink-muted capitalize mt-0.5">{p.status.replace("_", " ").toLowerCase()}</div>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="glass-card p-6 flex flex-col gap-4">
            <div className="border-b border-glass-border pb-3">
              <h2 className="text-sm font-semibold text-ink">Estimates & contracts</h2>
            </div>
            <ul className="space-y-2">
              {client.estimates.length === 0 && (
                <li className="py-2 text-sm text-ink-soft">No estimates yet.</li>
              )}
              {client.estimates.map((e) => (
                <li key={e.id} className="flex items-center justify-between rounded-[10px] px-4 py-3 bg-row-bg hover:bg-row-hover transition-colors">
                  <div>
                    <Link href={`/estimates/${e.id}`} className="text-sm font-semibold text-ink hover:text-accent transition-colors">
                      {e.number} · {e.title}
                    </Link>
                    <div className="text-xs text-ink-muted mt-0.5">{formatRelative(e.createdAt)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-ink">{formatMoney(e.totalCents)}</div>
                    <div className="text-xs text-ink-muted mt-0.5">{e.status}</div>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="glass-card p-6 flex flex-col gap-4">
            <div className="border-b border-glass-border pb-3">
              <h2 className="text-sm font-semibold text-ink">Conversations</h2>
            </div>
            <ul className="space-y-2">
              {client.threads.length === 0 && (
                <li className="py-2 text-sm text-ink-soft">No threads yet.</li>
              )}
              {client.threads.map((t) => (
                <li key={t.id} className="flex items-center gap-3 rounded-[10px] px-4 py-3 bg-row-bg hover:bg-row-hover transition-colors">
                  <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${channelDot(t.channel)}`} />
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/inbox?threadId=${t.id}`}
                      className="block text-sm font-semibold text-ink hover:text-accent transition-colors"
                    >
                      {t.subject}
                    </Link>
                    {t.messages[0] && (
                      <div className="truncate text-xs text-ink-soft mt-0.5">{t.messages[0].body}</div>
                    )}
                  </div>
                  <div className="text-xs text-ink-muted whitespace-nowrap">{formatRelative(t.lastAt)}</div>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="space-y-6">
          <section className="glass-card p-6 flex flex-col gap-4">
            <div className="border-b border-glass-border pb-1">
              <h2 className="text-sm font-semibold text-ink">Contact</h2>
            </div>
            <dl className="space-y-3.5 text-sm">
              <Field k="Email" v={client.primaryEmail ?? "—"} />
              <Field k="Phone" v={client.primaryPhone ?? "—"} />
              <Field k="Address" v={client.address ?? "—"} />
              <Field k="Source" v={client.source ?? "—"} />
              <Field k="QB Customer" v={client.qbCustomerId ?? "Not synced"} />
            </dl>
          </section>
          <section className="glass-card p-6 flex flex-col gap-4">
            <div className="border-b border-glass-border pb-1">
              <h2 className="text-sm font-semibold text-ink">Notes</h2>
            </div>
            <p className="whitespace-pre-wrap text-sm text-ink-soft leading-relaxed">
              {client.notes ?? "No notes yet."}
            </p>
          </section>
        </div>
      </div>
    </>
  );
}

function Field({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-ink-muted font-medium">{k}</dt>
      <dd className="text-right text-ink font-semibold">{v}</dd>
    </div>
  );
}

function channelDot(c: string) {
  return {
    EMAIL: "bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]",
    SMS: "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]",
    IN_APP: "bg-violet-500 shadow-[0_0_8px_rgba(139,92,246,0.5)]",
    CALL_NOTE: "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]",
  }[c] ?? "bg-slate-400";
}
