import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canSeeFinancials } from "@/lib/roles";
import type { Role } from "@/lib/roles";
import { formatDate, formatMoney } from "@/lib/utils";
import { revalidatePath } from "next/cache";

function contractBadge(s: string) {
  if (s === "SIGNED" || s === "DEPOSIT_PAID") return "hh-badge hh-badge--success";
  if (s === "SENT") return "hh-badge";
  if (s === "VOID") return "hh-badge hh-badge--danger";
  return "hh-badge";
}

export default async function ContractDetail({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");
  if (!canSeeFinancials(session.user.role as Role)) redirect("/dashboard");

  const { id } = await params;
  const c = await prisma.contract.findUnique({
    where: { id },
    include: {
      client: true,
      project: true,
      author: true,
      estimate: { include: { lineItems: true } },
    },
  });
  if (!c) notFound();

  const versions = c.projectId
    ? await prisma.contract.findMany({
        where: { projectId: c.projectId },
        orderBy: { version: "desc" },
        select: { id: true, number: true, version: true, status: true, createdAt: true },
      })
    : [];

  // Transitions are order-enforced server-side: DRAFT→SENT→SIGNED→DEPOSIT_PAID
  // (VOID only before signing). Every transition is audit-logged — manual
  // states stand in until e-sign/payment providers are chosen.
  async function markSent() {
    "use server";
    const me = await auth();
    if (!me?.user || !canSeeFinancials(me.user.role as Role)) return;
    const cur = await prisma.contract.findUnique({ where: { id } });
    if (cur?.status !== "DRAFT") return;
    await prisma.contract.update({ where: { id }, data: { status: "SENT", sentAt: new Date() } });
    await prisma.auditLog.create({ data: { actorId: me.user.id, action: "contract.sent", target: cur.number } });
    revalidatePath(`/contracts/${id}`);
  }

  async function markSigned(formData: FormData) {
    "use server";
    const me = await auth();
    if (!me?.user || !canSeeFinancials(me.user.role as Role)) return;
    const name = String(formData.get("signedByName") || "").trim();
    if (!name) return;
    const cur = await prisma.contract.findUnique({ where: { id } });
    if (cur?.status !== "SENT") return;
    await prisma.contract.update({
      where: { id },
      data: { status: "SIGNED", signedAt: new Date(), signedByName: name },
    });
    await prisma.auditLog.create({ data: { actorId: me.user.id, action: "contract.signed", target: cur.number } });
    revalidatePath(`/contracts/${id}`);
  }

  async function markDepositPaid() {
    "use server";
    const me = await auth();
    if (!me?.user || !canSeeFinancials(me.user.role as Role)) return;
    const cur = await prisma.contract.findUnique({ where: { id } });
    if (cur?.status !== "SIGNED") return;
    await prisma.contract.update({
      where: { id },
      data: { status: "DEPOSIT_PAID", depositPaidAt: new Date() },
    });
    await prisma.auditLog.create({ data: { actorId: me.user.id, action: "contract.deposit_paid", target: cur.number } });
    revalidatePath(`/contracts/${id}`);
  }

  async function voidContract() {
    "use server";
    const me = await auth();
    if (!me?.user || !canSeeFinancials(me.user.role as Role)) return;
    const cur = await prisma.contract.findUnique({ where: { id } });
    if (!cur || cur.status === "SIGNED" || cur.status === "DEPOSIT_PAID" || cur.status === "VOID") return;
    await prisma.contract.update({ where: { id }, data: { status: "VOID" } });
    await prisma.auditLog.create({ data: { actorId: me.user.id, action: "contract.void", target: cur.number } });
    revalidatePath(`/contracts/${id}`);
  }

  return (
    <>
      <PageHeader
        title={`${c.number} · ${c.title}`}
        subtitle={`${c.client.name}${c.project ? ` · ${c.project.name}` : ""} · v${c.version}`}
        actions={
          <>
            <a href={`/print/contracts/${c.id}`} target="_blank" rel="noopener noreferrer" className="btn-secondary">
              Print / PDF
            </a>
            {c.estimateId && (
              <Link href={`/estimates/${c.estimateId}`} className="btn-secondary">Source estimate</Link>
            )}
          </>
        }
      />
      <div className="grid gap-6 p-6 lg:grid-cols-3">
        <section className="hh-panel lg:col-span-2 overflow-hidden flex flex-col">
          <div className="border-b border-glass-border px-6 py-4 flex items-center justify-between">
            <h2 className="hh-label">Scope of work</h2>
            <span className={contractBadge(c.status)}>{c.status.toLowerCase()}</span>
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
                {(c.estimate?.lineItems ?? []).map((li) => (
                  <tr key={li.id} className="hh-row--flat">
                    <td className="px-5 py-3 hh-secondary">{li.category ?? "—"}</td>
                    <td className="px-5 py-3 hh-primary">{li.description}</td>
                    <td className="px-5 py-3 text-right hh-secondary">{li.quantity}</td>
                    <td className="px-5 py-3 text-right hh-secondary">{formatMoney(li.unitCents)}</td>
                    <td className="px-5 py-3 text-right hh-primary">{formatMoney(li.totalCents)}</td>
                  </tr>
                ))}
                {!c.estimate && (
                  <tr><td colSpan={5} className="px-5 py-6 text-center hh-secondary">No linked estimate — totals were entered directly.</td></tr>
                )}
              </tbody>
              <tfoot className="text-sm border-t border-glass-border">
                <tr>
                  <td colSpan={4} className="px-5 py-3 text-right hh-secondary">Subtotal</td>
                  <td className="px-5 py-3 text-right hh-primary">{formatMoney(c.subtotalCents)}</td>
                </tr>
                <tr>
                  <td colSpan={4} className="px-5 py-3 text-right hh-secondary">Tax</td>
                  <td className="px-5 py-3 text-right hh-primary">{formatMoney(c.taxCents)}</td>
                </tr>
                <tr>
                  <td colSpan={4} className="px-5 py-3 text-right hh-primary">Contract total</td>
                  <td className="px-5 py-3 text-right hh-primary font-bold">{formatMoney(c.totalCents)}</td>
                </tr>
                <tr>
                  <td colSpan={4} className="px-5 py-3 text-right hh-secondary">Deposit due on signing</td>
                  <td className="px-5 py-3 text-right hh-primary">{c.depositCents > 0 ? formatMoney(c.depositCents) : "—"}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>

        <aside className="space-y-6">
          <div className="hh-panel p-6 flex flex-col gap-4">
            <div className="pb-1">
              <h2 className="hh-label">Status</h2>
            </div>
            {c.status === "DRAFT" && (
              <form action={markSent}>
                <button className="btn btn-primary w-full justify-center" type="submit">Mark as sent</button>
              </form>
            )}
            {c.status === "SENT" && (
              <form action={markSigned} className="flex flex-col gap-2">
                <label className="hh-label">Signed by</label>
                <input name="signedByName" className="input" placeholder="Client name as signed" required />
                <button className="btn btn-primary w-full justify-center" type="submit">Record signature</button>
                <p className="hh-caption">E-signature via DocuSign plugs in here later — this records a manually collected signature.</p>
              </form>
            )}
            {c.status === "SIGNED" && (
              <>
                <p className="hh-secondary">
                  Signed by <span className="hh-primary">{c.signedByName}</span> on {formatDate(c.signedAt)}.
                </p>
                {c.depositCents > 0 && (
                  <form action={markDepositPaid}>
                    <button className="btn btn-primary w-full justify-center" type="submit">
                      Record deposit paid ({formatMoney(c.depositCents)})
                    </button>
                  </form>
                )}
              </>
            )}
            {c.status === "DEPOSIT_PAID" && (
              <p className="hh-secondary">
                Signed by <span className="hh-primary">{c.signedByName}</span> on {formatDate(c.signedAt)} ·
                deposit paid {formatDate(c.depositPaidAt)}.
              </p>
            )}
            {c.status !== "VOID" && c.status !== "SIGNED" && c.status !== "DEPOSIT_PAID" && (
              <form action={voidContract}>
                <button className="btn btn-destructive w-full justify-center" type="submit">Void contract</button>
              </form>
            )}
            {c.status === "VOID" && <p className="hh-secondary">This contract is void.</p>}
            <hr className="hh-divider" />
            <dl className="space-y-3.5 text-sm">
              <div className="flex justify-between gap-3"><dt className="hh-secondary">Author</dt><dd className="text-right hh-primary">{c.author.name}</dd></div>
              <div className="flex justify-between gap-3"><dt className="hh-secondary">Created</dt><dd className="text-right hh-primary">{formatDate(c.createdAt)}</dd></div>
              {c.sentAt && <div className="flex justify-between gap-3"><dt className="hh-secondary">Sent</dt><dd className="text-right hh-primary">{formatDate(c.sentAt)}</dd></div>}
            </dl>
          </div>

          {versions.length > 1 && (
            <div className="hh-panel p-6 flex flex-col gap-4">
              <div className="pb-1">
                <h2 className="hh-label">Versions on this project</h2>
              </div>
              <ul className="space-y-1">
                {versions.map((v) => (
                  <li key={v.id}>
                    <Link href={`/contracts/${v.id}`} className={`hh-row hh-row--flat ${v.id === c.id ? "hh-row--active" : ""}`}>
                      <span className="hh-primary">v{v.version}</span>
                      <span className="hh-secondary flex-1">{v.number}</span>
                      <span className={contractBadge(v.status)}>{v.status.toLowerCase()}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="hh-panel p-6 flex flex-col gap-4">
            <div className="pb-1">
              <h2 className="hh-label">QuickBooks</h2>
            </div>
            <p className="hh-secondary">
              Once signed, push an invoice for the deposit with a payment link.
            </p>
            <button className="btn-secondary w-full justify-center" disabled>
              Create QB invoice (setup required)
            </button>
          </div>
        </aside>
      </div>
    </>
  );
}
