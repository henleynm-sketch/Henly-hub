import Link from "next/link";
import { Suspense } from "react";
import { auth } from "@/auth";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/roles";
import { StatCard } from "@/components/PageHeader";
import JobFieldsPanel from "@/components/jobs/JobFieldsPanel";
import JobTreadPanel from "@/components/jobs/JobTreadPanel";
import LocationCard from "@/components/jobs/LocationCard";
import WeatherCard from "@/components/jobs/WeatherCard";
import { googleMapsUrl, osmEmbedUrl } from "@/lib/geocode";
import { jobTreadJobUrl } from "@/lib/jobtread";
import { formatMoney, formatDate, formatRelative } from "@/lib/utils";

// Job cockpit — the Hub's version of JobTread's job dashboard. Header, the
// nine-field panel, money tiles, recent activity; deep modules link to the
// existing project surfaces instead of duplicating them.
export default async function JobCockpitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/sign-in");
  const role = session.user.role as Role;
  if (role !== "CEO" && role !== "OFFICE") redirect("/dashboard");

  const p = await prisma.project.findUnique({
    where: { id },
    include: {
      client: { select: { id: true, name: true } },
      engagement: { select: { id: true, name: true } },
      budgetItems: true,
      dailyLogs: { orderBy: { date: "desc" }, take: 5, include: { author: { select: { name: true } } } },
      milestones: { orderBy: { order: "asc" } },
    },
  });
  if (!p) notFound();

  const actualCents = p.budgetItems.reduce((a, b) => a + b.actualCents, 0);
  const estimateCents = p.budgetItems.reduce((a, b) => a + b.estimateCents, 0);
  const doneMilestones = p.milestones.filter((m) => m.status === "DONE").length;

  const tabs = [
    { label: "Project", href: `/projects/${p.id}` },
    { label: "Estimates", href: "/estimates" },
    { label: "Schedule", href: "/schedule" },
    { label: "Files", href: "/files" },
    { label: "Messages", href: "/inbox" },
  ];

  return (
    <div>
      <div className="sticky top-0 z-50 px-6 py-5 glass-base">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link href={`/clients/${p.client.id}`} className="hh-caption uppercase hover:underline">
              {p.client.name}
              {p.address ? ` / ${p.address}` : ""}
            </Link>
            <h1 className="hh-display text-2xl font-bold tracking-tight text-ink">
              {p.name}
              {p.code && <span className="hh-caption ml-2">#{p.code}</span>}
            </h1>
          </div>
          <div className="flex gap-2">
            {p.jobtreadJobId && (
              <a
                href={jobTreadJobUrl(p.jobtreadJobId)}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary text-xs"
              >
                Open in JobTread ↗
              </a>
            )}
            <Link href={`/projects/${p.id}`} className="btn-primary text-xs">
              Full job view
            </Link>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-3">
          {tabs.map((t) => (
            <Link key={t.label} href={t.href} className="btn-ghost text-xs">
              {t.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="px-6 pb-8 grid gap-5 lg:grid-cols-3">
        <div className="flex flex-col gap-5">
          <JobFieldsPanel
            projectId={p.id}
            canEdit
            fields={{
              status: p.status,
              projectType: p.projectType,
              projectManager: p.projectManager,
              salesRep: p.salesRep,
              customerPO: p.customerPO,
              pipelineStage: p.pipelineStage,
              constructionPhase: p.constructionPhase,
              warrantyPhase: p.warrantyPhase,
              division: p.division,
            }}
          />
          <div className="hh-panel p-5 flex flex-col gap-2">
            <h2 className="hh-label">Project</h2>
            {p.engagement ? (
              <Link href={`/jobs/projects/${p.engagement.id}`} className="hh-primary hover:underline">
                {p.engagement.name}
              </Link>
            ) : (
              <span className="hh-secondary">
                Not in a project yet —{" "}
                <Link href="/jobs/projects" className="hh-primary hover:underline">
                  assign one
                </Link>
              </span>
            )}
          </div>

          <div className="hh-panel p-5 flex flex-col gap-2">
            <h2 className="hh-label">Dates</h2>
            <div className="flex items-center justify-between">
              <span className="hh-secondary">Start</span>
              <span className="hh-primary">{p.startDate ? formatDate(p.startDate) : "TBD"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="hh-secondary">Target end</span>
              <span className="hh-primary">{p.targetEnd ? formatDate(p.targetEnd) : "TBD"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="hh-secondary">Milestones</span>
              <span className="hh-primary tabular-nums">
                {doneMilestones}/{p.milestones.length}
              </span>
            </div>
          </div>

          <LocationCard
            canEdit
            data={{
              projectId: p.id,
              address: p.address,
              city: p.city,
              latitude: p.latitude,
              longitude: p.longitude,
              taxRateBps: p.taxRateBps,
              mapsUrl: googleMapsUrl(p.latitude, p.longitude, [p.address, p.city].filter(Boolean).join(", ")),
              osmEmbedUrl:
                p.latitude != null && p.longitude != null ? osmEmbedUrl(p.latitude, p.longitude) : null,
            }}
          />

          {p.latitude != null && p.longitude != null && (
            <Suspense
              fallback={
                <section className="hh-panel p-5">
                  <h2 className="hh-label">Site weather</h2>
                  <p className="hh-secondary mt-2">Loading forecast…</p>
                </section>
              }
            >
              <WeatherCard lat={p.latitude} lng={p.longitude} />
            </Suspense>
          )}
        </div>

        <div className="lg:col-span-2 flex flex-col gap-5">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Contract" value={formatMoney(p.contractCents)} hint="approved price" />
            <StatCard label="Budget" value={formatMoney(estimateCents || p.budgetCents)} hint="estimated cost" />
            <StatCard label="Actual" value={formatMoney(actualCents)} hint="cost to date" />
            <StatCard
              label="Remaining"
              value={formatMoney(p.contractCents - actualCents)}
              hint="contract minus actual"
              tone={p.contractCents - actualCents < 0 ? "warn" : "default"}
            />
          </div>

          <div className="hh-panel p-6 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h2 className="hh-label">Recent daily logs</h2>
              <Link href={`/projects/${p.id}`} className="btn-ghost text-xs">
                All activity →
              </Link>
            </div>
            {p.dailyLogs.length === 0 ? (
              <span className="hh-secondary">No logs yet.</span>
            ) : (
              p.dailyLogs.map((l) => (
                <div key={l.id} className="hh-row hh-row--flat flex-col !items-start !gap-0.5">
                  <div className="flex items-center justify-between w-full">
                    <span className="hh-secondary">
                      {l.author.name} · {formatRelative(l.date)}
                    </span>
                    {l.jobtreadId && <span className="hh-badge">JobTread</span>}
                  </div>
                  <p className="hh-secondary line-clamp-2">
                    {l.notes.replace(/^Synced from JobTread[^\n]*\n?\n?/, "")}
                  </p>
                </div>
              ))
            )}
          </div>

          {p.jobtreadJobId && (
            <Suspense
              fallback={
                <section className="hh-panel p-6">
                  <h2 className="hh-label">JobTread</h2>
                  <p className="hh-secondary mt-2">Loading live to-dos…</p>
                </section>
              }
            >
              <JobTreadPanel jobtreadJobId={p.jobtreadJobId} />
            </Suspense>
          )}
        </div>
      </div>
    </div>
  );
}
