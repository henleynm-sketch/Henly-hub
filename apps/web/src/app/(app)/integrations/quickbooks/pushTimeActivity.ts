import { prisma } from "@/lib/prisma";
import { getValidQBOToken } from "@/lib/quickbooks";

const QBO_BASE =
  process.env.QB_ENV === "production"
    ? "https://quickbooks.api.intuit.com"
    : "https://sandbox-quickbooks.api.intuit.com";

type PushResult = { ok: true; qbId: string } | { ok: false; error: string };

export async function pushTimeActivityToQBO(
  timeEntryId: string
): Promise<PushResult> {
  const entry = await prisma.timeEntry.findUnique({
    where: { id: timeEntryId },
    include: {
      user: true,
      project: { include: { client: true } },
    },
  });

  if (!entry) return { ok: false, error: "Time entry not found." };

  if (!entry.clockOut) return { ok: false, error: "Entry still clocked in." };

  // Idempotency: already synced -> return existing id, don't re-post.
  if (entry.qbTimeActivityId) return { ok: true, qbId: entry.qbTimeActivityId };

  const conn = await getValidQBOToken();
  if (!conn?.accessToken || !conn?.realmId) {
    return { ok: false, error: "QuickBooks not connected." };
  }

  // Employee mapping check
  const employeeId = entry.user.qbEmployeeId;
  if (!employeeId) {
    return { ok: false, error: `No QBO employee mapped for ${entry.user.name}.` };
  }

  const customerId = entry.project.client.qbCustomerId;

  const ms = entry.clockOut.getTime() - entry.clockIn.getTime();
  const totalMinutes = Math.max(0, Math.round(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  const body: Record<string, unknown> = {
    NameOf: "Employee",
    EmployeeRef: { value: employeeId },
    TxnDate: entry.clockIn.toISOString().slice(0, 10),
    Hours: hours,
    Minutes: minutes,
    BillableStatus: "NotBillable",
    Description: entry.costCode || "",
  };

  // Books the hours against the job for job-costing.
  if (customerId) body.CustomerRef = { value: customerId };

  const res = await fetch(
    `${QBO_BASE}/v3/company/${conn.realmId}/timeactivity?minorversion=73`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${conn.accessToken}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    return { ok: false, error: `QBO ${res.status}: ${text.slice(0, 300)}` };
  }

  const json = await res.json();
  const qbId = json?.TimeActivity?.Id as string | undefined;
  if (!qbId) return { ok: false, error: "QBO response missing TimeActivity Id." };

  await prisma.timeEntry.update({
    where: { id: timeEntryId },
    data: { qbTimeActivityId: qbId, qbSyncedAt: new Date() },
  });

  return { ok: true, qbId };
}
