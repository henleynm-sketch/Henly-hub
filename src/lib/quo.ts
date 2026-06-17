import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Quo (my.quo.com) SMS + voice ingestion — read-only.
 *
 * Quo is the rebrand of OpenPhone; the REST API still lives on openphone.com.
 * The API key is stored in the QuoConfig singleton (pasted from Settings, never
 * in .env). Auth is the bare key in the Authorization header — NOT a Bearer
 * token (this is unusual but correct for the OpenPhone API).
 *
 * Identifiers are prefix-typed: phone numbers start with "PN", users "US".
 */
const QUO_API_BASE_DEFAULT = "https://api.openphone.com";

const QUO_ENDPOINTS = {
  phoneNumbers: "/v1/phone-numbers",
  conversations: "/v1/conversations",
  messages: "/v1/messages",
  calls: "/v1/calls",
};

export class QuoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QuoError";
  }
}

// A Quo "inbox" in the UI is a phone number in the API.
export type PhoneNumber = { id: string; name: string; number: string; users?: string[] };

type QuoConfigRow = {
  apiKey: string | null;
  apiBase: string | null;
  defaultPhoneNumberId: string | null;
  defaultPhoneNumberName: string | null;
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
  return (row?.apiBase || QUO_API_BASE_DEFAULT).replace(/\/$/, "");
}

export async function quoCall<T>(endpoint: string, init?: RequestInit): Promise<T> {
  const row = await readConfig();
  if (!row?.apiKey) throw new QuoError("Quo is not configured");
  const base = (row.apiBase || QUO_API_BASE_DEFAULT).replace(/\/$/, "");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(`${base}${endpoint}`, {
      ...init,
      headers: {
        // OpenPhone uses the raw key, no "Bearer" prefix.
        Authorization: row.apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(init?.headers ?? {}),
      },
      signal: controller.signal,
      cache: "no-store",
    });
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
      message?: string;
      errors?: { message?: string }[];
    } & T;
    if (!res.ok || data?.ok === false) {
      const msg =
        data?.errors?.[0]?.message ??
        data?.message ??
        data?.error ??
        `Quo returned HTTP ${res.status}`;
      throw new QuoError(String(msg));
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

// --- test / phone-number list -------------------------------------------
export async function testQuoConnection(): Promise<{ ok: boolean; phoneNumbers?: PhoneNumber[]; error?: string }> {
  if (!(await isQuoConfigured())) return { ok: false, error: "Quo is not configured" };
  try {
    const data = await quoCall<{ data?: PhoneNumber[] }>(QUO_ENDPOINTS.phoneNumbers);
    const phoneNumbers = (data.data ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      number: p.number,
      users: p.users,
    }));
    await recordSync(true, "ok");
    return { ok: true, phoneNumbers };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Connection test failed";
    await recordSync(false, msg);
    return { ok: false, error: msg };
  }
}

// --- payload shapes (isolate the Quo API mapping here) ------------------
type QuoConversation = {
  id: string;
  name?: string;
  participants?: string[]; // phone numbers
  lastActivityAt?: string;
};
type QuoMessagePayload = {
  id: string;
  direction?: string; // incoming | outgoing
  from?: string;
  to?: string[] | string;
  text?: string;
  body?: string;
  createdAt?: string;
};
type QuoCallPayload = {
  id: string;
  direction?: string; // incoming | outgoing
  from?: string;
  to?: string;
  participants?: string[];
  status?: string; // completed | missed | no-answer | voicemail
  duration?: number; // seconds
  createdAt?: string;
};

function isOutgoing(d: string | undefined): boolean {
  return d === "outgoing" || d === "out" || d === "outbound";
}

function otherParty(parts: string[] | undefined, ownNumber: string | null): string {
  const own = toE164(ownNumber);
  const list = (parts ?? []).map((p) => toE164(p)).filter(Boolean) as string[];
  return list.find((p) => p !== own) ?? list[0] ?? "Unknown";
}

function mapDuration(sec: number | undefined): string {
  if (!sec) return "";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return ` (${m}:${String(s).padStart(2, "0")})`;
}

function mapQuoCallToBody(c: QuoCallPayload, name: string): string {
  const status = (c.status ?? "").toLowerCase();
  if (status === "voicemail") return `Voicemail from ${name}`;
  if (status === "missed" || status === "no-answer") return `Missed call from ${name}`;
  if (isOutgoing(c.direction)) return `Outgoing call${mapDuration(c.duration)}`;
  return `Incoming call${mapDuration(c.duration)}`;
  // TODO (paid plans only): GET /v1/calls/{id}/summary and /transcription return
  // AI summaries/transcripts. They 403/404 on non-business plans — add later.
}

export type SyncResult = { fetched: number; created: number; skipped: number };

export async function syncQuoMessages(phoneNumberId: string): Promise<SyncResult> {
  const convData = await quoCall<{ data?: QuoConversation[] }>(
    `${QUO_ENDPOINTS.conversations}?phoneNumberId=${encodeURIComponent(phoneNumberId)}`
  );
  const conversations = convData.data ?? [];
  const ownNumber = (await readConfig())?.defaultPhoneNumberName ?? null;
  let fetched = 0;
  let created = 0;
  let skipped = 0;

  for (const conv of conversations) {
    const phone = otherParty(conv.participants, ownNumber);
    const subject = conv.name?.trim() || phone || "Unknown";
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

    const msgData = await quoCall<{ data?: QuoMessagePayload[] }>(
      `${QUO_ENDPOINTS.messages}?conversationId=${encodeURIComponent(conv.id)}`
    );
    for (const m of msgData.data ?? []) {
      fetched++;
      const msgKey = `quo-msg-${m.id}`;
      const existing = await prisma.message.findUnique({ where: { quoMessageId: msgKey } });
      if (existing) {
        skipped++;
        continue;
      }
      const when = new Date(m.createdAt ?? Date.now());
      const out = isOutgoing(m.direction);
      await prisma.message.create({
        data: {
          threadId: thread.id,
          quoMessageId: msgKey,
          fromName: subject,
          direction: out ? "OUT" : "IN",
          channel: "SMS",
          body: m.text ?? m.body ?? "",
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

export async function syncQuoCalls(phoneNumberId: string): Promise<SyncResult> {
  const data = await quoCall<{ data?: QuoCallPayload[] }>(
    `${QUO_ENDPOINTS.calls}?phoneNumberId=${encodeURIComponent(phoneNumberId)}`
  );
  const calls = data.data ?? [];
  const ownNumber = (await readConfig())?.defaultPhoneNumberName ?? null;
  let created = 0;
  let skipped = 0;

  for (const c of calls) {
    const phone = c.participants
      ? otherParty(c.participants, ownNumber)
      : toE164(isOutgoing(c.direction) ? c.to : c.from) ?? "Unknown";
    const name = phone;
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
    const when = new Date(c.createdAt ?? Date.now());
    await prisma.message.create({
      data: {
        threadId: thread.id,
        quoMessageId: callKey,
        fromName: name,
        direction: isOutgoing(c.direction) ? "OUT" : "IN",
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
