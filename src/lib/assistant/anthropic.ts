import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Minimal Anthropic Messages client over fetch (no SDK dependency). The org
 * API key lives ONLY in the AnthropicConfig singleton, entered via Settings.
 */

const API_URL = "https://api.anthropic.com/v1/messages";
const API_VERSION = "2023-06-01";

export type ContentBlock =
  | { type: "text"; text: string }
  // _gemThought: Gemini's thoughtSignature, which MUST be echoed back on the
  // next turn. Stored with the block; stripped before Anthropic/OpenAI calls.
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown>; _gemThought?: string }
  | { type: "tool_result"; tool_use_id: string; content: string; is_error?: boolean };

export type ModelMessage = { role: "user" | "assistant"; content: string | ContentBlock[] };

export type MessagesResponse = {
  content: ContentBlock[];
  stop_reason: "end_turn" | "tool_use" | "max_tokens" | string;
  usage?: { input_tokens: number; output_tokens: number };
};

export async function getAssistantConfig() {
  try {
    return await prisma.anthropicConfig.findUnique({ where: { id: "singleton" } });
  } catch {
    return null;
  }
}

export async function isAssistantEnabled(): Promise<boolean> {
  const c = await getAssistantConfig();
  return Boolean(c?.enabled && c.apiKey);
}

export class AssistantError extends Error {}

export async function callMessages(params: {
  system: string;
  messages: ModelMessage[];
  tools: { name: string; description: string; input_schema: Record<string, unknown> }[];
  maxTokens?: number;
}): Promise<MessagesResponse> {
  const cfg = await getAssistantConfig();
  if (!cfg?.enabled || !cfg.apiKey) throw new AssistantError("Assistant is not enabled");

  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": cfg.apiKey,
      "anthropic-version": API_VERSION,
    },
    body: JSON.stringify({
      model: cfg.model || "claude-sonnet-5",
      max_tokens: params.maxTokens ?? 2048,
      system: params.system,
      messages: params.messages,
      tools: params.tools,
    }),
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) {
    // Raw error surfaced verbatim into the chat (house precedent).
    throw new AssistantError(`Anthropic API ${res.status}: ${text.slice(0, 800)}`);
  }
  return JSON.parse(text) as MessagesResponse;
}
