import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import PageHeader from "@/components/PageHeader";
import { prisma } from "@/lib/prisma";
import { formatDate, formatMoney, formatRelative } from "@/lib/utils";
import ClientActivityLogger from "./ClientActivityLogger";
import ProjectCodeEditor from "@/components/ProjectCodeEditor";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const role =
    (session?.user as { role?: string } | undefined)?.role ?? "";
  const canEdit = role === "OFFICE" || role === "CEO";

  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      projects: { orderBy: { updatedAt: "desc" } },
      estimates: { orderBy: { createdAt: "desc" } },
      threads: {
        orderBy: { lastAt: "desc" },
        include: { messages: { take: 1, orderBy: { sentAt: "desc" } } },
      },
      crmActivities: {
        orderBy: { occurredAt: "desc" },
        include: { author: { select: { name: true } } },
      },
    },
  });
  if (!client) notFound();

  async function toggleEmailOptOut() {
    "use server";
    const { auth } = await import("@/auth");
    const { prisma } = await import("@/lib/prisma");
    const { revalidatePath } = await import("next/cache");
    const me = await auth();
    const role = (me?.user as { role?: string } | undefined)?.role;
    if (role !== "CEO" && role !== "OFFICE") return;
    const cur = await prisma.client.findUnique({ where: { id } });
    if (!cur) return;
    await prisma.client.update({ where: { id }, data: { emailOptOut: !cur.emailOptOut } });
    revalidatePath(`/clients/${id}`);
  }

  return (
    <>
      <PageHeader
        title={client.name}
        subtitle={`${client.stage} · ${client.city ?? "—"}, ${
          client.state ?? ""
        }`}
        actions={
          <>
            <Link
              href={`/inbox?clientId=${client.id}`}
              className="btn-secondary"
            >
              Open inbox
            </Link>
            <Link
              href={`/estimates/new?clientId=${client.id}`}
              className="btn-primary"
            >
              New estimate
            </Link>
          </>
        }
      />
      <div className="grid gap-6 p-6 lg:grid-cols-3">
        {/* ── Left: activity + projects + estimates + conversations ── */}
        <div className="space-y-6 lg:col-span-2">
          {/* Activity logger */}
          {canEdit && <ClientActivityLogger clientId={client.id} />}

          {/* Activity timeline */}
          {client.crmActivities.length > 0 && (
            <section className="hh-panel p-6 flex flex-col gap-4">
              <form action={toggleEmailOptOut} className="flex items-center justify-between gap-2">
                <span className="hh-secondary">
                  Notification emails {client.emailOptOut ? "OFF for this client" : "on (estimates, contracts, site updates)"}
                </span>
                <button className="btn-secondary text-xs" type="submit">
                  {client.emailOptOut ? "Re-enable" : "Opt out"}
                </button>
              </form>
              <div className="pb-1">
                <h2 className="hh-label">Activity timeline</h2>
              </div>
              <ul className="space-y-5">
                {client.crmActivities.map((a) => (
                  <li key={a.id} className="flex gap-3">
                    <span
                      className={`mt-1.5 shrink-0 w-2 h-2 rounded-full ${activityDot(
                        a.type
                      )}`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <span className="text-xs font-semibold uppercase tracking-wide text-[var(--hh-muted)]">
                          {a.type}
                        </span>
                        <span className="hh-secondary text-xs">
                          {formatRelative(a.occurredAt)} · {a.author.name}
                        </span>
                        {a.projectId && (
                          <Link
                            href={`/crm/${a.projectId}`}
                            className="text-xs text-[var(--hh-accent)] hover:underline"
                          >
                            view deal →
                          </Link>
                        )}
                      </div>
                      <p className="mt-1 text-sm whitespace-pre-wrap">
                        {a.body}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Projects */}
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
                    <div className="mt-1.5">
                      <ProjectCodeEditor
                        projectId={p.id}
                        code={p.code}
                        proposeFrom={client.name}
                        canEdit={canEdit}
                        compact
                      />
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="hh-primary">{formatMoney(p.contractCents)}</div>
                    <div className="hh-secondary capitalize mt-0.5">
                      {p.status.replace("_", " ").toLowerCase()}
                    </div>
                    {p.pipelineStage && (
                      <Link
                        href={`/crm/${p.id}`}
                        className="text-xs text-[var(--hh-accent)] hover:underline"
                      >
                        {p.pipelineStage}
                      </Link>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {/* Estimates & contracts */}
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
                    <div className="hh-secondary mt-0.5">
                      {formatRelative(e.createdAt)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="hh-primary">{formatMoney(e.totalCents)}</div>
                    <div className="hh-secondary mt-0.5">{e.status}</div>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {/* Conversations */}
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
                      <div className="truncate hh-secondary mt-0.5">
                        {t.messages[0].body}
                      </div>
                    )}
                  </div>
                  <div className="hh-secondary whitespace-nowrap">
                    {formatRelative(t.lastAt)}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* ── Right: contact properties + notes ── */}
        <div className="space-y-6">
          <section className="hh-panel p-6 flex flex-col gap-4">
            <div className="pb-1">
              <h2 className="hh-label">Contact</h2>
            </div>
            <dl className="space-y-3.5 text-sm">
              <Field k="Email" v={client.primaryEmail ?? "—"} />
              <Field k="Phone" v={client.primaryPhone ?? "—"} />
              <Field k="Address" v={client.address ?? "—"} />
              <Field k="Lead source" v={client.leadSource ?? client.source ?? "—"} />
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
  return (
    {
      EMAIL: "hh-dot--blue",
      SMS: "hh-dot--green",
      IN_APP: "hh-dot--purple",
      CALL_NOTE: "hh-dot--orange",
    }[c] ?? "bg-slate-400"
  );
}

function activityDot(type: string) {
  if (type === "NOTE") return "bg-[var(--hh-dot-yellow)]";
  if (type === "CALL") return "bg-[var(--hh-dot-green)]";
  if (type === "MEETING") return "bg-[var(--hh-accent)]";
  return "bg-[var(--hh-muted)]";
}
