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
  if (s === "SIGNED" || s === "DEPOSIT_PAID") return "hh-badge hh-badge--success";
  if (s === "SENT") return "hh-badge";
  if (s === "VOID") return "hh-badge hh-badge--danger";
  return "hh-badge";
}

const CONTRACT_STATUSES = ["DRAFT", "SENT", "SIGNED", "DEPOSIT_PAID", "VOID"];

export default async function ContractsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");
  const role = session.user.role as Role;

  // Clients see only their own signed contracts — nothing else on this page.
  if (role === "CLIENT") {
    const clientId = session.user.clientId;
    const own = clientId
      ? await prisma.contract.findMany({
          where: { clientId, status: { in: ["SIGNED", "DEPOSIT_PAID"] } },
          orderBy: { signedAt: "desc" },
        })
      : [];
    return (
      <>
        <PageHeader title="Contracts" subtitle="Your signed agreements with Henley Contracting." />
        <div className="p-6 space-y-2 max-w-2xl">
          {own.length === 0 && (
            <div className="hh-panel p-6 hh-secondary">No signed contracts yet.</div>
          )}
          {own.map((c) => (
            <a key={c.id} href={`/print/contracts/${c.id}`} target="_blank" rel="noopener noreferrer" className="hh-row">
              <span className="hh-chip">{c.number}</span>
              <span className="hh-primary flex-1">{c.title}</span>
              <span className="hh-secondary">{formatMoney(c.totalCents)}</span>
              <span className={contractBadge(c.status)}>{c.status === "DEPOSIT_PAID" ? "deposit paid" : "signed"}</span>
            </a>
          ))}
        </div>
      </>
    );
  }

  if (!canSeeFinancials(role)) {
    return <div className="p-8 hh-secondary">Contracts are visible to office staff only.</div>;
  }

  const sp = await searchParams;
  const statusFilter = CONTRACT_STATUSES.includes(sp.status ?? "") ? sp.status : null;

  const depositSetting = await prisma.setting
    .findUnique({ where: { key: "contracts.defaultDepositPct" } })
    .catch(() => null);
  const defaultDepositPct = ["0", "10", "25", "50"].includes(depositSetting?.value ?? "")
    ? depositSetting!.value
    : "10";

  const [contracts, acceptedEstimates, projects] = await Promise.all([
    prisma.contract.findMany({
      where: statusFilter ? { status: statusFilter } : {},
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

  // Backfill: record a REAL historical signed agreement (pre-Hub). Explicitly
  // labeled and audit-logged; never invents rows — Nick enters the true
  // signed total and date, and links the scanned document via Files.
  async function backfillContract(formData: FormData) {
    "use server";
    const me = await auth();
    if (!me?.user) return;
    if (!canSeeFinancials(me.user.role as Role)) return;

    const jobId = String(formData.get("jobId") || "");
    const title = String(formData.get("title") || "").trim();
    const totalDollars = Number(formData.get("total") || 0);
    const signedDate = String(formData.get("signedAt") || "");
    const signedByName = String(formData.get("signedByName") || "").trim();
    if (!jobId || !title || !(totalDollars > 0) || !signedDate) return;

    const job = await prisma.project.findUnique({ where: { id: jobId } });
    if (!job) return;
    const signedAt = new Date(signedDate + "T12:00:00");
    if (isNaN(signedAt.getTime())) return;

    const [total, versionBase] = await Promise.all([
      prisma.contract.count(),
      prisma.contract.count({ where: { projectId: jobId } }),
    ]);
    const contract = await prisma.contract.create({
      data: {
        number: `CT-${1001 + total}`,
        version: versionBase + 1,
        clientId: job.clientId,
        projectId: jobId,
        authorId: me.user.id,
        title,
        status: "SIGNED",
        totalCents: Math.round(totalDollars * 100),
        subtotalCents: Math.round(totalDollars * 100),
        signedAt,
        signedByName: signedByName || null,
        backfilledAt: new Date(),
      },
    });
    await prisma.auditLog.create({
      data: { actorId: me.user.id, action: "contract.backfill", target: contract.number },
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
                <select name="depositPct" className="input" defaultValue={defaultDepositPct}>
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

        <section className="hh-panel p-6 flex flex-col gap-4">
          <div>
            <h2 className="hh-label">Record existing contract (backfill)</h2>
            <p className="hh-caption mt-1">
              For real, already-signed historical agreements only. Upload the scanned
              document on the Files page against the same job.
            </p>
          </div>
          <form action={backfillContract} className="grid gap-3 md:grid-cols-12 md:items-end">
            <div className="md:col-span-4">
              <label className="hh-label block mb-1.5">Job</label>
              <select name="jobId" className="input" required>
                <option value="">Select…</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} — {p.client.name}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-3">
              <label className="hh-label block mb-1.5">Title</label>
              <input name="title" className="input" placeholder="e.g. Construction agreement" required />
            </div>
            <div className="md:col-span-2">
              <label className="hh-label block mb-1.5">Signed total ($)</label>
              <input name="total" type="number" step="0.01" min="1" className="input text-right" required />
            </div>
            <div className="md:col-span-2">
              <label className="hh-label block mb-1.5">Signed date</label>
              <input name="signedAt" type="date" className="input" required />
            </div>
            <div className="md:col-span-1">
              <button className="btn btn-secondary w-full justify-center" type="submit">Record</button>
            </div>
            <div className="md:col-span-4">
              <label className="hh-label block mb-1.5">Signed by (optional)</label>
              <input name="signedByName" className="input" placeholder="Client name as signed" />
            </div>
          </form>
        </section>

        <div className="flex flex-wrap items-center gap-1.5">
          <Link
            href="/contracts"
            className={`badge ${!statusFilter ? "border-accent bg-accent/10 text-accent font-semibold" : "bg-row-bg border border-glass-border text-ink-soft hover:bg-row-hover hover:text-ink"}`}
          >
            All
          </Link>
          {CONTRACT_STATUSES.map((s) => (
            <Link
              key={s}
              href={`/contracts?status=${s}`}
              className={`badge ${statusFilter === s ? "border-accent bg-accent/10 text-accent font-semibold" : "bg-row-bg border border-glass-border text-ink-soft hover:bg-row-hover hover:text-ink"}`}
            >
              {s.replace("_", " ").toLowerCase()}
            </Link>
          ))}
        </div>

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
                <tr>
                  <td colSpan={9} className="px-5 py-6 text-center hh-secondary">
                    {statusFilter ? `No ${statusFilter.replace("_", " ").toLowerCase()} contracts.` : "No contracts yet. Convert an accepted estimate or record a historical one above."}
                  </td>
                </tr>
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
                  <td className="px-5 py-3">
                    <span className={contractBadge(c.status)}>{c.status.replace("_", " ").toLowerCase()}</span>
                    {c.backfilledAt && <span className="hh-caption ml-1.5" title="Recorded from a pre-Hub signed agreement">backfill</span>}
                  </td>
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
