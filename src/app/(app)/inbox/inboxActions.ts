"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { sendReply } from "@/lib/microsoft365";
import { revalidatePath } from "next/cache";
import { isInternal, type Role } from "@/lib/roles";

export type ReplyResult = { ok: boolean; error?: string };

export async function replyToThread(
  threadId: string,
  body: string
): Promise<ReplyResult> {
  const me = await auth();
  if (!me?.user || !isInternal(me.user.role as Role)) {
    return { ok: false, error: "Not authorized" };
  }

  const trimmed = body.trim();
  if (!trimmed) return { ok: false, error: "Body is required" };

  const thread = await prisma.thread.findUnique({
    where: { id: threadId },
    include: {
      messages: {
        where: { direction: "IN" },
        orderBy: { sentAt: "desc" },
        take: 1,
      },
    },
  });
  if (!thread) return { ok: false, error: "Thread not found" };

  // EMAIL threads: send via Graph reply-in-thread before writing to DB.
  if (thread.channel === "EMAIL") {
    const lastIn = thread.messages[0];
    if (!lastIn?.graphMessageId) {
      return { ok: false, error: "No inbound message to reply to" };
    }
    try {
      await sendReply(lastIn.graphMessageId, trimmed);
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : "Send failed",
      };
    }
  }

  // Persist outbound message to DB (all channels).
  const now = new Date();
  await prisma.message.create({
    data: {
      threadId,
      fromName: me.user.name ?? "Henley",
      authorId: me.user.id,
      direction: "OUT",
      channel: thread.channel,
      body: trimmed,
      sentAt: now,
    },
  });
  await prisma.thread.update({
    where: { id: threadId },
    data: { lastAt: now },
  });

  revalidatePath("/inbox");
  return { ok: true };
}
