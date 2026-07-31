import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { canManageTeam, type Role } from "@/lib/roles";
import PageHeader from "@/components/PageHeader";
import ImportWizard from "./ImportWizard";

export default async function DataImportPage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");
  if (!canManageTeam(session.user.role as Role)) redirect("/settings");

  return (
    <>
      <PageHeader
        title="Data import"
        subtitle="Load clients and jobs from HubSpot, BuilderTrend, or any CSV — mapped, dry-run, then written."
      />
      <div className="p-6">
        <div className="mx-auto max-w-4xl">
          <ImportWizard />
        </div>
      </div>
    </>
  );
}
