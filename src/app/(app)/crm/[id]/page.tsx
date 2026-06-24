import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/PageHeader";
import { formatMoney, formatRelative } from "@/lib/utils";
import ActivityLogger from "./ActivityLogger";
import StageSelector from "./StageSelector";

export default async function DealDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const role =
    (session?.user as { role?: string } | undefined)?.role ?? "";
  const canEdit = role === "OFFICE" || role === "CEO";

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      client: true,
      crmActivities: {
        orderBy: { occurredAt: "desc" },
        include: { author: { select: { name: true } } },
      },
    },
  });
  if (!project) notFound();

  // Also pull client-level activities not tied to a specific project
  const clientActivities = await prisma.crmActivity.findMany({
    where: { clientId: project.clientId, projectId: null },
    orderBy: { occurredAt: "desc" },
    include: { author: { select: { name: true } } },
  });

  // Merge & sort newest-first
  const timeline = [
    ...project.crmActivities,
    ...clientActivities,
  ].sort(
    (a, b) =>
      new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
  );

  return (
    <>
      <PageHeader
        title={project.name}
        subtitle={project.client.name}
        actions={
          <>
            <Link
              href={`/clients/${project.clientId}`}
              className="btn-secondary"
            >
              Contact record
            </Link>
            <Link href={`/projects/${id}`} className="btn-secondary">
              Full project
            </Link>
          </>
        }
      />

      <div className="grid gap-6 p-6 lg:grid-cols-3">
        {/* ── Left: activity logger + timeline ── */}
        <div className="space-y-6 lg:col-span-2">
          {canEdit && (
            <ActivityLogger projectId={id} clientId={project.clientId} />
          )}

          <section className="hh-panel p-6">
            <h2 className="hh-label mb-4">Activity timeline</h2>
            {timeline.length === 0 ? (
              <p className="hh-secondary py-4 text-center">
                No activity logged yet.
              </p>
            ) : (
              <ul className="space-y-5">
                {timeline.map((a) => (
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
                        {!a.projectId && (
                          <span className="text-xs text-[var(--hh-muted)] italic">
                            (client-level)
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm whitespace-pre-wrap">
                        {a.body}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* ── Right: deal properties + contact ── */}
        <div className="space-y-6">
          <section className="hh-panel p-6 space-y-4">
            <h2 className="hh-label">Deal</h2>
            <dl className="space-y-3.5 text-sm">
              <DField
                k="Value"
                v={
                  <span className="font-mono tabular-nums font-semibold">
                    {formatMoney(project.contractCents)}
                  </span>
                }
              />
              <DField k="Job type" v={project.jobType ?? "—"} />
              <DField k="Status" v={project.status} />
              <DField
                k="Pipeline stage"
                v={
                  canEdit ? (
                    <StageSelector
                      projectId={id}
                      current={project.pipelineStage}
                    />
                  ) : (
                    <span>{project.pipelineStage ?? "—"}</span>
                  )
                }
              />

            </dl>
          </section>

          <section className="hh-panel p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="hh-label">Contact</h2>
              <Link
                href={`/clients/${project.clientId}`}
                className="text-xs text-[var(--hh-accent)] hover:underline"
              >
                View record →
              </Link>
            </div>
            <dl className="space-y-3.5 text-sm">
              <DField k="Name" v={project.client.name} />
              <DField k="Email" v={project.client.primaryEmail ?? "—"} />
              <DField k="Phone" v={project.client.primaryPhone ?? "—"} />
              <DField
                k="Lead source"
                v={project.client.leadSource ?? project.client.source ?? "—"}
              />
              <DField
                k="City"
                v={
                  [project.client.city, project.client.state]
                    .filter(Boolean)
                    .join(", ") || "—"
                }
              />
            </dl>
          </section>
        </div>
      </div>
    </>
  );
}

function DField({
  k,
  v,
}: {
  k: string;
  v: ReactNode;
}) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="hh-secondary shrink-0">{k}</dt>
      <dd className="text-right">{v}</dd>
    </div>
  );
}

function activityDot(type: string) {
  if (type === "NOTE") return "bg-[var(--hh-dot-yellow)]";
  if (type === "CALL") return "bg-[var(--hh-dot-green)]";
  if (type === "MEETING") return "bg-[var(--hh-accent)]";
  return "bg-[var(--hh-muted)]";
}
