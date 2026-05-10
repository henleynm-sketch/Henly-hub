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
    return <div className="p-8 text-sm text-slate-500">Financials require office or owner role.</div>;
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

        <section className="card overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3 text-left font-medium">Project</th>
                <th className="px-5 py-3 text-right font-medium">Contract</th>
                <th className="px-5 py-3 text-right font-medium">Est.</th>
                <th className="px-5 py-3 text-right font-medium">Actual</th>
                <th className="px-5 py-3 text-right font-medium">Margin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {projects.map((p) => {
                const est = p.budgetItems.reduce((a, b) => a + b.estimateCents, 0);
                const act = p.budgetItems.reduce((a, b) => a + b.actualCents, 0);
                const margin = p.contractCents - act;
                return (
                  <tr key={p.id}>
                    <td className="px-5 py-3">
                      <div className="font-medium">{p.name}</div>
                      <div className="text-xs text-slate-500">{p.client.name}</div>
                    </td>
                    <td className="px-5 py-3 text-right">{formatMoney(p.contractCents)}</td>
                    <td className="px-5 py-3 text-right">{formatMoney(est)}</td>
                    <td className="px-5 py-3 text-right">{formatMoney(act)}</td>
                    <td className={`px-5 py-3 text-right ${margin < 0 ? "text-rose-700" : "text-emerald-700"}`}>
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
