import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/roles";
import { rateLimit } from "@/lib/api/rateLimit";
import {
  getAssistantConfig,
  isAssistantEnabled,
  AssistantError,
  type ContentBlock,
  type ModelMessage,
} from "@/lib/assistant/anthropic";
import { callModel, DEFAULT_MODELS, ProviderError, type Provider } from "@/lib/assistant/providers";
import { toolsForRole, anthropicToolParam, type ToolCtx } from "@/lib/assistant/tools";

/**
 * Assistant chat route. Session-authenticated; every tool executes AS the
 * signed-in user through the role-scoped tool layer. Agentic loop with a
 * hard cap of 8 tool calls per turn. Write tools are confirm-gated: the
 * model's call is stored as a pending proposal and executed only when the
 * user approves (then audit-logged with channel "assistant").
 *
 * Responses are Server-Sent Events: {type: status|text|confirm|done|error}.
 */

const MAX_TOOL_CALLS = 8;

function systemPrompt(ctx: ToolCtx): string {
  return [
    `You are the Henley Hub assistant for Henley Contracting Ltd. You help ${ctx.userName} (role: ${ctx.role}) use the Hub by chatting.`,
    `NAMING MAP: a UI "Project" is a client engagement grouping Jobs. A "Job" is the operational unit (jobsite). Say "project" and "job" the way the UI does.`,
    `Rules: only real data — never invent records, numbers, or links. Use tools to look things up before answering. Record links you return must come from tool results.`,
    `Mutations always go through the user's confirmation card — never claim something was created or changed until the tool result confirms it. Never try to bypass a declined confirmation.`,
    `You can only see and do what this user's role permits. If a capability is missing from your tools, say so honestly.`,
    `Keep answers short and operational. Money values from tools are integer cents — format as dollars.`,
  ].join("\n");
}

type StoredBlockMsg = { role: "user" | "assistant"; blocks: ContentBlock[] };

function toModelMessages(rows: { role: string; content: string }[]): ModelMessage[] {
  const out: ModelMessage[] = [];
  for (const r of rows) {
    if (r.role === "user") {
      out.push({ role: "user", content: r.content });
    } else if (r.role === "assistant" || r.role === "tool") {
      try {
        const parsed = JSON.parse(r.content) as StoredBlockMsg;
        out.push({ role: parsed.role, content: parsed.blocks });
      } catch {
        out.push({ role: "assistant", content: r.content });
      }
    }
  }
  return out;
}

async function saveBlocks(threadId: string, role: "assistant" | "tool", msg: StoredBlockMsg) {
  await prisma.assistantMessage.create({
    data: { threadId, role, content: JSON.stringify(msg) },
  });
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isAssistantEnabled())) return NextResponse.json({ enabled: false });

  const thread = await prisma.assistantThread.findFirst({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
    include: { messages: { orderBy: { createdAt: "asc" }, take: 100 } },
  });
  return NextResponse.json({
    enabled: true,
    threadId: thread?.id ?? null,
    pendingAction: thread?.pendingAction ? JSON.parse(thread.pendingAction) : null,
    messages: (thread?.messages ?? []).map((m) => {
      if (m.role === "user") return { role: "user", text: m.content };
      try {
        const parsed = JSON.parse(m.content) as StoredBlockMsg;
        const text = parsed.blocks
          .filter((b): b is Extract<ContentBlock, { type: "text" }> => b.type === "text")
          .map((b) => b.text)
          .join("\n");
        return { role: m.role, text };
      } catch {
        return { role: m.role, text: m.content };
      }
    }).filter((m) => m.text),
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isAssistantEnabled())) {
    return NextResponse.json({ error: "Assistant is disabled" }, { status: 403 });
  }
  const rl = rateLimit(`assistant:${session.user.id}`, "write");
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Rate limited — retry in ${rl.retryAfterSec}s` },
      { status: 429 },
    );
  }

  const ctx: ToolCtx = {
    userId: session.user.id,
    userName: session.user.name ?? "there",
    role: session.user.role as Role,
    clientId: session.user.clientId ?? null,
  };
  const defs = toolsForRole(ctx.role);
  const toolParam = anthropicToolParam(ctx.role);

  const body = (await req.json()) as {
    threadId?: string;
    message?: string;
    confirm?: { approve: boolean };
    newThread?: boolean;
  };

  let thread =
    body.threadId && !body.newThread
      ? await prisma.assistantThread.findFirst({
          where: { id: body.threadId, userId: ctx.userId },
        })
      : null;
  if (!thread && !body.newThread) {
    thread = await prisma.assistantThread.findFirst({
      where: { userId: ctx.userId },
      orderBy: { updatedAt: "desc" },
    });
  }
  if (!thread) {
    thread = await prisma.assistantThread.create({
      data: { userId: ctx.userId, title: body.message?.slice(0, 60) ?? "New chat" },
    });
  }
  const threadId = thread.id;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      try {
        // 1. Handle a pending confirmation, or a fresh user message.
        if (body.confirm && thread!.pendingAction) {
          const pending = JSON.parse(thread!.pendingAction) as {
            toolUse: Extract<ContentBlock, { type: "tool_use" }>;
          };
          await prisma.assistantThread.update({
            where: { id: threadId },
            data: { pendingAction: null },
          });
          const def = defs.find((d) => d.name === pending.toolUse.name);
          let resultContent: string;
          if (!body.confirm.approve) {
            resultContent = JSON.stringify({ cancelled: true, note: "User declined the action." });
            send({ type: "status", text: "Action cancelled" });
          } else if (!def || !def.write) {
            resultContent = JSON.stringify({ error: "Tool not available" });
          } else {
            send({ type: "status", text: `Running ${def.name}…` });
            const result = await def.execute(ctx, pending.toolUse.input);
            resultContent = JSON.stringify(result);
            await prisma.auditLog.create({
              data: {
                actorId: ctx.userId,
                action: `assistant.${def.name}`,
                target: JSON.stringify(pending.toolUse.input).slice(0, 180),
              },
            });
          }
          await saveBlocks(threadId, "tool", {
            role: "user",
            blocks: [
              { type: "tool_result", tool_use_id: pending.toolUse.id, content: resultContent },
            ],
          });
        } else if (body.message?.trim()) {
          if (thread!.pendingAction) {
            // A new message implicitly declines the outstanding proposal.
            const pending = JSON.parse(thread!.pendingAction) as {
              toolUse: Extract<ContentBlock, { type: "tool_use" }>;
            };
            await saveBlocks(threadId, "tool", {
              role: "user",
              blocks: [
                {
                  type: "tool_result",
                  tool_use_id: pending.toolUse.id,
                  content: JSON.stringify({ cancelled: true, note: "User moved on without confirming." }),
                },
              ],
            });
            await prisma.assistantThread.update({
              where: { id: threadId },
              data: { pendingAction: null },
            });
          }
          await prisma.assistantMessage.create({
            data: { threadId, role: "user", content: body.message.trim() },
          });
        } else {
          send({ type: "error", text: "Empty message" });
          send({ type: "done" });
          controller.close();
          return;
        }

        // 2. Agentic loop.
        for (let calls = 0; calls <= MAX_TOOL_CALLS; calls++) {
          const rows = await prisma.assistantMessage.findMany({
            where: { threadId },
            orderBy: { createdAt: "asc" },
            take: 120,
          });
          const cfg = await getAssistantConfig();
          if (!cfg?.apiKey) throw new AssistantError("Assistant is not configured");
          const provider = (cfg.provider as Provider) || "anthropic";
          const res = await callModel({
            provider,
            apiKey: cfg.apiKey,
            model: cfg.model || DEFAULT_MODELS[provider],
            system: systemPrompt(ctx),
            messages: toModelMessages(rows),
            tools: toolParam,
          });

          const textBlocks = res.content.filter(
            (b): b is Extract<ContentBlock, { type: "text" }> => b.type === "text",
          );
          for (const t of textBlocks) send({ type: "text", text: t.text });

          const toolUse = res.content.find(
            (b): b is Extract<ContentBlock, { type: "tool_use" }> => b.type === "tool_use",
          );

          await saveBlocks(threadId, "assistant", { role: "assistant", blocks: res.content });

          if (!toolUse) break;

          const def = defs.find((d) => d.name === toolUse.name);
          if (!def) {
            await saveBlocks(threadId, "tool", {
              role: "user",
              blocks: [
                {
                  type: "tool_result",
                  tool_use_id: toolUse.id,
                  content: JSON.stringify({ error: "Tool not available for your role" }),
                  is_error: true,
                },
              ],
            });
            continue;
          }

          if (def.write) {
            // Confirm-before-mutate: store the proposal and stop the turn.
            const proposal = def.proposal?.(toolUse.input) ?? `Run ${def.name}`;
            await prisma.assistantThread.update({
              where: { id: threadId },
              data: { pendingAction: JSON.stringify({ toolUse, proposal, tool: def.name }) },
            });
            send({ type: "confirm", proposal, tool: def.name, input: toolUse.input });
            break;
          }

          send({ type: "status", text: `Running ${def.name}…` });
          let result: unknown;
          try {
            result = await def.execute(ctx, toolUse.input);
          } catch (err) {
            result = { error: err instanceof Error ? err.message : "Tool failed" };
          }
          await saveBlocks(threadId, "tool", {
            role: "user",
            blocks: [
              { type: "tool_result", tool_use_id: toolUse.id, content: JSON.stringify(result) },
            ],
          });
          if (calls === MAX_TOOL_CALLS) {
            send({ type: "text", text: "(Stopped after the per-turn tool budget — ask me to continue.)" });
            break;
          }
        }

        await prisma.assistantThread.update({
          where: { id: threadId },
          data: { updatedAt: new Date() },
        });
        send({ type: "done", threadId });
      } catch (err) {
        const msg =
          err instanceof AssistantError || err instanceof ProviderError
            ? err.message
            : err instanceof Error
            ? err.message
            : "Assistant error";
        send({ type: "error", text: msg });
        send({ type: "done", threadId });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
