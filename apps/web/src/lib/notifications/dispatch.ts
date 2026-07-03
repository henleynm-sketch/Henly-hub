import "server-only";
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/microsoft365";
import { EVENTS, resolveRecipients, renderEvent, type EventKey } from "@/lib/notifications/events";

/**
 * Outbox dispatcher. emitNotification() records the event + queued deliveries
 * (deduped per eventType:subject:email:day) and attempts immediate sends;
 * the instrumentation interval retries failures with exponential backoff
 * (max 5 attempts). Visibility and preferences are re-resolved AT SEND TIME —
 * an event emitted before a visibility flip must not leak.
 */

const MAX_ATTEMPTS = 5;

export async function isNotifyEnabled(): Promise<boolean> {
  try {
    const s = await prisma.setting.findUnique({ where: { key: "notify.enabled" } });
    return s?.value !== "off";
  } catch {
    return false;
  }
}

export async function emitNotification(input: {
  eventType: EventKey;
  actorId?: string;
  jobId?: string;
  engagementId?: string;
  clientId?: string;
  vendorId?: string;
  payload?: Record<string, unknown>;
}): Promise<void> {
  try {
    if (!EVENTS[input.eventType]) return;
    const notification = await prisma.notification.create({
      data: {
        eventType: input.eventType,
        actorId: input.actorId ?? null,
        jobId: input.jobId ?? null,
        engagementId: input.engagementId ?? null,
        clientId: input.clientId ?? null,
        vendorId: input.vendorId ?? null,
        payload: input.payload ? JSON.stringify(input.payload) : null,
      },
    });

    const recipients = await resolveRecipients(notification);
    const day = new Date().toISOString().slice(0, 10);
    const subjectId =
      input.jobId ?? input.engagementId ?? input.clientId ?? input.vendorId ?? "org";

    for (const r of recipients) {
      const dedupeKey = `${input.eventType}:${subjectId}:${r.email.toLowerCase()}:${day}`;
      try {
        const delivery = await prisma.notificationDelivery.create({
          data: {
            notificationId: notification.id,
            recipientType: r.type,
            recipientId: r.id,
            email: r.email,
            dedupeKey,
          },
        });
        // Fire-and-forget immediate attempt; the interval sweeps stragglers.
        void attemptDelivery(delivery.id).catch(() => {});
      } catch {
        // Unique dedupeKey collision → already notified today. Honest no-op:
        // the original row stands; nothing silent beyond this comment.
      }
    }
  } catch (err) {
    // Notifications must never break the business action that emitted them.
    console.error("[notify] emit failed:", err instanceof Error ? err.message : err);
  }
}

export async function attemptDelivery(deliveryId: string): Promise<void> {
  const d = await prisma.notificationDelivery.findUnique({
    where: { id: deliveryId },
    include: { notification: true },
  });
  if (!d || d.status === "sent" || d.status === "suppressed") return;
  if (d.attempts >= MAX_ATTEMPTS) return;

  if (!(await isNotifyEnabled())) {
    await prisma.notificationDelivery.update({
      where: { id: d.id },
      data: { status: "suppressed", suppressReason: "master switch off" },
    });
    return;
  }

  // Send-time re-resolution: visibility + prefs + unsubscribe.
  const rendered = await renderEvent(d.notification, {
    type: d.recipientType as "user" | "client" | "vendor",
    id: d.recipientId,
    email: d.email,
  });
  if ("suppress" in rendered) {
    await prisma.notificationDelivery.update({
      where: { id: d.id },
      data: { status: "suppressed", suppressReason: rendered.suppress },
    });
    return;
  }

  try {
    await sendMail({ to: d.email, subject: rendered.subject, html: rendered.html, text: rendered.text });
    await prisma.notificationDelivery.update({
      where: { id: d.id },
      data: { status: "sent", sentAt: new Date(), attempts: d.attempts + 1, lastAttemptAt: new Date(), lastError: null },
    });
  } catch (err) {
    await prisma.notificationDelivery.update({
      where: { id: d.id },
      data: {
        status: "failed",
        attempts: d.attempts + 1,
        lastAttemptAt: new Date(),
        lastError: err instanceof Error ? err.message.slice(0, 800) : "send failed",
      },
    });
  }
}

/**
 * Daily sweeps (run at most once per calendar day, guarded by a Setting):
 * client-visible milestones due in 2 days, vendor COI expiring/expired,
 * monthly W-9 nudges (org-toggleable), and the CEO time-approval digest.
 * Selection reminders stay dormant until the Selections module gains a
 * dueDate (currently a Phase-2 stub) — catalog entries exist, no fabricated
 * emits.
 */
async function dailySweeps(): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const last = await prisma.setting.findUnique({ where: { key: "notify.lastSweep" } }).catch(() => null);
  if (last?.value === today) return;
  await prisma.setting.upsert({
    where: { key: "notify.lastSweep" },
    update: { value: today },
    create: { key: "notify.lastSweep", value: today },
  });

  const now = new Date();
  const in2d = new Date(now); in2d.setDate(now.getDate() + 2);
  const in3d = new Date(now); in3d.setDate(now.getDate() + 3);
  const in30d = new Date(now); in30d.setDate(now.getDate() + 30);

  // Client-visible milestones due in ~2 days.
  const milestones = await prisma.milestone.findMany({
    where: { clientVisible: true, status: { not: "DONE" }, dueDate: { gte: in2d, lt: in3d } },
    include: { project: { select: { id: true } } },
  });
  for (const m of milestones) {
    await emitNotification({
      eventType: "MILESTONE_DUE_CLIENT",
      jobId: m.projectId,
      payload: { milestoneId: m.id, title: m.title, dueDate: m.dueDate?.toISOString().slice(0, 10) },
    });
  }

  // Vendor COI expiring in <=30 days / already expired. Daily dedupeKey keeps
  // this to one email per vendor per day; real cadence control can follow.
  const vendors = await prisma.vendor.findMany({ where: { archivedAt: null, emailOptOut: false } });
  for (const v of vendors) {
    if (!v.email) continue;
    if (v.coiExpiresAt && v.coiExpiresAt < now) {
      await emitNotification({
        eventType: "VENDOR_COI_EXPIRED",
        vendorId: v.id,
        payload: { expires: v.coiExpiresAt.toISOString().slice(0, 10) },
      });
    } else if (v.coiExpiresAt && v.coiExpiresAt <= in30d) {
      await emitNotification({
        eventType: "VENDOR_COI_EXPIRING",
        vendorId: v.id,
        payload: { expires: v.coiExpiresAt.toISOString().slice(0, 10) },
      });
    }
  }

  // Monthly W-9 nudge (org toggle notify.w9nudge, default on).
  const month = today.slice(0, 7);
  const w9Toggle = await prisma.setting.findUnique({ where: { key: "notify.w9nudge" } }).catch(() => null);
  const lastW9 = await prisma.setting.findUnique({ where: { key: "notify.lastW9Nudge" } }).catch(() => null);
  if (w9Toggle?.value !== "off" && lastW9?.value !== month) {
    await prisma.setting.upsert({
      where: { key: "notify.lastW9Nudge" },
      update: { value: month },
      create: { key: "notify.lastW9Nudge", value: month },
    });
    for (const v of vendors) {
      if (v.email && !v.w9OnFile) {
        await emitNotification({ eventType: "VENDOR_W9_NUDGE", vendorId: v.id });
      }
    }
  }

  // CEO daily digest: completed time entries awaiting approval.
  const pending = await prisma.timeEntry.count({ where: { approved: false, clockOut: { not: null } } });
  if (pending > 0) {
    await emitNotification({ eventType: "TIME_APPROVALS_DAILY", payload: { count: pending } });
  }
}

/** Retry backoff: 2^attempts minutes since last attempt. */
export async function processQueue(): Promise<{ attempted: number }> {
  if (await isNotifyEnabled()) {
    await dailySweeps().catch((err) =>
      console.error("[notify] daily sweep failed:", err instanceof Error ? err.message : err),
    );
  }

  const rows = await prisma.notificationDelivery.findMany({
    where: { status: { in: ["queued", "failed"] }, attempts: { lt: MAX_ATTEMPTS } },
    orderBy: { createdAt: "asc" },
    take: 25,
  });
  const now = Date.now();
  let attempted = 0;
  for (const d of rows) {
    const waitMs = d.lastAttemptAt ? Math.pow(2, d.attempts) * 60_000 : 0;
    if (d.lastAttemptAt && now - d.lastAttemptAt.getTime() < waitMs) continue;
    attempted++;
    await attemptDelivery(d.id);
  }
  return { attempted };
}
