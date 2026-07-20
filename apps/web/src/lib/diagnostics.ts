import "server-only";
import { prisma } from "@/lib/prisma";

// Central error-capture library for the Diagnostics panel.
//
// The single most important rule in this file: EVERY field is run through a
// redaction pass before it is written to the DB. Stack traces and request
// payloads routinely carry the QBO token, API keys, passwords, and bearer
// headers — an unredacted error row is a secret leak. logError() itself must
// never throw; a failure to log can never be allowed to crash the caller.

export type ErrorLevel = "error" | "warning" | "info";
export type ErrorSource = "server-action" | "api" | "client" | "integration";

export type LogErrorInput = {
  level?: ErrorLevel;
  source: ErrorSource;
  message: string;
  stack?: string | null;
  context?: unknown;
  route?: string | null;
  userId?: string | null;
};

const REDACTED = "[REDACTED]";

// Object/JSON keys whose VALUE is always a secret, regardless of content.
const SENSITIVE_KEY_RE =
  /(pass(word|wd|phrase)?|secret|token|api[-_]?key|apikey|access[-_]?token|refresh[-_]?token|grant[-_]?key|client[-_]?secret|authorization|auth[-_]?header|bearer|credential|cookie|set[-_]?cookie|private[-_]?key|session|otp|pin)/i;

// Substring patterns applied to every string we store.
const STRING_PATTERNS: Array<[RegExp, string]> = [
  // Authorization / bearer / basic — header value or inline.
  [/\b(bearer|basic)\s+[\w\-.=+/]+/gi, "$1 " + REDACTED],
  // authorization: <anything> and proxy-authorization: <anything>
  [/\b((?:proxy-)?authorization)\b\s*[:=]\s*[^\s,;'"}]+/gi, "$1: " + REDACTED],
  // JWTs (three base64url segments).
  [/\beyJ[\w-]+\.[\w-]+\.[\w-]+/g, REDACTED],
  // Prefixed keys: hk_ (Henley Tasks), sk-/pk- (OpenAI/Stripe style), etc.
  [/\b(?:hk|sk|pk|rk|ak|tok|key|api|ghp|gho|xox[baprs])[-_][A-Za-z0-9]{6,}/gi, REDACTED],
  // DB / broker connection strings with inline credentials.
  [
    /\b(postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|amqps?):\/\/[^\s:@/]+:[^\s:@/]+@/gi,
    "$1://" + REDACTED + "@",
  ],
  // key=value / "key":"value" where the key name is sensitive.
  [
    /("?\b(?:password|passwd|pwd|secret|client[-_]?secret|api[-_]?key|apikey|access[-_]?token|refresh[-_]?token|grant[-_]?key|token|authorization|credential|cookie|private[-_]?key)\b"?)\s*[:=]\s*("?)([^\s,;"'}]+)\2/gi,
    "$1: " + REDACTED,
  ],
  // Long hex blobs (sha1/sha256 digests, raw hex tokens). cuid()s are base36,
  // not pure hex, so IDs are not caught.
  [/\b[A-Fa-f0-9]{40,}\b/g, REDACTED],
];

// Exact env values (DATABASE_URL, AUTH_SECRET, QB/M365 secrets, Henley Tasks
// key, …). Computed once; any literal occurrence anywhere gets scrubbed.
let envValues: string[] | null = null;
function sensitiveEnvValues(): string[] {
  if (envValues) return envValues;
  const out: string[] = [];
  try {
    for (const [k, v] of Object.entries(process.env)) {
      if (!v || v.length < 6) continue;
      if (/(SECRET|TOKEN|KEY|PASS|AUTH|DATABASE_URL|CONN|CREDENTIAL|DSN|PRIVATE|WEBHOOK)/i.test(k)) {
        out.push(v);
      }
    }
  } catch {
    /* ignore */
  }
  // Longest first so a value that contains another is scrubbed whole.
  envValues = out.sort((a, b) => b.length - a.length);
  return envValues;
}

export function redactString(input: string): string {
  let s = input;
  // Exact known secrets first.
  for (const v of sensitiveEnvValues()) {
    if (s.includes(v)) s = s.split(v).join(REDACTED);
  }
  for (const [re, repl] of STRING_PATTERNS) {
    s = s.replace(re, repl);
  }
  return s;
}

// Deep-redact an arbitrary context value: sensitive keys are dropped wholesale,
// every string value is scrubbed, cycles and over-deep/over-wide structures are
// truncated so a huge payload can never blow up the logger.
function redactValue(value: unknown, seen: WeakSet<object>, depth: number): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return redactString(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "function" || typeof value === "symbol") return undefined;
  if (depth > 6) return "[truncated]";

  if (Array.isArray(value)) {
    return value.slice(0, 50).map((v) => redactValue(v, seen, depth + 1));
  }
  if (typeof value === "object") {
    if (seen.has(value as object)) return "[circular]";
    seen.add(value as object);
    const src = value instanceof Error ? { name: value.name, message: value.message, stack: value.stack } : (value as Record<string, unknown>);
    const out: Record<string, unknown> = {};
    let count = 0;
    for (const [k, v] of Object.entries(src)) {
      if (count++ >= 50) {
        out["…"] = "[truncated]";
        break;
      }
      out[k] = SENSITIVE_KEY_RE.test(k) ? REDACTED : redactValue(v, seen, depth + 1);
    }
    return out;
  }
  return undefined;
}

function safeRedactedJson(context: unknown): string | null {
  try {
    const redacted = redactValue(context, new WeakSet<object>(), 0);
    let json = JSON.stringify(redacted);
    if (json === undefined) return null;
    // Second pass over the serialized form catches secrets that only appear
    // once keys/values are stringified together.
    json = redactString(json);
    if (json.length > 20000) json = json.slice(0, 20000) + "…[truncated]";
    return json;
  } catch {
    return null;
  }
}

// Pull a clean {message, stack} out of any thrown value.
export function errorParts(err: unknown): { message: string; stack: string | null } {
  if (err instanceof Error) return { message: err.message || err.name || "Error", stack: err.stack ?? null };
  if (typeof err === "string") return { message: err, stack: null };
  try {
    return { message: JSON.stringify(err) || "Unknown error", stack: null };
  } catch {
    return { message: "Unknown error", stack: null };
  }
}

// Write one redacted ErrorLog row. Guaranteed not to throw or reject.
export async function logError(input: LogErrorInput): Promise<void> {
  try {
    const level: ErrorLevel = input.level ?? "error";
    const message = (redactString(String(input.message ?? "")).slice(0, 8000)) || "(no message)";
    const stack = input.stack ? redactString(String(input.stack)).slice(0, 20000) : null;
    const context = input.context === undefined ? null : safeRedactedJson(input.context);
    const route = input.route ? redactString(String(input.route)).slice(0, 512) : null;
    const userId = input.userId ?? null;

    await prisma.errorLog.create({
      data: { level, source: input.source, message, stack, context, route, userId },
    });
  } catch (err) {
    try {
      console.error("[diagnostics] logError failed:", err instanceof Error ? err.message : err);
    } catch {
      /* nothing left to do */
    }
  }
}
