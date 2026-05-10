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
        <div className="space-y-4 lg:col-span-2">
          <section className="card">
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="text-sm font-semibold">Projects</h2>
            </div>
            <ul className="divide-y divide-slate-100">
              {client.projects.length === 0 && (
                <li className="px-5 py-4 text-sm text-slate-500">No projects yet.</li>
              )}
              {client.projects.map((p) => (
                <li key={p.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <Link href={`/projects/${p.id}`} className="text-sm font-medium hover:text-brand-700">
                      {p.name}
                    </Link>
                    <div className="text-xs text-slate-500">
                      {p.address ?? "—"} · Target {formatDate(p.targetEnd)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm">{formatMoney(p.contractCents)}</div>
                    <div className="text-xs text-slate-500">{p.status.replace("_", " ").toLowerCase()}</div>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="card">
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="text-sm font-semibold">Estimates & contracts</h2>
            </div>
            <ul className="divide-y divide-slate-100">
              {client.estimates.length === 0 && (
                <li className="px-5 py-4 text-sm text-slate-500">No estimates yet.</li>
              )}
              {client.estimates.map((e) => (
                <li key={e.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <Link href={`/estimates/${e.id}`} className="text-sm font-medium hover:text-brand-700">
                      {e.number} · {e.title}
                    </Link>
                    <div className="text-xs text-slate-500">{formatRelative(e.createdAt)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm">{formatMoney(e.totalCents)}</div>
                    <div className="text-xs text-slate-500">{e.status}</div>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="card">
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="text-sm font-semibold">Conversations</h2>
            </div>
            <ul className="divide-y divide-slate-100">
              {client.threads.length === 0 && (
                <li className="px-5 py-4 text-sm text-slate-500">No threads yet.</li>
              )}
              {client.threads.map((t) => (
                <li key={t.id} className="flex items-center gap-3 px-5 py-3">
                  <span className={`mt-1 h-2 w-2 rounded-full ${channelDot(t.channel)}`} />
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/inbox?threadId=${t.id}`}
                      className="block text-sm font-medium hover:text-brand-700"
                    >
                      {t.subject}
                    </Link>
                    {t.messages[0] && (
                      <div className="truncate text-xs text-slate-500">{t.messages[0].body}</div>
                    )}
                  </div>
                  <div className="text-xs text-slate-400">{formatRelative(t.lastAt)}</div>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="space-y-4">
          <section className="card p-5">
            <h2 className="text-sm font-semibold">Contact</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <Field k="Email" v={client.primaryEmail ?? "—"} />
              <Field k="Phone" v={client.primaryPhone ?? "—"} />
              <Field k="Address" v={client.address ?? "—"} />
              <Field k="Source" v={client.source ?? "—"} />
              <Field k="QB Customer" v={client.qbCustomerId ?? "Not synced"} />
            </dl>
          </section>
          <section className="card p-5">
            <h2 className="text-sm font-semibold">Notes</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">
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
      <dt className="text-slate-500">{k}</dt>
      <dd className="text-right text-slate-800">{v}</dd>
    </div>
  );
}

function channelDot(c: string) {
  return {
    EMAIL: "bg-blue-500",
    SMS: "bg-emerald-500",
    IN_APP: "bg-violet-500",
    CALL_NOTE: "bg-amber-500",
  }[c] ?? "bg-slate-400";
}
