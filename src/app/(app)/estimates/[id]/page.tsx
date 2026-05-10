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
        <section className="card lg:col-span-2">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-sm font-semibold">Line items</h2>
          </div>
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3 text-left font-medium">Category</th>
                <th className="px-5 py-3 text-left font-medium">Description</th>
                <th className="px-5 py-3 text-right font-medium">Qty</th>
                <th className="px-5 py-3 text-right font-medium">Unit</th>
                <th className="px-5 py-3 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {e.lineItems.map((li) => (
                <tr key={li.id}>
                  <td className="px-5 py-2 text-slate-600">{li.category ?? "—"}</td>
                  <td className="px-5 py-2">{li.description}</td>
                  <td className="px-5 py-2 text-right">{li.quantity}</td>
                  <td className="px-5 py-2 text-right">{formatMoney(li.unitCents)}</td>
                  <td className="px-5 py-2 text-right">{formatMoney(li.totalCents)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-50 text-sm">
              <tr>
                <td colSpan={4} className="px-5 py-2 text-right text-slate-500">Subtotal</td>
                <td className="px-5 py-2 text-right">{formatMoney(e.subtotalCents)}</td>
              </tr>
              <tr>
                <td colSpan={4} className="px-5 py-2 text-right text-slate-500">Tax</td>
                <td className="px-5 py-2 text-right">{formatMoney(e.taxCents)}</td>
              </tr>
              <tr>
                <td colSpan={4} className="px-5 py-2 text-right font-medium">Total</td>
                <td className="px-5 py-2 text-right font-semibold">{formatMoney(e.totalCents)}</td>
              </tr>
            </tfoot>
          </table>
        </section>

        <aside className="space-y-4">
          <div className="card p-5">
            <h2 className="text-sm font-semibold">Details</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <Field k="Status" v={e.status} />
              <Field k="Author" v={e.author.name} />
              <Field k="Created" v={formatDate(e.createdAt)} />
              <Field k="Updated" v={formatDate(e.updatedAt)} />
            </dl>
          </div>
          <div className="card p-5">
            <h2 className="text-sm font-semibold">Notes</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">
              {e.notes ?? "No notes."}
            </p>
          </div>
          <div className="card p-5">
            <h2 className="text-sm font-semibold">QuickBooks</h2>
            <p className="mt-2 text-sm text-slate-600">
              Push this estimate (or its accepted contract) to QuickBooks once connected.
            </p>
            <button className="btn-secondary mt-3 w-full justify-center" disabled>
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
      <dt className="text-slate-500">{k}</dt>
      <dd className="text-right text-slate-800">{v}</dd>
    </div>
  );
}
