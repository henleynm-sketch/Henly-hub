import "server-only";
import { prisma } from "@/lib/prisma";
import { parseFieldMap } from "@/lib/jobtread";
import type { JobTreadCardData } from "@/components/settings/JobTreadCard";

// Shared between Settings → Integrations and the /jobtread page so both
// render the connection card from identical state.
export async function getJobTreadCardData(): Promise<JobTreadCardData> {
  let row: Awaited<ReturnType<typeof prisma.jobTreadConfig.findUnique>> = null;
  try {
    row = await prisma.jobTreadConfig.findUnique({ where: { id: "singleton" } });
  } catch {
    // model not generated yet — treat as unconfigured
  }
  const configured = Boolean(row?.grantKey);
  let lastSyncSummary = null;
  try {
    lastSyncSummary = row?.lastSyncSummary ? JSON.parse(row.lastSyncSummary) : null;
  } catch {
    lastSyncSummary = null;
  }
  return {
    configured,
    connected: configured && row?.lastTestOk === true,
    grantKeyMasked: row?.grantKey ? `${row.grantKey.slice(0, 6)}••••••` : null,
    hasKey: Boolean(row?.grantKey),
    organizationId: row?.organizationId ?? "22PVYxTzwCLW",
    fieldMap: parseFieldMap(row?.fieldMap),
    lastTestAt: row?.lastTestAt ? row.lastTestAt.toISOString() : null,
    lastTestOk: row?.lastTestOk ?? null,
    lastTestResult: row?.lastTestResult ?? null,
    lastSyncAt: row?.lastSyncAt ? row.lastSyncAt.toISOString() : null,
    lastSyncSummary,
  };
}
