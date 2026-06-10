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
          <section className="hh-panel p-6 flex flex-col gap-4">
            <div className="pb-3">
              <h2 className="hh-label">Projects</h2>
            </div>
            <ul className="space-y-2">
              {client.projects.length === 0 && (
                <li className="py-2 hh-secondary">No projects yet.</li>
              )}
              {client.projects.map((p) => (
                <li key={p.id} className="hh-row justify-between">
                  <div>
                    <Link href={`/projects/${p.id}`} className="hh-primary">
                      {p.name}
                    </Link>
                    <div className="hh-secondary mt-0.5">
                      {p.address ?? "—"} · Target {formatDate(p.targetEnd)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="hh-primary">{formatMoney(p.contractCents)}</div>
                    <div className="hh-secondary capitalize mt-0.5">{p.status.replace("_", " ").toLowerCase()}</div>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="hh-panel p-6 flex flex-col gap-4">
            <div className="pb-3">
              <h2 className="hh-label">Estimates & contracts</h2>
            </div>
            <ul className="space-y-2">
              {client.estimates.length === 0 && (
                <li className="py-2 hh-secondary">No estimates yet.</li>
              )}
              {client.estimates.map((e) => (
                <li key={e.id} className="hh-row justify-between">
                  <div>
                    <Link href={`/estimates/${e.id}`} className="hh-primary">
                      {e.number} · {e.title}
                    </Link>
                    <div className="hh-secondary mt-0.5">{formatRelative(e.createdAt)}</div>
                  </div>
                  <div className="text-right">
                    <div className="hh-primary">{formatMoney(e.totalCents)}</div>
                    <div className="hh-secondary mt-0.5">{e.status}</div>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="hh-panel p-6 flex flex-col gap-4">
            <div className="pb-3">
              <h2 className="hh-label">Conversations</h2>
            </div>
            <ul className="space-y-2">
              {client.threads.length === 0 && (
                <li className="py-2 hh-secondary">No threads yet.</li>
              )}
              {client.threads.map((t) => (
                <li key={t.id} className="hh-row">
                  <span className={`hh-dot ${channelDot(t.channel)}`} />
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/inbox?threadId=${t.id}`}
                      className="block hh-primary"
                    >
                      {t.subject}
                    </Link>
                    {t.messages[0] && (
                      <div className="truncate hh-secondary mt-0.5">{t.messages[0].body}</div>
                    )}
                  </div>
                  <div className="hh-secondary whitespace-nowrap">{formatRelative(t.lastAt)}</div>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="space-y-6">
          <section className="hh-panel p-6 flex flex-col gap-4">
            <div className="pb-1">
              <h2 className="hh-label">Contact</h2>
            </div>
            <dl className="space-y-3.5 text-sm">
              <Field k="Email" v={client.primaryEmail ?? "—"} />
              <Field k="Phone" v={client.primaryPhone ?? "—"} />
              <Field k="Address" v={client.address ?? "—"} />
              <Field k="Source" v={client.source ?? "—"} />
              <Field k="QB Customer" v={client.qbCustomerId ?? "Not synced"} />
            </dl>
          </section>
          <section className="hh-panel p-6 flex flex-col gap-4">
            <div className="pb-1">
              <h2 className="hh-label">Notes</h2>
            </div>
            <p className="whitespace-pre-wrap hh-secondary">
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
      <dt className="hh-secondary">{k}</dt>
      <dd className="text-right hh-primary">{v}</dd>
    </div>
  );
}

function channelDot(c: string) {
  return {
    EMAIL: "hh-dot--blue",
    SMS: "hh-dot--green",
    IN_APP: "hh-dot--purple",
    CALL_NOTE: "hh-dot--orange",
  }[c] ?? "bg-slate-400";
}
