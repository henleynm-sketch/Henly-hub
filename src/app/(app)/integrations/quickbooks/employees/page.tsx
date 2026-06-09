import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/PageHeader";
import { listQBOEmployees, type QBOEmployee } from "../employeeMapActions";
import EmployeeMapTable from "./EmployeeMapTable";

export default async function QBOEmployeeMapPage() {
  const me = await auth();
  const role = me?.user?.role;
  if (!me?.user?.id || (role !== "CEO" && role !== "OFFICE")) {
    redirect("/dashboard");
  }

  // Internal users only — clients don't log time.
  const users = await prisma.user.findMany({
    where: { role: { not: "CLIENT" } },
    select: { id: true, name: true, email: true, role: true, qbEmployeeId: true },
    orderBy: { name: "asc" },
  });

  let employees: QBOEmployee[] = [];
  let loadError: string | null = null;
  try {
    employees = await listQBOEmployees();
  } catch (e: any) {
    loadError = e?.message ?? "Could not load QuickBooks employees.";
  }

  return (
    <>
      <PageHeader
        title="QuickBooks Employee Mapping"
        subtitle="Match each Hub user to their QuickBooks employee. Time only syncs for mapped users — anyone left unmapped will block on approval."
      />
      <div className="mx-auto max-w-6xl p-6 space-y-6">
        {loadError ? (
          <div className="glass-card p-5">
            <p className="mb-1 font-medium text-[var(--white)]">
              QuickBooks not reachable
            </p>
            <p className="text-[var(--mist)]">{loadError}</p>
            <p className="mt-2 text-sm text-[var(--fog)]">
              Connect QuickBooks on the integration page, then reload.
            </p>
          </div>
        ) : (
          <EmployeeMapTable users={users} employees={employees} />
        )}
      </div>
    </>
  );
}
