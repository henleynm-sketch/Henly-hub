import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Quo (my.quo.com) SMS + voice ingestion — read-only.
 *
 * The API key lives in the QuoConfig singleton (pasted from Settings, no
 * redeploy, never in .env) — same pattern as HUB_TASKS_API_KEY and Microsoft
 * 365. NOTE: Quo's REST shape is not documented in this session. The endpoints
 * and field mapping below are the assumed contract; if the real API differs,
 * the only changes needed are QUO_ENDPOINTS and the map* functions — everything
 * else (config, dedupe, inbox wiring, UI) is stable.
 */
const DEFAULT_API_BASE = "https://api.quo.com/v1";

const QUO_ENDPOINTS = {
  inboxes: "/inboxes",
  conversations: (inboxId: string) => `/inboxes/${inboxId}/conversations`,
  calls: (inboxId: string) => `/inboxes/${inboxId}/calls`,
};

export class QuoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QuoError";
  }
}

export type Inbox = { id: string; name: string; number?: string };

type QuoConfigRow = {
  apiKey: string | null;
  apiBase: string | null;
  defaultInboxId: string | null;
  defaultInboxName: string | null;
};

async function readConfig(): Promise<QuoConfigRow | null> {
  try {
    return await prisma.quoConfig.findUnique({ where: { id: "singleton" } });
  } catch {
    return null; // table not generated yet
  }
}

export async function isQuoConfigured(): Promise<boolean> {
  const row = await readConfig();
  return Boolean(row?.apiKey);
}

export async function getQuoApiBase(): Promise<string> {
  const row = await readConfig();
  return (row?.apiBase || DEFAULT_API_BASE).replace(/\/$/, "");
}

export async function quoCall<T>(endpoint: string, init?: RequestInit): Promise<T> {
  const row = await readConfig();
  if (!row?.apiKey) throw new QuoError("Quo is not configured");
  const base = (row.apiBase || DEFAULT_API_BASE).replace(/\/$/, "");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(`${base}${endpoint}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${row.apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(init?.headers ?? {}),
      },
      signal: controller.signal,
      cache: "no-store",
    });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; message?: string } & T;
    if (!res.ok || data?.ok === false) {
      throw new QuoError(String(data?.error ?? data?.message ?? `Quo returned HTTP ${res.status}`));
    }
    return data;
  } catch (err) {
    if (err instanceof QuoError) throw err;
    throw new QuoError(err instanceof Error ? err.message : "Quo request failed");
  } finally {
    clearTimeout(timer);
  }
}

async function recordSync(ok: boolean, msg: string) {
  try {
    await prisma.quoConfig.update({
      where: { id: "singleton" },
      data: { lastSyncAt: new Date(), lastSyncOk: ok, lastSyncMsg: msg },
    });
  } catch {
    /* no singleton row */
  }
}

// --- phone normalization -------------------------------------------------
export function toE164(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const d = raw.replace(/\D/g, "");
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith("1")) return `+${d}`;
  if (d.length === 0) return null;
  return `+${d}`;
}

async function linkClientByPhone(phone: string | null | undefined): Promise<string | null> {
  const target = toE164(phone);
  if (!target) return null;
  const clients = await prisma.client.findMany({
    where: { primaryPhone: { not: null } },
    select: { id: true, primaryPhone: true },
  });
  const match = clients.find((c) => toE164(c.primaryPhone) === target);
  return match?.id ?? null;
}

// --- test / inbox list ---------------------------------------------------
export async function testQuoConnection(): Promise<{ ok: boolean; inboxes?: Inbox[]; error?: string }> {
  if (!(await isQuoConfigured())) return { ok: false, error: "Quo is not configured" };
  try {
    const data = await quoCall<{ inboxes?: Inbox[]; data?: Inbox[] }>(QUO_ENDPOINTS.inboxes);
    const inboxes = data.inboxes ?? data.data ?? [];
    await recordSync(true, "Connection test passed");
    return { ok: true, inboxes };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Connection test failed";
    await recordSync(false, msg);
    return { ok: false, error: msg };
  }
}

// --- mapping (isolate the Quo payload shape here) ------------------------
type QuoConversation = {
  id: string;
  contactName?: string;
  contactPhone?: string;
  phone?: string;
  messages?: QuoMessagePayload[];
};
type QuoMessagePayload = {
  id: string;
  direction?: string; // inbound | outbound | in | out
  body?: string;
  text?: string;
  timestamp?: string;
  createdAt?: string;
};
type QuoCallPayload = {
  id: string;
  direction?: string;
  contactName?: string;
  contactPhone?: string;
  phone?: string;
  status?: string; // missed | completed | voicemail
  durationSec?: number;
  transcript?: string;
  timestamp?: string;
  createdAt?: string;
};

function isOutbound(d: string | undefined): boolean {
  return d === "out" || d === "outbound";
}

function mapDuration(sec: number | undefined): string {
  if (!sec) return "";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return ` (${m}:${String(s).padStart(2, "0")})`;
}

function mapQuoCallToBody(c: QuoCallPayload, name: string): string {
  const status = (c.status ?? "").toLowerCase();
  if (status === "voicemail" && c.transcript) return `Voicemail: ${c.transcript}`;
  if (status === "missed") return `Missed call from ${name}`;
  if (isOutbound(c.direction)) return `Outgoing call${mapDuration(c.durationSec)}`;
  return `Incoming call${mapDuration(c.durationSec)}`;
}

export type SyncResult = { fetched: number; created: number; skipped: number };

export async function syncQuoMessages(inboxId: string): Promise<SyncResult> {
  const data = await quoCall<{ conversations?: QuoConversation[]; data?: QuoConversation[] }>(
    QUO_ENDPOINTS.conversations(inboxId)
  );
  const conversations = data.conversations ?? data.data ?? [];
  let fetched = 0;
  let created = 0;
  let skipped = 0;

  for (const conv of conversations) {
    const phone = conv.contactPhone ?? conv.phone ?? "";
    const subject = conv.contactName?.trim() || phone || "Unknown";
    const convKey = `quo-conv-${conv.id}`;
    let thread = await prisma.thread.findUnique({ where: { quoConversationId: convKey } });
    if (!thread) {
      thread = await prisma.thread.create({
        data: {
          subject,
          channel: "SMS",
          quoConversationId: convKey,
          clientId: await linkClientByPhone(phone),
          lastAt: new Date(),
        },
      });
    }
    for (const m of conv.messages ?? []) {
      fetched++;
      const msgKey = `quo-msg-${m.id}`;
      const existing = await prisma.message.findUnique({ where: { quoMessageId: msgKey } });
      if (existing) {
        skipped++;
        continue;
      }
      const when = new Date(m.timestamp ?? m.createdAt ?? Date.now());
      const out = isOutbound(m.direction);
      await prisma.message.create({
        data: {
          threadId: thread.id,
          quoMessageId: msgKey,
          fromName: subject,
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
  }
  await recordSync(true, `Synced ${created} new SMS`);
  return { fetched, created, skipped };
}

export async function syncQuoCalls(inboxId: string): Promise<SyncResult> {
  const data = await quoCall<{ calls?: QuoCallPayload[]; data?: QuoCallPayload[] }>(
    QUO_ENDPOINTS.calls(inboxId)
  );
  const calls = data.calls ?? data.data ?? [];
  let created = 0;
  let skipped = 0;

  for (const c of calls) {
    const phone = c.contactPhone ?? c.phone ?? "";
    const name = c.contactName?.trim() || phone || "Unknown";
    // Voice activity shares the conversation thread keyed by phone.
    const convKey = `quo-voice-${toE164(phone) ?? c.id}`;
    let thread = await prisma.thread.findUnique({ where: { quoConversationId: convKey } });
    if (!thread) {
      thread = await prisma.thread.create({
        data: {
          subject: name,
          channel: "CALL_NOTE",
          quoConversationId: convKey,
          clientId: await linkClientByPhone(phone),
          lastAt: new Date(),
        },
      });
    }
    const callKey = `quo-call-${c.id}`;
    const existing = await prisma.message.findUnique({ where: { quoMessageId: callKey } });
    if (existing) {
      skipped++;
      continue;
    }
    const when = new Date(c.timestamp ?? c.createdAt ?? Date.now());
    await prisma.message.create({
      data: {
        threadId: thread.id,
        quoMessageId: callKey,
        fromName: name,
        direction: isOutbound(c.direction) ? "OUT" : "IN",
        channel: "CALL_NOTE",
        body: mapQuoCallToBody(c, name),
        sentAt: when,
      },
    });
    if (when > thread.lastAt) {
      await prisma.thread.update({ where: { id: thread.id }, data: { lastAt: when } });
    }
    created++;
  }
  await recordSync(true, `Synced ${created} new calls`);
  return { fetched: calls.length, created, skipped };
}
