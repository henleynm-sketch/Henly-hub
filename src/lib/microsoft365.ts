import "server-only";
import { prisma } from "@/lib/prisma";

export function isM365Configured(): boolean {
  return Boolean(
    process.env.M365_TENANT_ID &&
      process.env.M365_CLIENT_ID &&
      process.env.M365_CLIENT_SECRET &&
      process.env.M365_MAILBOX
  );
}

type CachedToken = { token: string; expiresAtMs: number };
let cachedToken: CachedToken | null = null;

export async function getGraphToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAtMs - 60_000) {
    return cachedToken.token;
  }
  const tenant = process.env.M365_TENANT_ID;
  const clientId = process.env.M365_CLIENT_ID;
  const clientSecret = process.env.M365_CLIENT_SECRET;
  if (!tenant || !clientId || !clientSecret) {
    throw new Error("Microsoft 365 is not configured");
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });

  const res = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Graph token request failed (HTTP ${res.status})`);
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    token: data.access_token,
    expiresAtMs: Date.now() + data.expires_in * 1000,
  };
  return cachedToken.token;
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
  const mailbox = process.env.M365_MAILBOX;
  if (!isM365Configured() || !mailbox) throw new Error("Microsoft 365 is not configured");

  const token = await getGraphToken();
  const params = new URLSearchParams({
    $top: "50",
    $orderby: "receivedDateTime desc",
    $select: "id,conversationId,subject,from,toRecipients,receivedDateTime,bodyPreview",
  });
  const res = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(mailbox)}/messages?${params}`,
    { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
  );
  if (!res.ok) throw new Error(`Graph messages request failed (HTTP ${res.status})`);
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

  return { fetched: messages.length, created, skipped };
}
