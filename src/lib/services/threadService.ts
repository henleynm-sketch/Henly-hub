import "server-only";
import { prisma } from "@/lib/prisma";
import { NotFoundError, ValidationError } from "@/lib/api/errors";
import { cursorArgs, paginate, type Pagination } from "@/lib/api/validation";

// Threads + their Messages (one service; messages have no standalone list).

export async function listThreads(p: Pagination, filter?: { clientId?: string; channel?: string }) {
  const where: Record<string, unknown> = {};
  if (filter?.clientId) where.clientId = filter.clientId;
  if (filter?.channel) where.channel = filter.channel;
  const rows = await prisma.thread.findMany({
    where,
    orderBy: { lastAt: "desc" },
    include: {
      client: { select: { id: true, name: true } },
      project: { select: { id: true, name: true } },
    },
    ...cursorArgs(p),
  });
  return paginate(rows, p.limit);
}

export async function getThreadById(id: string) {
  const t = await prisma.thread.findUnique({ where: { id } });
  if (!t) throw new NotFoundError("Thread not found");
  return t;
}

export async function listThreadMessages(threadId: string, p: Pagination) {
  await getThreadById(threadId);
  const rows = await prisma.message.findMany({
    where: { threadId },
    orderBy: { sentAt: "asc" },
    ...cursorArgs(p),
  });
  return paginate(rows, p.limit);
}

export type CreateMessageInput = {
  threadId: string;
  body: string;
  authorId?: string | null;
  fromName?: string;
  direction?: string; // IN | OUT (default OUT)
  channel?: string; // defaults to the thread's channel
};

export async function createMessage(input: CreateMessageInput) {
  if (!input.threadId) throw new ValidationError("threadId is required", { threadId: ["required"] });
  const body = input.body?.trim();
  if (!body) throw new ValidationError("body is required", { body: ["required"] });
  const thread = await prisma.thread.findUnique({ where: { id: input.threadId } });
  if (!thread) throw new ValidationError("threadId does not reference an existing thread", { threadId: ["not found"] });

  const direction = input.direction ?? "OUT";
  const channel = input.channel ?? thread.channel;
  const message = await prisma.message.create({
    data: {
      threadId: input.threadId,
      body,
      direction,
      channel,
      authorId: input.authorId ?? null,
      fromName: input.fromName ?? "Henley",
    },
  });
  await prisma.thread.update({
    where: { id: input.threadId },
    data: { lastAt: new Date(), unread: direction === "OUT" ? 0 : thread.unread + 1 },
  });
  return message;
}
