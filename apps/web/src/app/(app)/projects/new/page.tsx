import PageHeader from "@/components/PageHeader";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import {
  JOB_STATUS,
  JOB_TYPE,
  PIPELINE_STAGE,
  DIVISION,
  isValidJobStatus,
  isValidJobType,
  isValidPipelineStage,
  isValidDivision,
} from "@/lib/taxonomy";

export default async function NewJobPage() {
  const clients = await prisma.client.findMany({ orderBy: { name: "asc" } });
  const engagements = await prisma.engagement.findMany({
    orderBy: { updatedAt: "desc" },
    include: { client: { select: { name: true } } },
  });

  async function create(formData: FormData) {
    "use server";
    const name = String(formData.get("name") || "").trim();
    const clientId = String(formData.get("clientId") || "");
    if (!name || !clientId) return;

    // Optional parent project (engagement) — must belong to the same client.
    const engagementId = String(formData.get("engagementId") || "") || null;
    if (engagementId) {
      const e = await prisma.engagement.findUnique({ where: { id: engagementId } });
      if (!e || e.clientId !== clientId) return;
    }

    const rawStatus = String(formData.get("status") || "OPEN");
    const rawJobType = String(formData.get("jobType") || "");
    const rawPipeline = String(formData.get("pipelineStage") || "");
    const rawDivision = String(formData.get("division") || "");

    const p = await prisma.project.create({
      data: {
        name,
        clientId,
        engagementId,
        address: String(formData.get("address") || "") || null,
        contractCents: Math.round(Number(formData.get("contract") || 0) * 100),
        budgetCents: Math.round(Number(formData.get("budget") || 0) * 100),
        description: String(formData.get("description") || "") || null,
        status: isValidJobStatus(rawStatus) ? rawStatus : "OPEN",
        jobType: isValidJobType(rawJobType) ? rawJobType : null,
        pipelineStage: isValidPipelineStage(rawPipeline) ? rawPipeline : null,
        division: isValidDivision(rawDivision) ? rawDivision : null,
        projectManager: String(formData.get("projectManager") || "") || null,
        salesRep: String(formData.get("salesRep") || "") || null,
      },
    });
    redirect(`/projects/${p.id}`);
  }

  return (
    <>
      <PageHeader title="New job" subtitle="Jobs live under a project (client engagement) — pick one below or leave it for later triage." />
      <form action={create} className="max-w-2xl space-y-4 p-6">
        <div className="card space-y-4 p-5">
          {/* ── Client + name ─────────────────────────────────────────────── */}
          <div>
            <label className="label">Client</label>
            <select name="clientId" className="input mt-1" required>
              <option value="">Select...</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Job name</label>
            <input className="input mt-1" name="name" required />
          </div>
          <div>
            <label className="label">Project (optional)</label>
            <select name="engagementId" className="input mt-1">
              <option value="">— none yet —</option>
              {engagements.map((e) => (
                <option key={e.id} value={e.id}>{e.name} · {e.client.name}</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-500">Must match the chosen client — mismatches are rejected.</p>
          </div>
          <div>
            <label className="label">Address</label>
            <input className="input mt-1" name="address" />
          </div>

          {/* ── Taxonomy fields ───────────────────────────────────────────── */}
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label">Status</label>
              <select name="status" className="input mt-1" defaultValue="PRESALE">
                {JOB_STATUS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Division</label>
              <select name="division" className="input mt-1">
                <option value="">—</option>
                {DIVISION.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label">Job type</label>
              <select name="jobType" className="input mt-1">
                <option value="">—</option>
                {JOB_TYPE.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Pipeline stage</label>
              <select name="pipelineStage" className="input mt-1">
                <option value="">—</option>
                {PIPELINE_STAGE.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label">Project manager</label>
              <input className="input mt-1" name="projectManager" placeholder="Name" />
            </div>
            <div>
              <label className="label">Sales rep</label>
              <input className="input mt-1" name="salesRep" placeholder="Name" />
            </div>
          </div>

          {/* ── Financials ────────────────────────────────────────────────── */}
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label">Contract ($)</label>
              <input className="input mt-1" name="contract" type="number" step="100" />
            </div>
            <div>
              <label className="label">Budget ($)</label>
              <input className="input mt-1" name="budget" type="number" step="100" />
            </div>
          </div>
          <div>
            <label className="label">Description</label>
            <textarea name="description" rows={3} className="input mt-1" />
          </div>
        </div>
        <div className="flex justify-end">
          <button className="btn-primary" type="submit">Create job</button>
        </div>
      </form>
    </>
  );
}
