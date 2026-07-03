import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { canViewAllProjects } from "@/lib/roles";
import type { Role } from "@/lib/roles";
import { formatRelative } from "@/lib/utils";
import CrmSearchBox from "@/components/crm/CrmSearchBox";

const STAGES = ["LEAD", "ONSITE_CONSULT", "DESIGN_PROPOSAL", "PROPOSAL_SENT", "SOLD", "ACTIVE", "ON_HOLD", "WARRANTY", "PAST", "DEAD", "LOST"];

const PAGE_SIZE = 50;

type SP = { q?: string; stage?: string; source?: string; page?: string; sort?: string };

// Open bucket per the JT-Customers pattern: anything still in play.
const OPEN_STATUSES = ["OPEN", "WARRANTY", "PRESALE"];
type SortKey = "name" | "open" | "closed" | "activity";
const SORT_KEYS: SortKey[] = ["name", "open", "closed", "activity"];

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");
  const role = session.user.role as Role;
  // Role matrix: CRM (client PII + pipeline) is CEO/Office only. FIELD was
  // whitelisted here historically — direct-URL access leaked 451 customer
  // records to field crew (caught in the Lane V walk).
  if (!canViewAllProjects(role)) {
    return <div className="p-8 hh-secondary">CRM is only visible to office staff.</div>;
  }
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const stage = (sp.stage ?? "").trim();
  const source = (sp.source ?? "").trim();
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const sort: SortKey = SORT_KEYS.includes(sp.sort as SortKey) ? (sp.sort as SortKey) : "name";

  const where: any = {};
  if (q) {
    where.OR = [
      { name: { contains: q } },
      { primaryEmail: { contains: q } },
      { primaryPhone: { contains: q.replace(/\D/g, "") || q } },
      { city: { contains: q } },
    ];
  }
  if (stage) where.stage = stage;
  if (source) where.source = source === "(none)" ? null : source;

  // Derived roll-ups in constant query count (no N+1): all matching clients +
  // one project groupBy; counts, sort and pagination computed in memory
  // (hundreds of rows — trivial at Henley scale).
  const [allClients, projRollup, stageCounts, sources] = await Promise.all([
    prisma.client.findMany({
      where,
      select: {
        id: true,
        name: true,
        primaryEmail: true,
        primaryPhone: true,
        address: true,
        city: true,
        stage: true,
        source: true,
        updatedAt: true,
      },
    }),
    prisma.project.groupBy({
      by: ["clientId", "status"],
      _count: { _all: true },
      _max: { updatedAt: true },
    }),
    prisma.client.groupBy({ by: ["stage"], _count: true }),
    prisma.client.groupBy({ by: ["source"], _count: true, orderBy: { _count: { source: "desc" } } }),
  ]);

  const rollup = new Map<string, { open: number; closed: number; lastProjectAt: Date | null }>();
  for (const r of projRollup) {
    const cur = rollup.get(r.clientId) ?? { open: 0, closed: 0, lastProjectAt: null };
    if (OPEN_STATUSES.includes(r.status)) cur.open += r._count._all;
    else if (r.status === "CLOSED") cur.closed += r._count._all;
    if (r._max.updatedAt && (!cur.lastProjectAt || r._max.updatedAt > cur.lastProjectAt)) {
      cur.lastProjectAt = r._max.updatedAt;
    }
    rollup.set(r.clientId, cur);
  }

  const enriched = allClients.map((c) => {
    const r = rollup.get(c.id) ?? { open: 0, closed: 0, lastProjectAt: null };
    const lastActivityAt =
      r.lastProjectAt && r.lastProjectAt > c.updatedAt ? r.lastProjectAt : c.updatedAt;
    return { ...c, openJobs: r.open, closedJobs: r.closed, lastActivityAt };
  });

  enriched.sort((a, b) => {
    if (sort === "open") return b.openJobs - a.openJobs || a.name.localeCompare(b.name);
    if (sort === "closed") return b.closedJobs - a.closedJobs || a.name.localeCompare(b.name);
    if (sort === "activity") return b.lastActivityAt.getTime() - a.lastActivityAt.getTime();
    return a.name.localeCompare(b.name);
  });

  const totalCount = enriched.length;
  const clients = enriched.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Pipeline kanban uses ALL clients (no pagination), filtered only by q/source.
  const pipelineWhere: any = {};
  if (q) pipelineWhere.OR = where.OR;
  if (source) pipelineWhere.source = where.source;
  const pipelineClients = await prisma.client.findMany({
    where: pipelineWhere,
    orderBy: { updatedAt: "desc" },
    select: { id: true, name: true, stage: true, city: true, source: true },
  });
  const byStage = STAGES.map((s) => ({
    stage: s,
    items: pipelineClients.filter((c) => c.stage === s),
  }));

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const hasFilters = !!(q || stage || source);

  function buildHref(overrides: Partial<SP>) {
    const params = new URLSearchParams();
    const next: SP = { q, stage, source, page: String(page), sort, ...overrides };
    if (next.q) params.set("q", next.q);
    if (next.stage) params.set("stage", next.stage);
    if (next.source) params.set("source", next.source);
    if (next.sort && next.sort !== "name") params.set("sort", next.sort);
    if (next.page && next.page !== "1") params.set("page", next.page);
    const qs = params.toString();
    return qs ? `/clients?${qs}` : "/clients";
  }

  const stageCountMap = Object.fromEntries(stageCounts.map((s) => [s.stage, s._count]));

  return (
    <>
      <PageHeader
        title="CRM"
        subtitle={`${totalCount.toLocaleString()} ${totalCount === 1 ? "customer" : "customers"}${hasFilters ? " match filters" : ""}`}
        actions={<Link href="/clients/new" className="btn-primary">+ New lead</Link>}
      />
      <div className="space-y-6 p-6">
        <section className="hh-panel p-6 flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <CrmSearchBox initial={q} />
            {hasFilters && (
              <Link href="/clients" className="btn-ghost">Clear filters</Link>
            )}
          </div>

          <div className="flex md:flex-wrap items-center gap-1.5 overflow-x-auto md:overflow-visible touch-scroll">
            <Link
              href={buildHref({ stage: undefined, page: "1" })}
              className={`badge ${!stage ? "border-accent bg-accent/10 text-accent font-semibold" : "bg-row-bg border border-glass-border text-ink-soft hover:bg-row-hover hover:text-ink"}`}
            >
              All <span className="ml-1 opacity-70">{totalCount.toLocaleString()}</span>
            </Link>
            {STAGES.map((s) => {
              const count = stageCountMap[s] ?? 0;
              if (count === 0) return null;
              const active = stage === s;
              return (
                <Link
                  key={s}
                  href={buildHref({ stage: active ? undefined : s, page: "1" })}
                  className={`badge ${active ? "border-accent bg-accent/10 text-accent font-semibold" : "bg-row-bg border border-glass-border text-ink-soft hover:bg-row-hover hover:text-ink"}`}
                >
                  {stageLabel(s)} <span className="ml-1 opacity-70">{count}</span>
                </Link>
              );
            })}
          </div>

          {sources.length > 1 && (
            <div className="flex md:flex-wrap items-center gap-1.5 border-t border-glass-border pt-3 overflow-x-auto md:overflow-visible touch-scroll">
              <span className="hh-label mr-1">Source:</span>
              <Link
                href={buildHref({ source: undefined, page: "1" })}
                className={`badge ${!source ? "border-accent bg-accent/10 text-accent font-semibold" : "bg-row-bg border border-glass-border text-ink-soft hover:bg-row-hover hover:text-ink"}`}
              >
                All
              </Link>
              {sources.map((s) => {
                const sourceLabel = s.source ?? "(none)";
                const active = source === sourceLabel;
                return (
                  <Link
                    key={sourceLabel}
                    href={buildHref({ source: active ? undefined : sourceLabel, page: "1" })}
                    className={`badge ${active ? "border-accent bg-accent/10 text-accent font-semibold" : "bg-row-bg border border-glass-border text-ink-soft hover:bg-row-hover hover:text-ink"}`}
                  >
                    {sourceLabel} <span className="ml-1 opacity-70">{s._count}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        <section className="hh-panel overflow-x-auto hidden md:block">
          <table className="min-w-full text-sm">
            <thead className="border-b border-glass-border sticky top-0 glass-base z-10">
              <tr>
                <th className="hh-label px-5 py-3 text-left">
                  <Link href={buildHref({ sort: "name", page: "1" })} className={sort === "name" ? "text-accent" : ""}>
                    Name{sort === "name" ? " ↑" : ""}
                  </Link>
                </th>
                <th className="hh-label px-5 py-3 text-left">Primary contact</th>
                <th className="hh-label px-5 py-3 text-left">Email</th>
                <th className="hh-label px-5 py-3 text-left">Location</th>
                <th className="hh-label px-5 py-3 text-right">
                  <Link href={buildHref({ sort: "open", page: "1" })} className={sort === "open" ? "text-accent" : ""}>
                    Open Jobs{sort === "open" ? " ↓" : ""}
                  </Link>
                </th>
                <th className="hh-label px-5 py-3 text-right">
                  <Link href={buildHref({ sort: "closed", page: "1" })} className={sort === "closed" ? "text-accent" : ""}>
                    Closed Jobs{sort === "closed" ? " ↓" : ""}
                  </Link>
                </th>
                <th className="hh-label px-5 py-3 text-left">
                  <Link href={buildHref({ sort: "activity", page: "1" })} className={sort === "activity" ? "text-accent" : ""}>
                    Last activity{sort === "activity" ? " ↓" : ""}
                  </Link>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-glass-border">
              {clients.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center hh-secondary">
                    No customers match those filters.
                  </td>
                </tr>
              )}
              {clients.map((c) => (
                <tr key={c.id} className="hh-row--flat">
                  <td className="px-5 py-2.5">
                    <Link href={`/clients/${c.id}`} className="hh-primary">
                      {c.name}
                    </Link>
                    <div className="hh-caption">
                      <span className={stageBadge(c.stage)}>{stageLabel(c.stage)}</span>
                    </div>
                  </td>
                  <td className="px-5 py-2.5 hh-secondary whitespace-nowrap">{c.primaryPhone ?? "—"}</td>
                  <td className="px-5 py-2.5 hh-secondary max-w-52 truncate" title={c.primaryEmail ?? undefined}>
                    {c.primaryEmail ?? "—"}
                  </td>
                  <td className="px-5 py-2.5 hh-secondary max-w-56 truncate" title={c.address ?? undefined}>
                    {c.address ?? c.city ?? "—"}
                  </td>
                  <td className="px-5 py-2.5 text-right tabular-nums">
                    {c.openJobs > 0 ? (
                      <Link href={`/jobs/list?clientId=${c.id}&bucket=open`} className="hh-primary hover:underline">
                        {c.openJobs}
                      </Link>
                    ) : (
                      <span className="hh-secondary">0</span>
                    )}
                  </td>
                  <td className="px-5 py-2.5 text-right tabular-nums">
                    {c.closedJobs > 0 ? (
                      <Link href={`/jobs/list?clientId=${c.id}&bucket=closed`} className="hh-primary hover:underline">
                        {c.closedJobs}
                      </Link>
                    ) : (
                      <span className="hh-secondary">0</span>
                    )}
                  </td>
                  <td className="px-5 py-2.5 hh-secondary whitespace-nowrap">{formatRelative(c.lastActivityAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-glass-border px-5 py-3 text-sm">
              <span className="hh-caption">
                Page {page} of {totalPages} · showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, totalCount)} of {totalCount.toLocaleString()} customers
              </span>
              <div className="flex gap-2">
                {page > 1 && (
                  <Link href={buildHref({ page: String(page - 1) })} className="btn-ghost">← Prev</Link>
                )}
                {page < totalPages && (
                  <Link href={buildHref({ page: String(page + 1) })} className="btn-ghost">Next →</Link>
                )}
              </div>
            </div>
          )}
        </section>

        <section className="md:hidden space-y-2">
          {clients.length === 0 && (
            <div className="hh-panel p-6 hh-secondary">No clients match those filters.</div>
          )}
          {clients.map((c) => (
            <Link key={c.id} href={`/clients/${c.id}`} className="hh-row flex-col !items-start !gap-1">
              <span className="flex items-center justify-between w-full gap-2">
                <span className="hh-primary truncate">{c.name}</span>
                <span className={stageBadge(c.stage)}>{stageLabel(c.stage)}</span>
              </span>
              <span className="hh-secondary truncate w-full">{c.primaryEmail ?? c.primaryPhone ?? "—"}</span>
              <span className="flex items-center gap-2">
                {c.openJobs > 0 && <span className="hh-badge hh-badge--success">{c.openJobs} open</span>}
                <span className="hh-caption">{formatRelative(c.lastActivityAt)}</span>
              </span>
            </Link>
          ))}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              {page > 1 ? (
                <Link href={buildHref({ page: String(page - 1) })} className="btn-secondary">← Prev</Link>
              ) : <span />}
              <span className="hh-caption">Page {page} of {totalPages}</span>
              {page < totalPages ? (
                <Link href={buildHref({ page: String(page + 1) })} className="btn-secondary">Next →</Link>
              ) : <span />}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3 hh-label">
            Pipeline {hasFilters && <span className="hh-caption normal-case tracking-normal">(reflects current filters)</span>}
          </h2>
          <div className="overflow-x-auto pb-2">
            <div className="flex gap-3 min-w-max">
              {byStage.map((col) => (
                <div key={col.stage} className="hh-panel w-56 flex-shrink-0 p-4 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="hh-label">
                      {stageLabel(col.stage)}
                    </span>
                    <span className="hh-secondary">{col.items.length}</span>
                  </div>
                  <ul className="space-y-2">
                    {col.items.slice(0, 8).map((c) => (
                      <li key={c.id}>
                        <Link
                          href={`/clients/${c.id}`}
                          className="hh-row flex-col !items-start !gap-0"
                        >
                          <div className="hh-primary">{c.name}</div>
                          <div className="hh-secondary mt-1">{c.city ?? c.source ?? ""}</div>
                        </Link>
                      </li>
                    ))}
                    {col.items.length > 8 && (
                      <li className="hh-caption px-1">+ {col.items.length - 8} more</li>
                    )}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

function stageLabel(s: string): string {
  const labels: Record<string, string> = {
    LEAD: "Lead",
    ONSITE_CONSULT: "Onsite consult",
    DESIGN_PROPOSAL: "Design proposal",
    PROPOSAL_SENT: "Proposal sent",
    SOLD: "Sold",
    ACTIVE: "Active",
    ON_HOLD: "On hold",
    WARRANTY: "Warranty",
    PAST: "Past",
    DEAD: "Dead",
    LOST: "Lost",
  };
  return labels[s] ?? s;
}

function stageBadge(s: string) {
  if (s === "LEAD") return "hh-badge";
  if (s === "ONSITE_CONSULT") return "hh-badge";
  if (s === "DESIGN_PROPOSAL" || s === "PROPOSAL_SENT") return "hh-badge";
  if (s === "SOLD" || s === "ACTIVE") return "hh-badge hh-badge--success";
  if (s === "ON_HOLD") return "hh-badge hh-badge--warning";
  if (s === "WARRANTY") return "hh-badge hh-badge--warning";
  if (s === "PAST") return "hh-badge";
  if (s === "DEAD" || s === "LOST") return "hh-badge hh-badge--danger";
  return "hh-badge";
}
