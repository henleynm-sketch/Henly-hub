import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { canSeeFinancials } from "@/lib/roles";
import type { Role } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import PageHeader, { StatCard } from "@/components/PageHeader";
import { formatMoney } from "@/lib/utils";

export default async function FinancialsPage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");
  if (!canSeeFinancials(session.user.role as Role)) {
    return <div className="p-8 hh-secondary">Financials require office or owner role.</div>;
  }

  const projects = await prisma.project.findMany({
    include: { budgetItems: true, client: true },
    orderBy: { updatedAt: "desc" },
  });

  const contractTotal = projects.reduce((a, p) => a + p.contractCents, 0);
  const estTotal = projects.reduce(
    (a, p) => a + p.budgetItems.reduce((b, i) => b + i.estimateCents, 0),
    0
  );
  const actTotal = projects.reduce(
    (a, p) => a + p.budgetItems.reduce((b, i) => b + i.actualCents, 0),
    0
  );

  return (
    <>
      <PageHeader
        title="Financials"
        subtitle="Budget vs actual across every active project. QuickBooks sync makes this real-time."
      />
      <div className="space-y-6 p-6">
        <div className="grid gap-4 md:grid-cols-3">
          <StatCard label="Total contracts" value={formatMoney(contractTotal)} />
          <StatCard label="Estimated cost" value={formatMoney(estTotal)} />
          <StatCard
            label="Actual cost to date"
            value={formatMoney(actTotal)}
            tone={actTotal > estTotal ? "warn" : "good"}
            hint={`${actTotal > estTotal ? "Over" : "Under"} budget by ${formatMoney(Math.abs(actTotal - estTotal))}`}
          />
        </div>

        <section className="hh-panel overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b border-glass-border">
              <tr>
                <th className="hh-label px-5 py-3.5 text-left">Project</th>
                <th className="hh-label px-5 py-3.5 text-right">Contract</th>
                <th className="hh-label px-5 py-3.5 text-right">Est.</th>
                <th className="hh-label px-5 py-3.5 text-right">Actual</th>
                <th className="hh-label px-5 py-3.5 text-right">Margin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-glass-border">
              {projects.map((p) => {
                const est = p.budgetItems.reduce((a, b) => a + b.estimateCents, 0);
                const act = p.budgetItems.reduce((a, b) => a + b.actualCents, 0);
                const margin = p.contractCents - act;
                return (
                  <tr key={p.id} className="hh-row--flat">
                    <td className="px-5 py-3">
                      <div className="hh-primary">{p.name}</div>
                      <div className="hh-secondary mt-0.5">{p.client.name}</div>
                    </td>
                    <td className="px-5 py-3 text-right hh-primary">{formatMoney(p.contractCents)}</td>
                    <td className="px-5 py-3 text-right hh-secondary">{formatMoney(est)}</td>
                    <td className="px-5 py-3 text-right hh-secondary">{formatMoney(act)}</td>
                    <td className={`px-5 py-3 text-right font-bold ${margin < 0 ? "text-status-error" : "text-status-success"}`}>
                      {formatMoney(margin)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      </div>
    </>
  );
}
