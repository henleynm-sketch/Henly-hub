import "server-only";
import { prisma } from "@/lib/prisma";
import type { Notification } from "@prisma/client";
import { renderTemplate } from "@/lib/notifications/templates";

/**
 * Event catalog + layered recipient resolution.
 *
 * Emit-time: resolveRecipients() computes the coarse audience.
 * Send-time: renderEvent() re-checks EVERYTHING — role visibility of the
 * underlying record, per-user email prefs (UserNotificationPref), external
 * opt-outs (Client/Vendor.emailOptOut), the unsubscribe table — and returns
 * either rendered content or an honest suppression reason.
 *
 * NAMING MAP: UI "Project" = Engagement; UI "Job" = Project (legacy).
 */

export type Recipient = { type: "user" | "client" | "vendor"; id: string; email: string };

export type EventDef = {
  label: string;
  audience: "client" | "internal" | "vendor" | "actor";
  /** default when no explicit pref exists (org default can override via Setting notify.default.<KEY>) */
  defaultOn: boolean;
  /** internal events: which roles receive it */
  roles?: string[];
};

export const EVENTS: Record<string, EventDef> = {
  TEST_EMAIL: { label: "Test email", audience: "actor", defaultOn: true },

  // Client-facing
  DAILY_LOG_CLIENT: { label: "Daily log posted (client-visible)", audience: "client", defaultOn: true },
  SELECTION_PROPOSED: { label: "Selection proposed", audience: "client", defaultOn: true },
  SELECTION_REMINDER: { label: "Selection reminder (T-2 days)", audience: "client", defaultOn: true },
  SELECTION_OVERDUE_CLIENT: { label: "Selection overdue", audience: "client", defaultOn: true },
  ESTIMATE_SENT: { label: "Estimate sent", audience: "client", defaultOn: true },
  CONTRACT_SENT: { label: "Contract sent", audience: "client", defaultOn: true },
  CONTRACT_SIGNED_CLIENT: { label: "Contract signed (confirmation)", audience: "client", defaultOn: true },
  MILESTONE_DUE_CLIENT: { label: "Milestone due (client-visible)", audience: "client", defaultOn: true },

  // Internal
  ESTIMATE_ACCEPTED: { label: "Estimate accepted", audience: "internal", defaultOn: true, roles: ["CEO", "OFFICE"] },
  SELECTION_DECIDED: { label: "Selection approved/declined", audience: "internal", defaultOn: true, roles: ["OFFICE", "CEO"] },
  JOB_STAGE_CHANGED: { label: "Job stage/phase changed", audience: "internal", defaultOn: false, roles: ["CEO", "OFFICE"] },
  INBOX_MESSAGE: { label: "New inbox message", audience: "internal", defaultOn: true, roles: ["CEO", "OFFICE"] },
  TIME_APPROVALS_DAILY: { label: "Time entries awaiting approval (daily)", audience: "internal", defaultOn: true, roles: ["CEO"] },
  JOB_ASSIGNED: { label: "New job assignment", audience: "internal", defaultOn: true, roles: ["FIELD", "SUB"] },

  // Vendor
  VENDOR_ASSIGNED: { label: "Vendor assigned to a job", audience: "vendor", defaultOn: true },
  VENDOR_COI_EXPIRING: { label: "COI expiring in 30 days", audience: "vendor", defaultOn: true },
  VENDOR_COI_EXPIRED: { label: "COI expired", audience: "vendor", defaultOn: true },
  VENDOR_W9_NUDGE: { label: "W-9 missing (monthly nudge)", audience: "vendor", defaultOn: true },
};
export type EventKey = keyof typeof EVENTS & string;

export async function getBaseUrl(): Promise<string> {
  try {
    const s = await prisma.setting.findUnique({ where: { key: "org.baseUrl" } });
    if (s?.value) return s.value.replace(/\/$/, "");
  } catch {
    /* fall through */
  }
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "http://localhost:3000";
}

async function orgDefault(eventType: string, fallback: boolean): Promise<boolean> {
  try {
    const s = await prisma.setting.findUnique({ where: { key: `notify.default.${eventType}` } });
    if (s?.value === "on") return true;
    if (s?.value === "off") return false;
  } catch {
    /* fall through */
  }
  return fallback;
}

// ── Emit-time audience ───────────────────────────────────────────────────────

export async function resolveRecipients(n: Notification): Promise<Recipient[]> {
  const def = EVENTS[n.eventType];
  if (!def) return [];
  const out: Recipient[] = [];

  if (def.audience === "actor") {
    if (!n.actorId) return [];
    const u = await prisma.user.findUnique({ where: { id: n.actorId } });
    if (u?.email) out.push({ type: "user", id: u.id, email: u.email });
    return out;
  }

  if (def.audience === "client") {
    const clientId =
      n.clientId ??
      (n.jobId
        ? (await prisma.project.findUnique({ where: { id: n.jobId }, select: { clientId: true } }))?.clientId
        : null);
    if (!clientId) return [];
    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (client?.primaryEmail) out.push({ type: "client", id: client.id, email: client.primaryEmail });
    return out;
  }

  if (def.audience === "vendor") {
    if (!n.vendorId) return [];
    const v = await prisma.vendor.findUnique({ where: { id: n.vendorId } });
    if (v?.email && !v.archivedAt) out.push({ type: "vendor", id: v.id, email: v.email });
    return out;
  }

  // internal
  const roles = def.roles ?? ["CEO", "OFFICE"];
  let users = await prisma.user.findMany({ where: { role: { in: roles }, active: true } });
  if (n.eventType === "JOB_ASSIGNED" && n.payload) {
    const payload = JSON.parse(n.payload) as { userId?: string };
    users = users.filter((u) => u.id === payload.userId);
  }
  for (const u of users) {
    if (u.email) out.push({ type: "user", id: u.id, email: u.email });
  }
  return out;
}

// ── Send-time layered checks + render ────────────────────────────────────────

async function layeredSuppression(n: Notification, r: Recipient): Promise<string | null> {
  // 1. unsubscribe table (externals)
  const unsub = await prisma.notificationUnsubscribe.findFirst({
    where: { email: r.email.toLowerCase() },
  });
  if (unsub) return "recipient unsubscribed";

  // 2. recipient-level prefs
  if (r.type === "user") {
    const pref = await prisma.userNotificationPref.findUnique({
      where: { userId_event: { userId: r.id, event: n.eventType } },
    }).catch(() => null);
    const def = EVENTS[n.eventType];
    if (pref) {
      if (!pref.email) return "user email pref off";
    } else if (!(await orgDefault(n.eventType, def?.defaultOn ?? false))) {
      return "org default off";
    }
    const user = await prisma.user.findUnique({ where: { id: r.id } });
    if (!user?.active) return "user inactive";
  } else if (r.type === "client") {
    const c = await prisma.client.findUnique({ where: { id: r.id } });
    if (!c) return "client missing";
    if (c.emailOptOut) return "client opted out";
    if (!(await orgDefault(n.eventType, EVENTS[n.eventType]?.defaultOn ?? false))) return "org default off";
  } else {
    const v = await prisma.vendor.findUnique({ where: { id: r.id } });
    if (!v || v.archivedAt) return "vendor missing/archived";
    if (v.emailOptOut) return "vendor opted out";
    if (!(await orgDefault(n.eventType, EVENTS[n.eventType]?.defaultOn ?? false))) return "org default off";
  }
  return null;
}

/** Visibility re-check against the CURRENT record state — never emit-time state. */
async function visibilitySuppression(n: Notification, r: Recipient): Promise<string | null> {
  const payload = n.payload ? (JSON.parse(n.payload) as Record<string, unknown>) : {};
  if (r.type !== "client") return null; // internal/vendor events carry only their own material by construction

  switch (n.eventType) {
    case "DAILY_LOG_CLIENT": {
      const log = payload.logId
        ? await prisma.dailyLog.findUnique({ where: { id: String(payload.logId) } })
        : null;
      if (!log) return "log deleted";
      if (!log.clientVisible) return "log no longer client-visible";
      return null;
    }
    case "MILESTONE_DUE_CLIENT": {
      const m = payload.milestoneId
        ? await prisma.milestone.findUnique({ where: { id: String(payload.milestoneId) } })
        : null;
      if (!m) return "milestone deleted";
      if (!m.clientVisible) return "milestone no longer client-visible";
      return null;
    }
    case "CONTRACT_SENT":
    case "CONTRACT_SIGNED_CLIENT": {
      const c = payload.contractId
        ? await prisma.contract.findUnique({ where: { id: String(payload.contractId) } })
        : null;
      if (!c) return "contract missing";
      if (c.status === "VOID") return "contract voided";
      return null;
    }
    default:
      return null;
  }
}

export async function renderEvent(
  n: Notification,
  r: Recipient,
): Promise<{ suppress: string } | { subject: string; html: string; text: string }> {
  const layered = await layeredSuppression(n, r);
  if (layered) return { suppress: layered };
  const visibility = await visibilitySuppression(n, r);
  if (visibility) return { suppress: visibility };
  return renderTemplate(n, r);
}
