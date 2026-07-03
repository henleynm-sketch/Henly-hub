import PageHeader from "@/components/PageHeader";
import { createClient } from "@/lib/services/clientService";
import { redirect } from "next/navigation";

export default function NewClientPage() {
  async function create(formData: FormData) {
    "use server";
    const name = String(formData.get("name") || "").trim();
    if (!name) return;
    const c = await createClient({
      name,
      primaryEmail: String(formData.get("email") || "").trim() || null,
      primaryPhone: String(formData.get("phone") || "").trim() || null,
      address: String(formData.get("address") || "").trim() || null,
      city: String(formData.get("city") || "").trim() || null,
      state: String(formData.get("state") || "").trim() || null,
      zip: String(formData.get("zip") || "").trim() || null,
      source: String(formData.get("source") || "").trim() || null,
      notes: String(formData.get("notes") || "").trim() || null,
    });
    redirect(`/clients/${c.id}`);
  }

  return (
    <>
      <PageHeader title="New lead" subtitle="Capture the basics. You can add a project and estimate next." />
      <form action={create} className="max-w-2xl space-y-4 p-6">
        <div className="card space-y-4 p-5">
          <Field name="name" label="Client name" required />
          <div className="grid gap-4 md:grid-cols-2">
            <Field name="email" label="Email" type="email" />
            <Field name="phone" label="Phone" />
          </div>
          <Field name="address" label="Project address" />
          <div className="grid gap-4 md:grid-cols-3">
            <Field name="city" label="City" />
            <Field name="state" label="State" />
            <Field name="zip" label="Zip" />
          </div>
          <Field name="source" label="Source (referral, web, etc.)" />
          <div>
            <label className="label">Notes</label>
            <textarea name="notes" rows={4} className="input mt-1" />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button className="btn-primary" type="submit">Create lead</button>
        </div>
      </form>
    </>
  );
}

function Field({
  name,
  label,
  type = "text",
  required,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <input className="input mt-1" name={name} type={type} required={required} />
    </div>
  );
}
