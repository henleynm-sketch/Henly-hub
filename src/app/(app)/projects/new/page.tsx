import PageHeader from "@/components/PageHeader";
import { prisma } from "@/lib/prisma";
import { createProject } from "@/lib/services/projectService";
import { redirect } from "next/navigation";

export default async function NewProjectPage() {
  const clients = await prisma.client.findMany({ orderBy: { name: "asc" } });

  async function create(formData: FormData) {
    "use server";
    const name = String(formData.get("name") || "").trim();
    const clientId = String(formData.get("clientId") || "");
    if (!name || !clientId) return;
    const p = await createProject({
      name,
      clientId,
      address: String(formData.get("address") || "") || null,
      contractCents: Math.round(Number(formData.get("contract") || 0) * 100),
      budgetCents: Math.round(Number(formData.get("budget") || 0) * 100),
      description: String(formData.get("description") || "") || null,
    });
    redirect(`/projects/${p.id}`);
  }

  return (
    <>
      <PageHeader title="New project" />
      <form action={create} className="max-w-2xl space-y-4 p-6">
        <div className="card space-y-4 p-5">
          <div>
            <label className="label">Client</label>
            <select name="clientId" className="input mt-1" required>
              <option value="">Select…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Project name</label>
            <input className="input mt-1" name="name" required />
          </div>
          <div>
            <label className="label">Address</label>
            <input className="input mt-1" name="address" />
          </div>
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
          <button className="btn-primary" type="submit">Create project</button>
        </div>
      </form>
    </>
  );
}
