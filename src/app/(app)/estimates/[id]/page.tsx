import Link from "next/link";
import { notFound } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canSeeFinancials } from "@/lib/roles";
import type { Role } from "@/lib/roles";
import { formatMoney, formatDate } from "@/lib/utils";
import { revalidatePath } from "next/cache";

export default async function EstimateDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const e = await prisma.estimate.findUnique({
    where: { id },
    include: { client: true, author: true, lineItems: true },
  });
  if (!e) notFound();

  async function setStatus(formData: FormData) {
    "use server";
    const me = await auth();
    if (!me?.user || !canSeeFinancials(me.user.role as Role)) return;
    const status = String(formData.get("status") || "");
    if (!["DRAFT", "SENT", "ACCEPTED", "DECLINED"].includes(status)) return;
    await prisma.estimate.update({ where: { id }, data: { status } });
    revalidatePath(`/estimates/${id}`);
    revalidatePath("/estimates");
    revalidatePath("/contracts");
  }

  return (
    <>
      <PageHeader
        title={`${e.number} · ${e.title}`}
        subtitle={`${e.client.name} · ${e.status}`}
        actions={
          <>
            <Link href={`/clients/${e.clientId}`} className="btn-secondary">View client</Link>
            {e.status === "DRAFT" && (
              <form action={setStatus}>
                <input type="hidden" name="status" value="SENT" />
                <button className="btn-secondary" type="submit">Mark sent</button>
              </form>
            )}
            {e.status === "SENT" && (
              <>
                <form action={setStatus}>
                  <input type="hidden" name="status" value="DECLINED" />
                  <button className="btn-secondary" type="submit">Mark declined</button>
                </form>
                <form action={setStatus}>
                  <input type="hidden" name="status" value="ACCEPTED" />
                  <button className="btn-secondary" type="submit">Mark accepted</button>
                </form>
              </>
            )}
            {e.status === "ACCEPTED" ? (
              <Link href="/contracts" className="btn-primary">Convert to contract</Link>
            ) : (
              <button className="btn-primary" disabled title="Estimate must be accepted first">
                Convert to contract
              </button>
            )}
          </>
        }
      />
      <div className="grid gap-6 p-6 lg:grid-cols-3">
        <section className="hh-panel lg:col-span-2 overflow-hidden flex flex-col">
          <div className="border-b border-glass-border px-6 py-4 pb-3">
            <h2 className="hh-label">Line items</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-glass-border">
                <tr>
                  <th className="hh-label px-5 py-3.5 text-left">Category</th>
                  <th className="hh-label px-5 py-3.5 text-left">Description</th>
                  <th className="hh-label px-5 py-3.5 text-right">Qty</th>
                  <th className="hh-label px-5 py-3.5 text-right">Unit</th>
                  <th className="hh-label px-5 py-3.5 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-glass-border">
                {e.lineItems.map((li) => (
                  <tr key={li.id} className="hh-row--flat">
                    <td className="px-5 py-3 hh-secondary">{li.category ?? "—"}</td>
                    <td className="px-5 py-3 hh-primary">{li.description}</td>
                    <td className="px-5 py-3 text-right hh-secondary">{li.quantity}</td>
                    <td className="px-5 py-3 text-right hh-secondary">{formatMoney(li.unitCents)}</td>
                    <td className="px-5 py-3 text-right hh-primary">{formatMoney(li.totalCents)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="text-sm border-t border-glass-border">
                <tr>
                  <td colSpan={4} className="px-5 py-3 text-right hh-secondary">Subtotal</td>
                  <td className="px-5 py-3 text-right hh-primary">{formatMoney(e.subtotalCents)}</td>
                </tr>
                <tr>
                  <td colSpan={4} className="px-5 py-3 text-right hh-secondary">Tax</td>
                  <td className="px-5 py-3 text-right hh-primary">{formatMoney(e.taxCents)}</td>
                </tr>
                <tr>
                  <td colSpan={4} className="px-5 py-3 text-right hh-primary">Total</td>
                  <td className="px-5 py-3 text-right hh-primary font-bold">{formatMoney(e.totalCents)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>

        <aside className="space-y-6">
          <div className="hh-panel p-6 flex flex-col gap-4">
            <div className="pb-1">
              <h2 className="hh-label">Details</h2>
            </div>
            <dl className="space-y-3.5 text-sm">
              <Field k="Status" v={e.status} />
              <Field k="Author" v={e.author.name} />
              <Field k="Created" v={formatDate(e.createdAt)} />
              <Field k="Updated" v={formatDate(e.updatedAt)} />
            </dl>
          </div>
          <div className="hh-panel p-6 flex flex-col gap-4">
            <div className="pb-1">
              <h2 className="hh-label">Notes</h2>
            </div>
            <p className="whitespace-pre-wrap hh-secondary">
              {e.notes ?? "No notes."}
            </p>
          </div>
          <div className="hh-panel p-6 flex flex-col gap-4">
            <div className="pb-1">
              <h2 className="hh-label">QuickBooks</h2>
            </div>
            <p className="hh-secondary">
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
      <dt className="hh-secondary">{k}</dt>
      <dd className="text-right hh-primary">{v}</dd>
    </div>
  );
}
