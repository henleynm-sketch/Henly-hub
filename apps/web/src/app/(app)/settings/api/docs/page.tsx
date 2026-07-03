import { auth } from "@/auth";
import { redirect } from "next/navigation";
import type { Role } from "@/lib/roles";
import PageHeader from "@/components/PageHeader";
import SwaggerDocs from "@/components/SwaggerDocs";

// CEO + Office only — same gate as the rest of Settings.
export default async function ApiDocsPage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");
  const role = session.user.role as Role;
  if (role !== "CEO" && role !== "OFFICE") redirect("/dashboard");

  return (
    <>
      <PageHeader
        title="API docs"
        subtitle="The v1 external API — every endpoint, scope, request body, and response shape."
      />
      <div className="p-6">
        <div className="hh-panel p-2">
          <SwaggerDocs />
        </div>
      </div>
    </>
  );
}
