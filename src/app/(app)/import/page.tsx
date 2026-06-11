import PageHeader from "@/components/PageHeader";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { canViewAllProjects, type Role } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { parseCsv, inferMapping, buildClientFromRow } from "@/lib/csv";
import { revalidatePath } from "next/cache";

export default async function ImportPage({
  searchParams,
}: {
  searchParams: Promise<{ result?: string; created?: string; skipped?: string }>;
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
    const mapping = inferMapping(headers);

    let created = 0;
    let skipped = 0;
    for (const row of rows) {
      const data = buildClientFromRow(row, mapping);
      if (!data) {
        skipped++;
        continue;
      }
      if (data.primaryEmail) {
        const existing = await prisma.client.findFirst({ where: { primaryEmail: data.primaryEmail } });
        if (existing) {
          skipped++;
          continue;
        }
      }
      await prisma.client.create({ data });
      created++;
    }
    revalidatePath("/clients");
    redirect(`/import?result=ok&created=${created}&skipped=${skipped}`);
  }

  return (
    <>
      <PageHeader
        title="Import clients"
        subtitle="Upload a CSV from HubSpot, QuickBooks, your milestone tracker — anything. Columns get auto-matched."
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
                Must include a header row. Existing clients (matched by email) are skipped, not duplicated.
              </p>
            </div>
            <button className="btn-primary" type="submit">Import</button>
            {sp.result === "ok" && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                Created {sp.created} client{sp.created === "1" ? "" : "s"}. Skipped {sp.skipped} (no name or duplicate email).
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
              <Field label="Stage" aliases="Lifecycle Stage, Deal Stage, Status" />
              <Field label="Notes" aliases="Notes, Description, Comments" />
            </ul>
          </section>
          <section className="card p-5">
            <h2 className="text-sm font-semibold">HubSpot stage mapping</h2>
            <p className="mt-2 hh-caption">
              HubSpot lifecycle / deal stages are normalized:
            </p>
            <ul className="mt-2 space-y-1 text-xs text-slate-600">
              <li>Subscriber → <code>LEAD</code></li>
              <li>MQL / SQL → <code>QUALIFIED</code></li>
              <li>Opportunity / Contract Sent → <code>PROPOSAL</code></li>
              <li>Closed Won → <code>WON</code></li>
              <li>Closed Lost → <code>LOST</code></li>
              <li>Customer → <code>ACTIVE</code></li>
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
