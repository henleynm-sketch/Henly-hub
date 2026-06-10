import Link from "next/link";
import { notFound } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import { prisma } from "@/lib/prisma";
import { formatMoney, formatDate } from "@/lib/utils";

export default async function EstimateDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const e = await prisma.estimate.findUnique({
    where: { id },
    include: { client: true, author: true, lineItems: true },
  });
  if (!e) notFound();

  return (
    <>
      <PageHeader
        title={`${e.number} · ${e.title}`}
        subtitle={`${e.client.name} · ${e.status}`}
        actions={
          <>
            <Link href={`/clients/${e.clientId}`} className="btn-secondary">View client</Link>
            <button className="btn-secondary" disabled>Send (stub)</button>
            <button className="btn-primary" disabled>Convert to contract</button>
          </>
        }
      />
      <div className="grid gap-6 p-6 lg:grid-cols-3">
        <section className="glass-card lg:col-span-2 overflow-hidden flex flex-col">
          <div className="border-b border-glass-border px-6 py-4 pb-3">
            <h2 className="text-sm font-semibold text-ink">Line items</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-row-bg border-b border-glass-border text-xs uppercase tracking-wider text-ink-muted">
                <tr>
                  <th className="px-5 py-3.5 text-left font-medium">Category</th>
                  <th className="px-5 py-3.5 text-left font-medium">Description</th>
                  <th className="px-5 py-3.5 text-right font-medium">Qty</th>
                  <th className="px-5 py-3.5 text-right font-medium">Unit</th>
                  <th className="px-5 py-3.5 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-glass-border">
                {e.lineItems.map((li) => (
                  <tr key={li.id} className="hover:bg-row-hover transition-colors">
                    <td className="px-5 py-3 text-ink-muted">{li.category ?? "—"}</td>
                    <td className="px-5 py-3 text-ink font-medium">{li.description}</td>
                    <td className="px-5 py-3 text-right text-ink-soft">{li.quantity}</td>
                    <td className="px-5 py-3 text-right text-ink-soft">{formatMoney(li.unitCents)}</td>
                    <td className="px-5 py-3 text-right text-ink font-semibold">{formatMoney(li.totalCents)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-row-bg text-sm border-t border-glass-border">
                <tr>
                  <td colSpan={4} className="px-5 py-3 text-right text-ink-muted font-medium">Subtotal</td>
                  <td className="px-5 py-3 text-right text-ink font-semibold">{formatMoney(e.subtotalCents)}</td>
                </tr>
                <tr>
                  <td colSpan={4} className="px-5 py-3 text-right text-ink-muted font-medium">Tax</td>
                  <td className="px-5 py-3 text-right text-ink font-semibold">{formatMoney(e.taxCents)}</td>
                </tr>
                <tr>
                  <td colSpan={4} className="px-5 py-3 text-right text-ink font-semibold">Total</td>
                  <td className="px-5 py-3 text-right text-ink font-bold">{formatMoney(e.totalCents)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>

        <aside className="space-y-6">
          <div className="glass-card p-6 flex flex-col gap-4">
            <div className="border-b border-glass-border pb-1">
              <h2 className="text-sm font-semibold text-ink">Details</h2>
            </div>
            <dl className="space-y-3.5 text-sm">
              <Field k="Status" v={e.status} />
              <Field k="Author" v={e.author.name} />
              <Field k="Created" v={formatDate(e.createdAt)} />
              <Field k="Updated" v={formatDate(e.updatedAt)} />
            </dl>
          </div>
          <div className="glass-card p-6 flex flex-col gap-4">
            <div className="border-b border-glass-border pb-1">
              <h2 className="text-sm font-semibold text-ink">Notes</h2>
            </div>
            <p className="whitespace-pre-wrap text-sm text-ink-soft leading-relaxed">
              {e.notes ?? "No notes."}
            </p>
          </div>
          <div className="glass-card p-6 flex flex-col gap-4">
            <div className="border-b border-glass-border pb-1">
              <h2 className="text-sm font-semibold text-ink">QuickBooks</h2>
            </div>
            <p className="text-sm text-ink-soft leading-relaxed">
              Push this estimate (or its accepted contract) to QuickBooks once connected.
            </p>
            <button className="btn-secondary w-full justify-center" disabled>
              Sync to QuickBooks (setup required)
            </button>
          </div>
        </aside>
      </div>
    </>
  );
}

function Field({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-ink-muted font-medium">{k}</dt>
      <dd className="text-right text-ink font-semibold">{v}</dd>
    </div>
  );
}
