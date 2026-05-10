import PageHeader from "@/components/PageHeader";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

const SUGGESTED_CATEGORIES = [
  "Demolition",
  "Framing",
  "Plumbing",
  "Electrical",
  "HVAC",
  "Drywall",
  "Cabinets",
  "Countertops",
  "Tile",
  "Flooring",
  "Paint",
  "Trim",
  "Permits",
  "Project management",
];

export default async function NewEstimatePage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string }>;
}) {
  const sp = await searchParams;
  const clients = await prisma.client.findMany({ orderBy: { name: "asc" } });
  const preset = sp.clientId
    ? clients.find((c) => c.id === sp.clientId)
    : null;

  async function create(formData: FormData) {
    "use server";
    const session = await auth();
    if (!session?.user) return;
    const clientId = String(formData.get("clientId") || "");
    const title = String(formData.get("title") || "").trim();
    if (!clientId || !title) return;

    const lines: { category: string; description: string; qty: number; unitCents: number }[] = [];
    SUGGESTED_CATEGORIES.forEach((cat) => {
      const desc = String(formData.get(`desc_${cat}`) || "").trim();
      const qty = Number(formData.get(`qty_${cat}`) || 0);
      const unit = Number(formData.get(`unit_${cat}`) || 0);
      if (desc && qty > 0 && unit > 0) {
        lines.push({ category: cat, description: desc, qty, unitCents: Math.round(unit * 100) });
      }
    });

    const subtotalCents = lines.reduce((a, l) => a + l.qty * l.unitCents, 0);
    const taxRate = Number(formData.get("taxRate") || 0) / 100;
    const taxCents = Math.round(subtotalCents * taxRate);
    const totalCents = subtotalCents + taxCents;

    const count = await prisma.estimate.count();
    const number = `EST-${String(1001 + count).padStart(4, "0")}`;

    const est = await prisma.estimate.create({
      data: {
        clientId,
        authorId: session.user.id,
        number,
        title,
        status: "DRAFT",
        notes: String(formData.get("notes") || "") || null,
        subtotalCents,
        taxCents,
        totalCents,
        lineItems: {
          create: lines.map((l) => ({
            category: l.category,
            description: l.description,
            quantity: l.qty,
            unitCents: l.unitCents,
            totalCents: l.qty * l.unitCents,
          })),
        },
      },
    });
    redirect(`/estimates/${est.id}`);
  }

  return (
    <>
      <PageHeader
        title="New estimate"
        subtitle="Auto-fills from the selected client. Fill only the categories you need."
      />
      <form action={create} className="space-y-4 p-6">
        <div className="card space-y-4 p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label">Client</label>
              <select name="clientId" className="input mt-1" defaultValue={preset?.id ?? ""} required>
                <option value="">Select…</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.address ? `· ${c.address}` : ""}
                  </option>
                ))}
              </select>
              {preset && (
                <p className="mt-1 text-xs text-slate-500">
                  Address auto-pulled: {preset.address ?? "—"} · {preset.city ?? ""} {preset.state ?? ""}
                </p>
              )}
            </div>
            <div>
              <label className="label">Title</label>
              <input
                className="input mt-1"
                name="title"
                placeholder="e.g. Kitchen remodel — initial estimate"
                required
              />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label">Tax rate (%)</label>
              <input className="input mt-1" name="taxRate" type="number" step="0.01" defaultValue={6.5} />
            </div>
            <div>
              <label className="label">Estimate # (auto)</label>
              <input className="input mt-1" disabled placeholder="EST-XXXX (assigned on save)" />
            </div>
          </div>
          <div>
            <label className="label">Notes for client</label>
            <textarea name="notes" rows={2} className="input mt-1" />
          </div>
        </div>

        <div className="card overflow-x-auto">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-sm font-semibold">Line items</h2>
            <p className="text-xs text-slate-500">
              Fill quantity + unit price for any category that applies. Empty rows are skipped.
            </p>
          </div>
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3 text-left font-medium w-44">Category</th>
                <th className="px-5 py-3 text-left font-medium">Description</th>
                <th className="px-5 py-3 text-right font-medium w-24">Qty</th>
                <th className="px-5 py-3 text-right font-medium w-32">Unit ($)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {SUGGESTED_CATEGORIES.map((cat) => (
                <tr key={cat}>
                  <td className="px-5 py-2 font-medium text-slate-700">{cat}</td>
                  <td className="px-5 py-2">
                    <input className="input" name={`desc_${cat}`} placeholder={`${cat.toLowerCase()} scope…`} />
                  </td>
                  <td className="px-5 py-2"><input className="input text-right" name={`qty_${cat}`} type="number" step="0.5" /></td>
                  <td className="px-5 py-2"><input className="input text-right" name={`unit_${cat}`} type="number" step="0.01" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end">
          <button className="btn-primary" type="submit">Create estimate</button>
        </div>
      </form>
    </>
  );
}
