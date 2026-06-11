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
    return <div className="p-8 hh-secondary">Estimates are visible to office staff only.</div>;
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
        <section className="md:hidden space-y-2">
          {estimates.length === 0 && (
            <div className="hh-panel p-6 hh-secondary">No estimates yet.</div>
          )}
          {estimates.map((e) => (
            <Link key={e.id} href={`/estimates/${e.id}`} className="hh-row flex-col !items-start !gap-1">
              <span className="flex items-center justify-between w-full gap-2">
                <span className="hh-primary truncate">{e.client.name}</span>
                <span className={statusBadge(e.status)}>{e.status}</span>
              </span>
              <span className="hh-secondary truncate w-full">{e.title}</span>
              <span className="hh-caption">
                <span className="hh-chip">{e.number}</span> · {formatMoney(e.totalCents)} · {formatRelative(e.createdAt)}
              </span>
            </Link>
          ))}
        </section>

        <section className="hh-panel overflow-x-auto hidden md:block">
          <table className="min-w-full text-sm">
            <thead className="border-b border-glass-border">
              <tr>
                <th className="hh-label px-5 py-3.5 text-left">Number</th>
                <th className="hh-label px-5 py-3.5 text-left">Client</th>
                <th className="hh-label px-5 py-3.5 text-left">Title</th>
                <th className="hh-label px-5 py-3.5 text-left">Status</th>
                <th className="hh-label px-5 py-3.5 text-right">Total</th>
                <th className="hh-label px-5 py-3.5 text-left">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-glass-border">
              {estimates.length === 0 && (
                <tr><td colSpan={6} className="px-5 py-6 text-center hh-secondary">No estimates yet.</td></tr>
              )}
              {estimates.map((e) => (
                <tr key={e.id} className="hh-row--flat">
                  <td className="px-5 py-3">
                    <Link href={`/estimates/${e.id}`}><span className="hh-chip">{e.number}</span></Link>
                  </td>
                  <td className="px-5 py-3 hh-primary">{e.client.name}</td>
                  <td className="px-5 py-3 hh-secondary">{e.title}</td>
                  <td className="px-5 py-3"><span className={statusBadge(e.status)}>{e.status}</span></td>
                  <td className="px-5 py-3 text-right hh-primary">{formatMoney(e.totalCents)}</td>
                  <td className="px-5 py-3 hh-secondary">{formatRelative(e.createdAt)}</td>
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
  if (s === "ACCEPTED") return "hh-badge hh-badge--success";
  if (s === "SENT") return "hh-badge";
  if (s === "DRAFT") return "hh-badge";
  if (s === "DECLINED") return "hh-badge hh-badge--danger";
  return "hh-badge";
}
