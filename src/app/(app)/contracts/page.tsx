import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { canSeeFinancials } from "@/lib/roles";
import type { Role } from "@/lib/roles";
import { formatMoney, formatRelative } from "@/lib/utils";
import { revalidatePath } from "next/cache";

function contractBadge(s: string) {
  if (s === "SIGNED") return "hh-badge hh-badge--success";
  if (s === "SENT") return "hh-badge";
  if (s === "VOID") return "hh-badge hh-badge--danger";
  return "hh-badge";
}

export default async function ContractsPage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");
  const role = session.user.role as Role;
  if (!canSeeFinancials(role)) {
    return <div className="p-8 hh-secondary">Contracts are visible to office staff only.</div>;
  }

  const [contracts, acceptedEstimates, projects] = await Promise.all([
    prisma.contract.findMany({
      orderBy: { createdAt: "desc" },
      include: { client: true, project: true },
    }),
    prisma.estimate.findMany({
      where: { status: "ACCEPTED", contracts: { none: { status: { not: "VOID" } } } },
      orderBy: { updatedAt: "desc" },
      include: { client: true },
    }),
    prisma.project.findMany({ orderBy: { updatedAt: "desc" }, include: { client: true } }),
  ]);

  async function convertEstimate(formData: FormData) {
    "use server";
    const me = await auth();
    if (!me?.user) return;
    if (!canSeeFinancials(me.user.role as Role)) return;

    const estimateId = String(formData.get("estimateId") || "");
    const projectId = String(formData.get("projectId") || "");
    const depositPct = Number(formData.get("depositPct") || 0);

    const estimate = await prisma.estimate.findUnique({
      where: { id: estimateId },
      include: { client: true },
    });
    if (!estimate || estimate.status !== "ACCEPTED") return;

    let linkedProjectId: string | null = null;
    if (projectId) {
      const project = await prisma.project.findUnique({ where: { id: projectId } });
      if (project && project.clientId === estimate.clientId) linkedProjectId = project.id;
    }

    const [total, versionBase] = await Promise.all([
      prisma.contract.count(),
      linkedProjectId
        ? prisma.contract.count({ where: { projectId: linkedProjectId } })
        : prisma.contract.count({ where: { clientId: estimate.clientId, projectId: null } }),
    ]);

    const contract = await prisma.contract.create({
      data: {
        number: `CT-${1001 + total}`,
        version: versionBase + 1,
        clientId: estimate.clientId,
        projectId: linkedProjectId,
        estimateId: estimate.id,
        authorId: me.user.id,
        title: estimate.title,
        subtotalCents: estimate.subtotalCents,
        taxCents: estimate.taxCents,
        totalCents: estimate.totalCents,
        depositCents: Math.round((estimate.totalCents * depositPct) / 100),
        terms: estimate.notes,
      },
    });
    revalidatePath("/contracts");
    redirect(`/contracts/${contract.id}`);
  }

  return (
    <>
      <PageHeader
        title="Contracts"
        subtitle="Accepted estimates converted into signable contracts, versioned per project."
      />
      <div className="space-y-6 p-6">
        <section className="hh-panel p-6 flex flex-col gap-4">
          <div>
            <h2 className="hh-label">Convert accepted estimate</h2>
            <p className="hh-caption mt-1">
              One click from estimate to contract. Totals are snapshotted; deposit is calculated from the total.
            </p>
          </div>
          {acceptedEstimates.length === 0 ? (
            <p className="hh-secondary">No accepted estimates waiting for conversion.</p>
          ) : (
            <form action={convertEstimate} className="grid gap-3 md:grid-cols-12 md:items-end">
              <div className="md:col-span-5">
                <label className="hh-label block mb-1.5">Estimate</label>
                <select name="estimateId" className="input" required>
                  {acceptedEstimates.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.number} · {e.client.name} · {e.title} ({formatMoney(e.totalCents)})
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-4">
                <label className="hh-label block mb-1.5">Link to project (optional)</label>
                <select name="projectId" className="input" defaultValue="">
                  <option value="">— none —</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} — {p.client.name}</option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="hh-label block mb-1.5">Deposit</label>
                <select name="depositPct" className="input" defaultValue="10">
                  <option value="0">None</option>
                  <option value="10">10%</option>
                  <option value="25">25%</option>
                  <option value="50">50%</option>
                </select>
              </div>
              <div className="md:col-span-1">
                <button className="btn btn-primary w-full justify-center" type="submit">Convert</button>
              </div>
            </form>
          )}
        </section>

        <section className="hh-panel overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b border-glass-border">
              <tr>
                <th className="hh-label px-5 py-3.5 text-left">Number</th>
                <th className="hh-label px-5 py-3.5 text-left">Client</th>
                <th className="hh-label px-5 py-3.5 text-left">Project</th>
                <th className="hh-label px-5 py-3.5 text-left">Title</th>
                <th className="hh-label px-5 py-3.5 text-center">Ver</th>
                <th className="hh-label px-5 py-3.5 text-left">Status</th>
                <th className="hh-label px-5 py-3.5 text-right">Total</th>
                <th className="hh-label px-5 py-3.5 text-right">Deposit</th>
                <th className="hh-label px-5 py-3.5 text-left">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-glass-border">
              {contracts.length === 0 && (
                <tr><td colSpan={9} className="px-5 py-6 text-center hh-secondary">No contracts yet. Convert an accepted estimate above.</td></tr>
              )}
              {contracts.map((c) => (
                <tr key={c.id} className="hh-row--flat">
                  <td className="px-5 py-3">
                    <Link href={`/contracts/${c.id}`}><span className="hh-chip">{c.number}</span></Link>
                  </td>
                  <td className="px-5 py-3 hh-primary">{c.client.name}</td>
                  <td className="px-5 py-3 hh-secondary">{c.project?.name ?? "—"}</td>
                  <td className="px-5 py-3 hh-secondary">{c.title}</td>
                  <td className="px-5 py-3 text-center hh-secondary">v{c.version}</td>
                  <td className="px-5 py-3"><span className={contractBadge(c.status)}>{c.status.toLowerCase()}</span></td>
                  <td className="px-5 py-3 text-right hh-primary">{formatMoney(c.totalCents)}</td>
                  <td className="px-5 py-3 text-right hh-secondary">{c.depositCents > 0 ? formatMoney(c.depositCents) : "—"}</td>
                  <td className="px-5 py-3 hh-secondary">{formatRelative(c.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </>
  );
}
