import { auth } from "@/auth";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { canManageTeam, type Role } from "@/lib/roles";
import PageHeader from "@/components/PageHeader";
import { formatRelative } from "@/lib/utils";
import DiagnosticsClient, { type ErrorRow, type HealthRow } from "./DiagnosticsClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Build one integration status pill from a "configured" flag + last check.
// Never receives or renders the underlying secret — only booleans/timestamps.
function integStatus(
  key: string,
  label: string,
  configured: boolean,
  lastOk: boolean | null,
  lastAt: Date | null,
): HealthRow {
  if (!configured) return { key, label, status: "neutral", detail: "Not connected" };
  if (lastOk === false) return { key, label, status: "red", detail: "Last check failed" };
  if (lastOk === true) {
    return { key, label, status: "green", detail: lastAt ? `OK · ${formatRelative(lastAt)}` : "Connected" };
  }
  return { key, label, status: "amber", detail: "Configured — not verified yet" };
}

async function getHealth(): Promise<HealthRow[]> {
  const out: HealthRow[] = [];

  try {
    await prisma.$queryRaw`SELECT 1`;
    out.push({ key: "db", label: "Database", status: "green", detail: "Connected" });
  } catch {
    out.push({ key: "db", label: "Database", status: "red", detail: "Unreachable" });
  }

  // QuickBooks — status only; tokens are never selected.
  try {
    const qbo = await prisma.qBOToken.findUnique({
      where: { id: "global" },
      select: { expiresAt: true },
    });
    if (!qbo) out.push({ key: "qbo", label: "QuickBooks", status: "neutral", detail: "Not connected" });
    else if (qbo.expiresAt.getTime() > Date.now())
      out.push({ key: "qbo", label: "QuickBooks", status: "green", detail: "Connected" });
    else out.push({ key: "qbo", label: "QuickBooks", status: "amber", detail: "Token expired — reconnect" });
  } catch {
    out.push({ key: "qbo", label: "QuickBooks", status: "neutral", detail: "Unavailable" });
  }

  try {
    const m = await prisma.m365Config.findUnique({
      where: { id: "singleton" },
      select: { tenantId: true, clientId: true, mailbox: true, lastSyncOk: true, lastSyncAt: true },
    });
    const configured = !!(m?.tenantId && m?.clientId && m?.mailbox);
    out.push(integStatus("m365", "Microsoft 365", configured, m?.lastSyncOk ?? null, m?.lastSyncAt ?? null));
  } catch {
    out.push({ key: "m365", label: "Microsoft 365", status: "neutral", detail: "Unavailable" });
  }

  try {
    const j = await prisma.jobTreadConfig.findUnique({
      where: { id: "singleton" },
      select: { grantKey: true, lastTestOk: true, lastTestAt: true },
    });
    out.push(integStatus("jobtread", "JobTread", !!j?.grantKey, j?.lastTestOk ?? null, j?.lastTestAt ?? null));
  } catch {
    out.push({ key: "jobtread", label: "JobTread", status: "neutral", detail: "Unavailable" });
  }

  try {
    const h = await prisma.henleyTasksConfig.findUnique({
      where: { id: "singleton" },
      select: { apiKey: true, lastTestOk: true, lastTestAt: true },
    });
    out.push(integStatus("htasks", "Henley Tasks", !!h?.apiKey, h?.lastTestOk ?? null, h?.lastTestAt ?? null));
  } catch {
    out.push({ key: "htasks", label: "Henley Tasks", status: "neutral", detail: "Unavailable" });
  }

  // Last deploy — honest: only if the pipeline recorded it (Setting keys).
  try {
    const [sha, at] = await Promise.all([
      prisma.setting.findUnique({ where: { key: "deploy.lastSha" }, select: { value: true } }),
      prisma.setting.findUnique({ where: { key: "deploy.lastAt" }, select: { value: true } }),
    ]);
    if (sha?.value) {
      const when = at?.value ? new Date(at.value) : null;
      out.push({
        key: "deploy",
        label: "Last deploy",
        status: "green",
        detail: `${sha.value.slice(0, 7)}${when ? ` · ${formatRelative(when)}` : ""}`,
      });
    } else {
      out.push({ key: "deploy", label: "Last deploy", status: "neutral", detail: "Not tracked yet" });
    }
  } catch {
    out.push({ key: "deploy", label: "Last deploy", status: "neutral", detail: "Not tracked yet" });
  }

  return out;
}

export default async function DiagnosticsPage() {
  const session = await auth();
  const role = session?.user?.role as Role | undefined;
  // Server-side block — non-CEO gets a 404, not a hidden-but-reachable page.
  if (!role || !canManageTeam(role)) notFound();

  const [rows, openCount, health] = await Promise.all([
    prisma.errorLog.findMany({ orderBy: { createdAt: "desc" }, take: 250 }),
    prisma.errorLog.count({ where: { resolved: false } }),
    getHealth(),
  ]);

  const shaped: ErrorRow[] = rows.map((r) => ({
    id: r.id,
    level: r.level,
    source: r.source,
    message: r.message,
    stack: r.stack,
    context: r.context,
    route: r.route,
    userId: r.userId,
    resolved: r.resolved,
    createdLabel: formatRelative(r.createdAt),
    createdIso: r.createdAt.toISOString(),
    resolvedLabel: r.resolvedAt ? formatRelative(r.resolvedAt) : null,
  }));

  return (
    <div>
      <PageHeader
        title="Diagnostics"
        subtitle="Live error capture and integration health. Visible to the CEO only."
      />
      <div className="p-4 md:p-6">
        <DiagnosticsClient rows={shaped} health={health} openCount={openCount} />
      </div>
    </div>
  );
}
