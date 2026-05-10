import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { canSeeFinancials } from "@/lib/roles";
import type { Role } from "@/lib/roles";
import { formatMoney, formatRelative } from "@/lib/utils";

export default async function EstimatesPage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");
  const role = session.user.role as Role;
  if (!canSeeFinancials(role)) {
    return <div className="p-8 text-sm text-slate-500">Estimates are visible to office staff only.</div>;
  }

  const estimates = await prisma.estimate.findMany({
    orderBy: { createdAt: "desc" },
    include: { client: true, author: true },
  });

  return (
    <>
      <PageHeader
        title="Estimates"
        subtitle="Drafts, sent estimates, and accepted contracts."
        actions={<Link href="/estimates/new" className="btn-primary">+ New estimate</Link>}
      />
      <div className="p-6">
        <section className="card overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3 text-left font-medium">Number</th>
                <th className="px-5 py-3 text-left font-medium">Client</th>
                <th className="px-5 py-3 text-left font-medium">Title</th>
                <th className="px-5 py-3 text-left font-medium">Status</th>
                <th className="px-5 py-3 text-right font-medium">Total</th>
                <th className="px-5 py-3 text-left font-medium">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {estimates.length === 0 && (
                <tr><td colSpan={6} className="px-5 py-6 text-center text-slate-500">No estimates yet.</td></tr>
              )}
              {estimates.map((e) => (
                <tr key={e.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3 font-mono text-xs text-slate-700">
                    <Link href={`/estimates/${e.id}`} className="hover:text-brand-700">{e.number}</Link>
                  </td>
                  <td className="px-5 py-3">{e.client.name}</td>
                  <td className="px-5 py-3 text-slate-700">{e.title}</td>
                  <td className="px-5 py-3"><span className={statusBadge(e.status)}>{e.status}</span></td>
                  <td className="px-5 py-3 text-right">{formatMoney(e.totalCents)}</td>
                  <td className="px-5 py-3 text-slate-500">{formatRelative(e.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </>
  );
}

function statusBadge(s: string) {
  if (s === "ACCEPTED") return "badge-green";
  if (s === "SENT") return "badge-blue";
  if (s === "DRAFT") return "badge-slate";
  if (s === "DECLINED") return "badge-red";
  return "badge-slate";
}
