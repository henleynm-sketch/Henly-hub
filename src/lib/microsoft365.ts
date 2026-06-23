import "server-only";
import { prisma } from "@/lib/prisma";

export type M365Credentials = {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  mailbox: string;
};

// Credentials live in the M365Config singleton row so they can be set from the
// UI without a redeploy; process.env is only a bootstrap fallback (same
// Setting-first-then-env pattern as HUB_TASKS_API_KEY).
export async function getM365Credentials(): Promise<M365Credentials | null> {
  let row: {
    tenantId: string | null;
    clientId: string | null;
    clientSecret: string | null;
    mailbox: string | null;
  } | null = null;
  try {
    row = await prisma.m365Config.findUnique({ where: { id: "singleton" } });
  } catch {
    // M365Config table may not exist yet on a fresh install.
  }

  const tenantId = row?.tenantId ?? process.env.M365_TENANT_ID ?? null;
  const clientId = row?.clientId ?? process.env.M365_CLIENT_ID ?? null;
  const clientSecret = row?.clientSecret ?? process.env.M365_CLIENT_SECRET ?? null;
  const mailbox = row?.mailbox ?? process.env.M365_MAILBOX ?? null;

  if (!tenantId || !clientId || !clientSecret || !mailbox) return null;
  return { tenantId, clientId, clientSecret, mailbox };
}

export async function isM365Configured(): Promise<boolean> {
  return (await getM365Credentials()) !== null;
}

type CachedToken = { token: string; tenantId: string; clientId: string; expiresAtMs: number };
let cachedToken: CachedToken | null = null;

export async function getGraphToken(creds?: M365Credentials): Promise<string> {
  const c = creds ?? (await getM365Credentials());
  if (!c) throw new Error("Microsoft 365 is not configured");

  // Cache is keyed on tenant+client so editing credentials invalidates it.
  if (
    cachedToken &&
    cachedToken.tenantId === c.tenantId &&
    cachedToken.clientId === c.clientId &&
    Date.now() < cachedToken.expiresAtMs - 60_000
  ) {
    return cachedToken.token;
  }

  const body = new URLSearchParams({
    client_id: c.clientId,
    client_secret: c.clientSecret,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });

  const res = await fetch(`https://login.microsoftonline.com/${c.tenantId}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !data.access_token) {
    // Surface the real Microsoft auth error rather than a generic status.
    const tokenErr = data.error_description?.split("\n")[0] ?? data.error ?? `HTTP ${res.status}`;
    throw new Error(tokenErr);
  }
  cachedToken = {
    token: data.access_token,
    tenantId: c.tenantId,
    clientId: c.clientId,
    expiresAtMs: Date.now() + (data.expires_in ?? 3600) * 1000,
  };
  return cachedToken.token;
}

async function recordSync(ok: boolean, msg: string) {
  try {
    await prisma.m365Config.update({
      where: { id: "singleton" },
      data: { lastSyncAt: new Date(), lastSyncOk: ok, lastSyncMsg: msg },
    });
  } catch {
    // No singleton row when running purely from env vars — nothing to record.
  }
}

export type TestResult = { ok: true } | { ok: false; error: string };

export async function testM365Connection(): Promise<TestResult> {
  const creds = await getM365Credentials();
  if (!creds) return { ok: false, error: "Microsoft 365 is not configured" };
  try {
    const token = await getGraphToken(creds);
    // Hit /mailFolders/inbox — requires Mail.Read (app-only), not User.Read.All.
    const res = await fetch(
      `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(creds.mailbox)}/mailFolders/inbox`,
      { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
    );
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as {
        error?: { code?: string; message?: string };
      };
      const code = body.error?.code ?? "";
      const msg = body.error?.message ?? `HTTP ${res.status}`;
      const verbatim = code ? `${code}: ${msg}` : msg;
      await recordSync(false, verbatim);
      return { ok: false, error: verbatim };
    }
    await recordSync(true, "Connection test passed");
    return { ok: true };
  } catch (err) {
    const failMsg = err instanceof Error ? err.message : "Connection test failed";
    await recordSync(false, failMsg);
    return { ok: false, error: failMsg };
  }
}

type GraphRecipient = { emailAddress: { name?: string; address?: string } };
type GraphMessage = {
  id: string;
  conversationId: string;
  subject: string | null;
  from?: GraphRecipient;
  toRecipients?: GraphRecipient[];
  receivedDateTime: string;
  bodyPreview: string | null;
};

export type SyncResult = { fetched: number; created: number; skipped: number };

export async function syncInbox(): Promise<SyncResult> {
  const creds = await getM365Credentials();
  if (!creds) throw new Error("Microsoft 365 is not configured");

  try {
    const token = await getGraphToken(creds);
    const params = new URLSearchParams({
      $top: "50",
      $orderby: "receivedDateTime desc",
      $select: "id,conversationId,subject,from,toRecipients,receivedDateTime,bodyPreview",
    });
    const res = await fetch(
      `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(creds.mailbox)}/messages?${params}`,
      { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
    );
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as {
        error?: { code?: string; message?: string };
      };
      const code = body.error?.code ?? "";
      const msg = body.error?.message ?? `Graph messages request failed (HTTP ${res.status})`;
      throw new Error(code ? `${code}: ${msg}` : msg);
    }
    const data = (await res.json()) as { value: GraphMessage[] };
    const messages = data.value ?? [];

    let created = 0;
    let skipped = 0;

    for (const msg of messages) {
      const existing = await prisma.message.findUnique({ where: { graphMessageId: msg.id } });
      if (existing) {
        skipped++;
        continue;
      }

      const fromAddress = msg.from?.emailAddress?.address ?? null;
      const fromName = msg.from?.emailAddress?.name ?? fromAddress ?? "Unknown sender";
      const receivedAt = new Date(msg.receivedDateTime);
      const subject = msg.subject?.trim() || "(no subject)";

      let thread = await prisma.thread.findUnique({
        where: { graphConversationId: msg.conversationId },
      });
      if (!thread) {
        const client = fromAddress
          ? await prisma.client.findFirst({ where: { primaryEmail: fromAddress } })
          : null;
        thread = await prisma.thread.create({
          data: {
            subject,
            channel: "EMAIL",
            graphConversationId: msg.conversationId,
            clientId: client?.id ?? null,
            lastAt: receivedAt,
          },
        });
      } else if (receivedAt > thread.lastAt) {
        await prisma.thread.update({
          where: { id: thread.id },
          data: { lastAt: receivedAt, unread: thread.unread + 1 },
        });
      }

      await prisma.message.create({
        data: {
          threadId: thread.id,
          graphMessageId: msg.id,
          fromName,
          direction: "IN",
          channel: "EMAIL",
          body: msg.bodyPreview ?? "",
          sentAt: receivedAt,
        },
      });
      created++;
    }

    await recordSync(true, `Synced ${created} new message${created === 1 ? "" : "s"}`);
    return { fetched: messages.length, created, skipped };
  } catch (err) {
    const syncErr = err instanceof Error ? err.message : "Inbox sync failed";
    await recordSync(false, syncErr);
    throw err;
  }
}
