import "server-only";
import type { ContentBlock, ModelMessage } from "@/lib/assistant/anthropic";

/**
 * Universal AI provider layer. One key box in Settings: the provider is
 * detected from the key prefix, verified live on save, and the chat loop
 * speaks each provider's dialect through these adapters. Conversation state
 * is stored in the Anthropic block shape (text / tool_use / tool_result) and
 * converted per provider on the way out.
 */

export type Provider = "anthropic" | "openai" | "gemini";

export const PROVIDER_LABELS: Record<Provider, string> = {
  anthropic: "Claude",
  openai: "GPT",
  gemini: "Gemini",
};

export const DEFAULT_MODELS: Record<Provider, string> = {
  anthropic: "claude-sonnet-5",
  openai: "gpt-4o",
  gemini: "gemini-2.0-flash",
};

export function detectProvider(apiKey: string): Provider | null {
  if (apiKey.startsWith("sk-ant-")) return "anthropic";
  if (apiKey.startsWith("AIza")) return "gemini";
  if (apiKey.startsWith("sk-")) return "openai"; // after sk-ant- check
  return null;
}

export type ToolSpec = { name: string; description: string; input_schema: Record<string, unknown> };
export type ModelResult = { content: ContentBlock[]; stop_reason: string };

type CallParams = {
  provider: Provider;
  apiKey: string;
  model: string;
  system: string;
  messages: ModelMessage[];
  tools: ToolSpec[];
  maxTokens?: number;
};

export class ProviderError extends Error {}

async function post(url: string, headers: Record<string, string>, body: unknown): Promise<unknown> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) throw new ProviderError(`${new URL(url).host} ${res.status}: ${text.slice(0, 600)}`);
  return JSON.parse(text);
}

// ── Anthropic ────────────────────────────────────────────────────────────────

async function callAnthropic(p: CallParams): Promise<ModelResult> {
  const d = (await post(
    "https://api.anthropic.com/v1/messages",
    { "x-api-key": p.apiKey, "anthropic-version": "2023-06-01" },
    {
      model: p.model,
      max_tokens: p.maxTokens ?? 2048,
      system: p.system,
      messages: p.messages,
      tools: p.tools,
    },
  )) as { content: ContentBlock[]; stop_reason: string };
  return { content: d.content ?? [], stop_reason: d.stop_reason ?? "end_turn" };
}

// ── OpenAI ───────────────────────────────────────────────────────────────────

type OAIMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: { id: string; type: "function"; function: { name: string; arguments: string } }[] }
  | { role: "tool"; tool_call_id: string; content: string };

function toOpenAI(system: string, messages: ModelMessage[]): OAIMessage[] {
  const out: OAIMessage[] = [{ role: "system", content: system }];
  for (const m of messages) {
    if (typeof m.content === "string") {
      out.push({ role: m.role === "assistant" ? "assistant" : "user", content: m.content } as OAIMessage);
      continue;
    }
    if (m.role === "assistant") {
      const text = m.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("\n");
      const calls = m.content
        .filter((b): b is Extract<ContentBlock, { type: "tool_use" }> => b.type === "tool_use")
        .map((b) => ({ id: b.id, type: "function" as const, function: { name: b.name, arguments: JSON.stringify(b.input) } }));
      out.push({ role: "assistant", content: text || null, ...(calls.length ? { tool_calls: calls } : {}) });
    } else {
      for (const b of m.content) {
        if (b.type === "tool_result") out.push({ role: "tool", tool_call_id: b.tool_use_id, content: b.content });
        else if (b.type === "text") out.push({ role: "user", content: b.text });
      }
    }
  }
  return out;
}

async function callOpenAI(p: CallParams): Promise<ModelResult> {
  const d = (await post(
    "https://api.openai.com/v1/chat/completions",
    { Authorization: `Bearer ${p.apiKey}` },
    {
      model: p.model,
      max_tokens: p.maxTokens ?? 2048,
      messages: toOpenAI(p.system, p.messages),
      tools: p.tools.map((t) => ({
        type: "function",
        function: { name: t.name, description: t.description, parameters: t.input_schema },
      })),
    },
  )) as {
    choices: {
      finish_reason: string;
      message: { content: string | null; tool_calls?: { id: string; function: { name: string; arguments: string } }[] };
    }[];
  };
  const msg = d.choices?.[0]?.message;
  const content: ContentBlock[] = [];
  if (msg?.content) content.push({ type: "text", text: msg.content });
  for (const c of msg?.tool_calls ?? []) {
    let input: Record<string, unknown> = {};
    try {
      input = JSON.parse(c.function.arguments || "{}");
    } catch {
      /* leave empty */
    }
    content.push({ type: "tool_use", id: c.id, name: c.function.name, input });
  }
  const stop = d.choices?.[0]?.finish_reason === "tool_calls" ? "tool_use" : "end_turn";
  return { content, stop_reason: stop };
}

// ── Gemini ───────────────────────────────────────────────────────────────────

type GeminiPart =
  | { text: string }
  | { functionCall: { name: string; args: Record<string, unknown> } }
  | { functionResponse: { name: string; response: Record<string, unknown> } };

function toGemini(messages: ModelMessage[]): { role: "user" | "model"; parts: GeminiPart[] }[] {
  // Gemini pairs tool results by NAME, not id — map ids back to names.
  const idToName = new Map<string, string>();
  const out: { role: "user" | "model"; parts: GeminiPart[] }[] = [];
  for (const m of messages) {
    if (typeof m.content === "string") {
      out.push({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] });
      continue;
    }
    const parts: GeminiPart[] = [];
    for (const b of m.content) {
      if (b.type === "text") parts.push({ text: b.text });
      else if (b.type === "tool_use") {
        idToName.set(b.id, b.name);
        parts.push({ functionCall: { name: b.name, args: b.input } });
      } else if (b.type === "tool_result") {
        let response: Record<string, unknown>;
        try {
          const parsed = JSON.parse(b.content);
          response = typeof parsed === "object" && parsed !== null ? parsed : { result: parsed };
        } catch {
          response = { result: b.content };
        }
        parts.push({
          functionResponse: { name: idToName.get(b.tool_use_id) ?? "unknown_tool", response },
        });
      }
    }
    if (parts.length) out.push({ role: m.role === "assistant" ? "model" : "user", parts });
  }
  return out;
}

async function callGemini(p: CallParams): Promise<ModelResult> {
  const d = (await post(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(p.model)}:generateContent?key=${encodeURIComponent(p.apiKey)}`,
    {},
    {
      systemInstruction: { parts: [{ text: p.system }] },
      contents: toGemini(p.messages),
      tools: [{ functionDeclarations: p.tools.map((t) => ({ name: t.name, description: t.description, parameters: t.input_schema })) }],
      generationConfig: { maxOutputTokens: p.maxTokens ?? 2048 },
    },
  )) as { candidates?: { content?: { parts?: GeminiPart[] } }[] };
  const parts = d.candidates?.[0]?.content?.parts ?? [];
  const content: ContentBlock[] = [];
  let i = 0;
  for (const part of parts) {
    if ("text" in part && part.text) content.push({ type: "text", text: part.text });
    else if ("functionCall" in part) {
      content.push({
        type: "tool_use",
        id: `gem_${Date.now()}_${i++}`,
        name: part.functionCall.name,
        input: part.functionCall.args ?? {},
      });
    }
  }
  const stop = content.some((c) => c.type === "tool_use") ? "tool_use" : "end_turn";
  return { content, stop_reason: stop };
}

// ── Dispatch + live verification ─────────────────────────────────────────────

export async function callModel(p: CallParams): Promise<ModelResult> {
  if (p.provider === "anthropic") return callAnthropic(p);
  if (p.provider === "openai") return callOpenAI(p);
  return callGemini(p);
}

/** Cheap live check used by "Save & enable" — errors returned verbatim. */
export async function verifyProvider(
  provider: Provider,
  apiKey: string,
  model: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await callModel({
      provider,
      apiKey,
      model,
      system: "Reply with OK.",
      messages: [{ role: "user", content: "ping" }],
      tools: [],
      maxTokens: 8,
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Verification failed" };
  }
}
