import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Quo (my.quo.com) calls + SMS connector.
 *
 * Credentials live in the QuoConfig singleton (set from Settings, no redeploy);
 * process.env is a bootstrap fallback — same pattern as Microsoft 365.
 *
 * NOTE ON ENDPOINTS: Quo's public REST shape is not documented here. The paths
 * below (`/inboxes`, `/messages`, `/calls`, `/messages` POST) are the assumed
 * contract. When the real Quo API reference is available, adjust QUO_PATHS and
 * the response parsers — everything else (config, sync-to-Thread, UI) is stable.
 */
const QUO_PATHS = {
  inboxes: "/inboxes",
  messages: "/messages",
  calls: "/calls",
  sendMessage: "/messages",
};

export type QuoCredentials = { apiKey: string; baseUrl: string; inboxNumber: string | null };

export async function getQuoConfig(): Promise<QuoCredentials | null> {
  let row: { apiKey: string | null; baseUrl: string | null; inboxNumber: string | null } | null = null;
  try {
    row = await prisma.quoConfig.findUnique({ where: { id: "singleton" } });
  } catch {
    // QuoConfig table may not exist yet on a fresh install.
  }
  const apiKey = row?.apiKey ?? process.env.QUO_API_KEY ?? null;
  const baseUrl = (row?.baseUrl ?? process.env.QUO_BASE_URL ?? null)?.replace(/\/$/, "") ?? null;
  const inboxNumber = row?.inboxNumber ?? process.env.QUO_INBOX_NUMBER ?? null;
  if (!apiKey || !baseUrl) return null;
  return { apiKey, baseUrl, inboxNumber };
}

export async function isQuoConfigured(): Promise<boolean> {
  return (await getQuoConfig()) !== null;
}

async function quoFetch(creds: QuoCredentials, path: string, init?: RequestInit) {
  const res = await fetch(`${creds.baseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${creds.apiKey}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  return res;
}

async function recordSync(ok: boolean, msg: string) {
  try {
    await prisma.quoConfig.update({
      where: { id: "singleton" },
      data: { lastSyncAt: new Date(), lastSyncOk: ok, lastSyncMsg: msg },
    });
  } catch {
    // No singleton row when running purely from env vars.
  }
}

export type TestResult = { ok: true } | { ok: false; error: string };

export async function testQuoConnection(): Promise<TestResult> {
  const creds = await getQuoConfig();
  if (!creds) return { ok: false, error: "Quo is not configured" };
  try {
    const res = await quoFetch(creds, QUO_PATHS.inboxes);
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
      const msg = body.error ?? body.message ?? `Quo returned HTTP ${res.status}`;
      await recordSync(false, msg);
      return { ok: false, error: msg };
    }
    await recordSync(true, "Connection test passed");
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Connection test failed";
    await recordSync(false, msg);
    return { ok: false, error: msg };
  }
}

// --- response shapes (best-effort; adjust to Quo's real payloads) ---
type QuoMessage = {
  id: string;
  direction?: "in" | "out" | "inbound" | "outbound";
  from?: string;
  to?: string;
  contactPhone?: string;
  contactName?: string;
  body?: string;
  text?: string;
  createdAt?: string;
  timestamp?: string;
};
type QuoCall = {
  id: string;
  direction?: string;
  contactPhone?: string;
  contactName?: string;
  status?: string; // missed | completed | etc.
  durationSec?: number;
  transcript?: string;
  createdAt?: string;
  timestamp?: string;
};

function digits(p: string | undefined | null): string {
  return (p ?? "").replace(/\D/g, "");
}

function isOutbound(d: string | undefined): boolean {
  return d === "out" || d === "outbound";
}

async function threadForPhone(phone: string, name: string | undefined) {
  const key = `quo:${digits(phone)}`;
  let thread = await prisma.thread.findUnique({ where: { quoThreadKey: key } });
  if (thread) return thread;
  // Match a client by phone (compare digits) for inbox linking.
  const clients = await prisma.client.findMany({
    where: { primaryPhone: { not: null } },
    select: { id: true, primaryPhone: true },
  });
  const match = clients.find((c) => digits(c.primaryPhone) === digits(phone));
  thread = await prisma.thread.create({
    data: {
      subject: name || phone,
      channel: "SMS",
      quoThreadKey: key,
      clientId: match?.id ?? null,
      lastAt: new Date(),
    },
  });
  return thread;
}

export type SyncResult = { messages: number; calls: number; created: number };

export async function syncQuo(): Promise<SyncResult> {
  const creds = await getQuoConfig();
  if (!creds) throw new Error("Quo is not configured");

  try {
    const [msgRes, callRes] = await Promise.all([
      quoFetch(creds, `${QUO_PATHS.messages}?limit=200`),
      quoFetch(creds, `${QUO_PATHS.calls}?limit=200`),
    ]);
    if (!msgRes.ok) {
      const b = (await msgRes.json().catch(() => ({}))) as { error?: string; message?: string };
      throw new Error(b.error ?? b.message ?? `Quo messages request failed (HTTP ${msgRes.status})`);
    }
    const msgData = (await msgRes.json()) as { messages?: QuoMessage[]; data?: QuoMessage[] };
    const messages = msgData.messages ?? msgData.data ?? [];
    let calls: QuoCall[] = [];
    if (callRes.ok) {
      const callData = (await callRes.json().catch(() => ({}))) as { calls?: QuoCall[]; data?: QuoCall[] };
      calls = callData.calls ?? callData.data ?? [];
    }

    let created = 0;

    for (const m of messages) {
      const quoId = `quo-msg-${m.id}`;
      const existing = await prisma.message.findUnique({ where: { quoMessageId: quoId } });
      if (existing) continue;
      const out = isOutbound(m.direction);
      const phone = m.contactPhone ?? (out ? m.to : m.from) ?? "unknown";
      const when = new Date(m.createdAt ?? m.timestamp ?? Date.now());
      const thread = await threadForPhone(phone, m.contactName);
      await prisma.message.create({
        data: {
          threadId: thread.id,
          quoMessageId: quoId,
          fromName: m.contactName ?? phone,
          direction: out ? "OUT" : "IN",
          channel: "SMS",
          body: m.body ?? m.text ?? "",
          sentAt: when,
        },
      });
      if (when > thread.lastAt) {
        await prisma.thread.update({
          where: { id: thread.id },
          data: { lastAt: when, unread: out ? thread.unread : thread.unread + 1 },
        });
      }
      created++;
    }

    for (const c of calls) {
      const quoId = `quo-call-${c.id}`;
      const existing = await prisma.message.findUnique({ where: { quoMessageId: quoId } });
      if (existing) continue;
      const phone = c.contactPhone ?? "unknown";
      const when = new Date(c.createdAt ?? c.timestamp ?? Date.now());
      const thread = await threadForPhone(phone, c.contactName);
      const label = c.status ? `Call (${c.status})` : "Call";
      const dur = c.durationSec ? ` · ${Math.round(c.durationSec / 60)}m` : "";
      const body = c.transcript ? `${label}${dur}\n${c.transcript}` : `${label}${dur}`;
      await prisma.message.create({
        data: {
          threadId: thread.id,
          quoMessageId: quoId,
          fromName: c.contactName ?? phone,
          direction: isOutbound(c.direction) ? "OUT" : "IN",
          channel: "CALL_NOTE",
          body,
          sentAt: when,
        },
      });
      if (when > thread.lastAt) {
        await prisma.thread.update({ where: { id: thread.id }, data: { lastAt: when } });
      }
      created++;
    }

    await recordSync(true, `Synced ${created} new item${created === 1 ? "" : "s"}`);
    return { messages: messages.length, calls: calls.length, created };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Quo sync failed";
    await recordSync(false, msg);
    throw err;
  }
}

export type SendResult = { ok: true } | { ok: false; error: string };

// Two-way SMS: push an outbound text through Quo. The Hub records the OUT
// message regardless; this just attempts delivery.
export async function sendQuoSms(toPhone: string, body: string): Promise<SendResult> {
  const creds = await getQuoConfig();
  if (!creds) return { ok: false, error: "Quo is not configured" };
  try {
    const res = await quoFetch(creds, QUO_PATHS.sendMessage, {
      method: "POST",
      body: JSON.stringify({ to: toPhone, from: creds.inboxNumber, body }),
    });
    if (!res.ok) {
      const b = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
      return { ok: false, error: b.error ?? b.message ?? `Quo send failed (HTTP ${res.status})` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Quo send failed" };
  }
}
