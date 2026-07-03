"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getValidQBOToken } from "@/lib/quickbooks";
import { revalidatePath } from "next/cache";

const QBO_BASE =
  process.env.QB_ENV === "production"
    ? "https://quickbooks.api.intuit.com"
    : "https://sandbox-quickbooks.api.intuit.com";

export type QBOEmployee = { id: string; name: string; active: boolean };

async function requireQBOAdmin() {
  const me = await auth();
  const role = me?.user?.role;
  if (!me?.user?.id || (role !== "CEO" && role !== "OFFICE")) {
    throw new Error("Unauthorized: CEO/Office only.");
  }
  return me;
}

export async function listQBOEmployees(): Promise<QBOEmployee[]> {
  await requireQBOAdmin();

  const conn = await getValidQBOToken();
  if (!conn?.accessToken || !conn?.realmId) {
    throw new Error("QuickBooks not connected.");
  }

  const query = encodeURIComponent(
    "SELECT Id, DisplayName, Active FROM Employee MAXRESULTS 200"
  );
  const res = await fetch(
    `${QBO_BASE}/v3/company/${conn.realmId}/query?query=${query}&minorversion=73`,
    {
      headers: {
        Authorization: `Bearer ${conn.accessToken}`,
        Accept: "application/json",
      },
      cache: "no-store",
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`QBO ${res.status}: ${text.slice(0, 300)}`);
  }

  const json = await res.json();
  const rows = json?.QueryResponse?.Employee ?? [];
  return rows.map((e: any) => ({
    id: e.Id,
    name: e.DisplayName,
    active: e.Active !== false,
  }));
}

export async function mapUserToQBOEmployee(
  userId: string,
  qbEmployeeId: string | null
) {
  await requireQBOAdmin();

  await prisma.user.update({
    where: { id: userId },
    data: { qbEmployeeId: qbEmployeeId || null },
  });

  revalidatePath("/integrations/quickbooks/employees");
  return { ok: true };
}
