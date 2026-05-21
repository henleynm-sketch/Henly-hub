import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { canViewAllProjects } from "@/lib/roles";
import type { Role } from "@/lib/roles";
import { formatRelative } from "@/lib/utils";

const STAGES = ["LEAD", "ONSITE_CONSULT", "DESIGN_PROPOSAL", "PROPOSAL_SENT", "SOLD", "ACTIVE", "ON_HOLD", "WARRANTY", "PAST", "DEAD", "LOST"];

const PAGE_SIZE = 50;

type SP = { q?: string; stage?: string; source?: string; page?: string };

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");
  const role = session.user.role as Role;
  if (!canViewAllProjects(role) && role !== "FIELD") {
    return <div className="p-8 text-sm text-slate-500">CRM is only visible to office staff.</div>;
  }
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const stage = (sp.stage ?? "").trim();
  const source = (sp.source ?? "").trim();
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);

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

  const [clients, totalCount, stageCounts, sources] = await Promise.all([
    prisma.client.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      include: { _count: { select: { projects: true, threads: true } } },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.client.count({ where }),
    prisma.client.groupBy({ by: ["stage"], _count: true }),
    prisma.client.groupBy({ by: ["source"], _count: true, orderBy: { _count: { source: "desc" } } }),
  ]);

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
    const next: SP = { q, stage, source, page: String(page), ...overrides };
    if (next.q) params.set("q", next.q);
    if (next.stage) params.set("stage", next.stage);
    if (next.source) params.set("source", next.source);
    if (next.page && next.page !== "1") params.set("page", next.page);
    const qs = params.toString();
    return qs ? `/clients?${qs}` : "/clients";
  }

  const stageCountMap = Object.fromEntries(stageCounts.map((s) => [s.stage, s._count]));

  return (
    <>
      <PageHeader
        title="CRM"
        subtitle={`${totalCount.toLocaleString()} ${totalCount === 1 ? "client" : "clients"}${hasFilters ? " match filters" : ""}`}
        actions={<Link href="/clients/new" className="btn-primary">+ New lead</Link>}
      />
      <div className="space-y-6 p-6">
        <section className="card p-4">
          <form action="/clients" method="get" className="flex flex-wrap items-center gap-2">
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Search name, email, phone, city…"
              className="input flex-1 min-w-[240px]"
            />
            {stage && <input type="hidden" name="stage" value={stage} />}
            {source && <input type="hidden" name="source" value={source} />}
            <button className="btn-primary" type="submit">Search</button>
            {hasFilters && (
              <Link href="/clients" className="btn-ghost">Clear filters</Link>
            )}
          </form>

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <Link
              href={buildHref({ stage: undefined, page: "1" })}
              className={`badge ${!stage ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
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
                  className={`badge ${active ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
                >
                  {stageLabel(s)} <span className="ml-1 opacity-70">{count}</span>
                </Link>
              );
            })}
          </div>

          {sources.length > 1 && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="text-xs uppercase tracking-wide text-slate-500 mr-1">Source:</span>
              <Link
                href={buildHref({ source: undefined, page: "1" })}
                className={`badge ${!source ? "bg-slate-700 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
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
                    className={`badge ${active ? "bg-slate-700 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
                  >
                    {sourceLabel} <span className="ml-1 opacity-70">{s._count}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        <section className="card overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3 text-left font-medium">Client</th>
                <th className="px-5 py-3 text-left font-medium">Stage</th>
                <th className="px-5 py-3 text-left font-medium">Source</th>
                <th className="px-5 py-3 text-left font-medium">Projects</th>
                <th className="px-5 py-3 text-left font-medium">Threads</th>
                <th className="px-5 py-3 text-left font-medium">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {clients.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-sm text-slate-500">
                    No clients match those filters.
                  </td>
                </tr>
              )}
              {clients.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3">
                    <Link href={`/clients/${c.id}`} className="font-medium text-slate-900 hover:text-brand-700">
                      {c.name}
                    </Link>
                    <div className="text-xs text-slate-500">{c.primaryEmail ?? c.primaryPhone ?? "—"}</div>
                  </td>
                  <td className="px-5 py-3"><span className={stageBadge(c.stage)}>{stageLabel(c.stage)}</span></td>
                  <td className="px-5 py-3 text-slate-600">{c.source ?? "—"}</td>
                  <td className="px-5 py-3 text-slate-600">{c._count.projects}</td>
                  <td className="px-5 py-3 text-slate-600">{c._count.threads}</td>
                  <td className="px-5 py-3 text-slate-500">{formatRelative(c.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-sm">
              <span className="text-slate-500">
                Page {page} of {totalPages} · showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, totalCount)} of {totalCount.toLocaleString()}
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

        <section>
          <h2 className="mb-3 text-sm font-semibold text-slate-700">
            Pipeline {hasFilters && <span className="text-xs font-normal text-slate-500">(reflects current filters)</span>}
          </h2>
          <div className="overflow-x-auto pb-2">
            <div className="flex gap-3 min-w-max">
              {byStage.map((col) => (
                <div key={col.stage} className="w-56 flex-shrink-0 rounded-xl bg-slate-100/60 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                      {stageLabel(col.stage)}
                    </span>
                    <span className="text-xs text-slate-500">{col.items.length}</span>
                  </div>
                  <ul className="space-y-2">
                    {col.items.slice(0, 8).map((c) => (
                      <li key={c.id}>
                        <Link
                          href={`/clients/${c.id}`}
                          className="block rounded-lg bg-white p-3 shadow-sm hover:ring-1 hover:ring-brand-500/30"
                        >
                          <div className="text-sm font-medium">{c.name}</div>
                          <div className="text-xs text-slate-500">{c.city ?? c.source ?? ""}</div>
                        </Link>
                      </li>
                    ))}
                    {col.items.length > 8 && (
                      <li className="text-xs text-slate-500 px-1">+ {col.items.length - 8} more</li>
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
  if (s === "LEAD") return "badge-slate";
  if (s === "ONSITE_CONSULT") return "badge-blue";
  if (s === "DESIGN_PROPOSAL" || s === "PROPOSAL_SENT") return "badge-violet";
  if (s === "SOLD" || s === "ACTIVE") return "badge-green";
  if (s === "ON_HOLD") return "badge-amber";
  if (s === "WARRANTY") return "badge-amber";
  if (s === "PAST") return "badge-slate";
  if (s === "DEAD" || s === "LOST") return "badge-red";
  return "badge-slate";
}
