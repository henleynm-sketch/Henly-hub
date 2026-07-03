import PageHeader from "@/components/PageHeader";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { canViewAllProjects, type Role } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { parseCsv, inferMapping, buildClientFromRow, normalizePipelineStage, projectStatusForStage } from "@/lib/csv";
import { revalidatePath } from "next/cache";

export default async function ImportPage({
  searchParams,
}: {
  searchParams: Promise<{
    result?: string;
    cc?: string;
    cf?: string;
    pc?: string;
    ps?: string;
    sn?: string;
  }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");
  if (!canViewAllProjects(session.user.role as Role)) {
    return <div className="p-8 text-sm text-slate-500">Office staff only.</div>;
  }
  const sp = await searchParams;

  async function importCsv(formData: FormData) {
    "use server";
    const me = await auth();
    if (!me?.user) return;
    if (!canViewAllProjects(me.user.role as Role)) return;
    const file = formData.get("file") as File | null;
    if (!file) return;
    const text = await file.text();
    const { headers, rows } = parseCsv(text);
    const m = inferMapping(headers);

    let clientsCreated = 0;
    let clientsFound = 0;
    let projectsCreated = 0;
    let projectsSkipped = 0;
    let skippedNoName = 0;

    for (const row of rows) {
      const data = buildClientFromRow(row, m);
      if (!data) {
        skippedNoName++;
        continue;
      }

      // Normalize pipeline stage from "Deal Stage" / "Stage" column
      const rawStage = m["stage"] ? (row[m["stage"]!] ?? "") : "";
      const pipelineStage = normalizePipelineStage(rawStage) ?? "New Lead";
      const status = projectStatusForStage(pipelineStage);

      // Find or create client -- always import if name present, email optional
      let clientId: string;
      if (data.primaryEmail) {
        const existing = await prisma.client.findFirst({
          where: { primaryEmail: data.primaryEmail },
          select: { id: true },
        });
        if (existing) {
          clientId = existing.id;
          clientsFound++;
        } else {
          const created = await prisma.client.create({
            data: {
              name: data.name,
              primaryEmail: data.primaryEmail,
              primaryPhone: data.primaryPhone,
              address: data.address,
              city: data.city,
              state: data.state,
              zip: data.zip,
              source: data.source,
              leadSource: data.source,
              stage: data.stage,
              notes: data.notes,
            },
          });
          clientId = created.id;
          clientsCreated++;
        }
      } else {
        const created = await prisma.client.create({
          data: {
            name: data.name,
            primaryEmail: data.primaryEmail,
            primaryPhone: data.primaryPhone,
            address: data.address,
            city: data.city,
            state: data.state,
            zip: data.zip,
            source: data.source,
            leadSource: data.source,
            stage: data.stage,
            notes: data.notes,
          },
        });
        clientId = created.id;
        clientsCreated++;
      }

      // Idempotency: skip if project with this name already exists for client
      const projectName = data.name;
      const existingProject = await prisma.project.findFirst({
        where: { clientId, name: projectName },
        select: { id: true },
      });
      if (existingProject) {
        projectsSkipped++;
      } else {
        await prisma.project.create({
          data: {
            clientId,
            name: projectName,
            pipelineStage,
            status,
            description: data.notes,
          },
        });
        projectsCreated++;
      }
    }

    revalidatePath("/clients");
    revalidatePath("/crm");
    const params = new URLSearchParams({
      result: "ok",
      cc: String(clientsCreated),
      cf: String(clientsFound),
      pc: String(projectsCreated),
      ps: String(projectsSkipped),
      sn: String(skippedNoName),
    });
    redirect(`/import?${params.toString()}`);
  }

  return (
    <>
      <PageHeader
        title="Import clients"
        subtitle="Upload a CSV from HubSpot, QuickBooks, your milestone tracker -- anything. Columns get auto-matched."
      />
      <div className="grid gap-6 p-6 lg:grid-cols-3">
        <form action={importCsv} className="hh-panel !p-0 lg:col-span-2">
          <div className="border-b border-glass-border px-5 py-4">
            <h2 className="hh-label">Upload CSV</h2>
          </div>
          <div className="space-y-4 p-5">
            <div>
              <label className="label">CSV file</label>
              <input
                name="file"
                type="file"
                accept=".csv,text/csv"
                required
                className="input input-file mt-1"
              />
              <p className="mt-2 hh-caption">
                Must include a header row. Each row creates a client (or matches by email) and a pipeline project. Re-importing the same file is safe.
              </p>
            </div>
            <button className="btn-primary" type="submit">Import</button>
            {sp.result === "ok" && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 space-y-0.5">
                <p>
                  {sp.cc !== "0" && (
                    <span>Created {sp.cc} new client{sp.cc === "1" ? "" : "s"}. </span>
                  )}
                  {sp.cf !== "0" && (
                    <span>Matched {sp.cf} existing client{sp.cf === "1" ? "" : "s"}. </span>
                  )}
                </p>
                <p>
                  Created {sp.pc} project{sp.pc === "1" ? "" : "s"} on the CRM board.
                  {sp.ps !== "0" && (
                    <span> Skipped {sp.ps} duplicate project{sp.ps === "1" ? "" : "s"}.</span>
                  )}
                </p>
                {sp.sn !== "0" && (
                  <p>Skipped {sp.sn} row{sp.sn === "1" ? "" : "s"} with no name.</p>
                )}
              </div>
            )}
          </div>
        </form>

        <aside className="space-y-4">
          <section className="card p-5">
            <h2 className="text-sm font-semibold">Auto-matched fields</h2>
            <p className="mt-2 hh-caption">
              The importer looks for these header names (case-insensitive):
            </p>
            <ul className="mt-3 space-y-2 text-xs text-slate-600">
              <Field label="Name" aliases="Name, Full Name, Company Name, First Name + Last Name" />
              <Field label="Email" aliases="Email, Email Address, Primary Email" />
              <Field label="Phone" aliases="Phone, Mobile, Cell, Primary Phone" />
              <Field label="Address" aliases="Address, Street Address, Address Line 1" />
              <Field label="City / State / Zip" aliases="City, State/Region, Zip / Postal Code" />
              <Field label="Source" aliases="Lead Source, Original Source, Original Traffic Source" />
              <Field label="Deal Stage" aliases="Deal Stage, Lifecycle Stage, Stage, Status" />
              <Field label="Notes" aliases="Notes, Description, Comments" />
            </ul>
          </section>
          <section className="card p-5">
            <h2 className="text-sm font-semibold">Deal stage mapping</h2>
            <p className="mt-2 hh-caption">
              Deal stages are matched to Henley pipeline stages and set project status:
            </p>
            <ul className="mt-2 space-y-1 text-xs text-slate-600">
              <li>New Lead through Negotiation &rarr; <code>PRESALE</code></li>
              <li>Closed Won &rarr; <code>OPEN</code></li>
              <li>Closed Lost &rarr; <code>CLOSED</code></li>
            </ul>
          </section>
        </aside>
      </div>
    </>
  );
}

function Field({ label, aliases }: { label: string; aliases: string }) {
  return (
    <li>
      <div className="font-medium text-slate-700">{label}</div>
      <div>Matches: {aliases}</div>
    </li>
  );
}
