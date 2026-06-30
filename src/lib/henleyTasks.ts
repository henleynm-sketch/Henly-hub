import "server-only";
import { prisma } from "./prisma";

// Henley Tasks (https://tasks.henleycontracting.com/api) is the system of record
// for tasks. The Hub is a live control surface over its REST API and stores NO
// task data locally. Base URL + auth + the pretty-URL/v1.php fallback are all
// centralized in this one module.

const DEFAULT_BASE = "https://tasks.henleycontracting.com/api";

// Update/delete are NOT in the documented API yet (only GET + POST are). They
// are wired here behind a single flag and named method/path constants so they
// activate with a one-line change once Antu confirms — until then they are
// inert and no edit/delete UI is surfaced. DO NOT flip without confirmation.
export const TASKS_WRITE_BACK_ENABLED = false;
const TASKS_UPDATE_METHOD = "PATCH";
const TASKS_UPDATE_PATH = (id: string) => `/tasks/${encodeURIComponent(id)}`;
const TASKS_DELETE_METHOD = "DELETE";
const TASKS_DELETE_PATH = (id: string) => `/tasks/${encodeURIComponent(id)}`;

async function getCredentials(): Promise<{ apiBaseUrl: string; apiKey: string } | null> {
  const row = await prisma.henleyTasksConfig.findUnique({ where: { id: "singleton" } }).catch(() => null);
  const apiKey = row?.apiKey ?? process.env.HENLEY_TASKS_API_KEY ?? null;
  if (!apiKey) return null;
  const apiBaseUrl = (row?.apiBaseUrl && row.apiBaseUrl !== DEFAULT_BASE)
    ? row.apiBaseUrl
    : (process.env.HENLEY_TASKS_API_URL ?? row?.apiBaseUrl ?? DEFAULT_BASE);
  return { apiBaseUrl, apiKey };
}

export type HenleyTask = {
  id: string;
  title: string;
  description?: string;
  type?: string;
  priority: "low" | "medium" | "high";
  status: "open" | "in_progress" | "done";
  due_date?: string;
  assignee?: string;
  tags?: string[];
  created_at: string;
  updated_at: string;
};

export type TaskFilters = {
  status?: string;
  priority?: string;
  assignee?: string;
  due_before?: string;
  due_after?: string;
  q?: string;
  limit?: number;
  offset?: number;
};

export type ListTasksResult =
  | { ok: true; tasks: HenleyTask[]; total: number }
  | { ok: false; error: string };

export type GetTaskResult =
  | { ok: true; task: HenleyTask }
  | { ok: false; error: string };

export type TaskPayload = {
  title: string;
  priority?: "low" | "medium" | "high";
  dueDate?: string; // ISO date string, e.g. "2026-07-01"
  assignee?: string;
  note?: string;
  projectName?: string;
};

export type TestResult = { ok: true } | { ok: false; error: string };
export type CreateResult = { ok: true; taskId?: string } | { ok: false; error: string };
export type WriteResult = { ok: true } | { ok: false; error: string };

// ── Centralized request + pretty-URL/v1.php fallback ───────────────────────
// Pretty URLs (/api/tasks) may be disabled on the server, in which case the
// same resource lives at /api/v1.php/tasks. We discover which prefix works on
// the first request and reuse it; a real 404 (e.g. an unknown task id) is left
// as a genuine 404 once the prefix is locked in.
type Prefix = "" | "/v1.php";
let resolvedPrefix: Prefix | null = null;

async function tasksFetch(
  creds: { apiBaseUrl: string; apiKey: string },
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${creds.apiKey}`,
    ...(init?.headers as Record<string, string> | undefined),
  };
  const attempt = (prefix: Prefix) =>
    fetch(`${creds.apiBaseUrl}${prefix}${path}`, { ...init, headers, cache: "no-store" });

  if (resolvedPrefix !== null) {
    return attempt(resolvedPrefix);
  }

  // First call for this process: try pretty URL, fall back to /v1.php on 404.
  const primary = await attempt("");
  if (primary.status !== 404) {
    resolvedPrefix = "";
    return primary;
  }
  const fallback = await attempt("/v1.php");
  if (fallback.status !== 404) {
    resolvedPrefix = "/v1.php";
    return fallback;
  }
  // Both 404 — leave prefix undiscovered and surface the original response.
  return primary;
}

// Verbatim status + body — never swallow or rewrite the server's message.
async function errorFrom(res: Response): Promise<string> {
  let body = "";
  try {
    body = (await res.text()).trim();
  } catch {
    // no body
  }
  return body ? `HTTP ${res.status}: ${body}` : `HTTP ${res.status}`;
}

export async function testConnection(): Promise<TestResult> {
  const creds = await getCredentials();
  if (!creds) {
    await recordTest(false, "API key not configured");
    return { ok: false, error: "API key not configured" };
  }

  try {
    const res = await tasksFetch(creds, "/tasks?limit=1");
    if (!res.ok) {
      const msg = await errorFrom(res);
      await recordTest(false, msg);
      return { ok: false, error: msg };
    }
    // A healthy list response carries a numeric total.
    const body = (await res.json().catch(() => null)) as { total?: unknown } | null;
    if (!body || typeof body.total !== "number") {
      const msg = "Unexpected response (no numeric `total`)";
      await recordTest(false, msg);
      return { ok: false, error: msg };
    }
    await recordTest(true, "OK");
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Network error";
    await recordTest(false, msg);
    return { ok: false, error: msg };
  }
}

export async function listTasks(filters: TaskFilters = {}): Promise<ListTasksResult> {
  const creds = await getCredentials();
  if (!creds) return { ok: false, error: "API key not configured — set it in Settings → Integrations" };

  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.priority) params.set("priority", filters.priority);
  if (filters.assignee) params.set("assignee", filters.assignee);
  if (filters.due_before) params.set("due_before", filters.due_before);
  if (filters.due_after) params.set("due_after", filters.due_after);
  if (filters.q) params.set("q", filters.q);
  params.set("limit", String(Math.min(filters.limit ?? 50, 200)));
  params.set("offset", String(filters.offset ?? 0));

  try {
    const res = await tasksFetch(creds, `/tasks?${params.toString()}`);
    if (!res.ok) return { ok: false, error: await errorFrom(res) };
    const body = (await res.json()) as { tasks?: HenleyTask[]; total?: number };
    return { ok: true, tasks: body.tasks ?? [], total: body.total ?? 0 };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Network error" };
  }
}

export async function getTask(id: string): Promise<GetTaskResult> {
  const creds = await getCredentials();
  if (!creds) return { ok: false, error: "API key not configured" };

  try {
    const res = await tasksFetch(creds, `/tasks/${encodeURIComponent(id)}`);
    if (!res.ok) return { ok: false, error: await errorFrom(res) };
    const task = (await res.json()) as HenleyTask;
    return { ok: true, task };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Network error" };
  }
}

export async function createTask(payload: TaskPayload): Promise<CreateResult> {
  const creds = await getCredentials();
  if (!creds) {
    return { ok: false, error: "API key not configured — set it in Settings → Integrations" };
  }

  // Map the Hub's form fields onto the documented Task object shape.
  const descriptionParts = [payload.note?.trim(), payload.projectName ? `Project: ${payload.projectName}` : ""]
    .filter(Boolean);
  const body: Record<string, unknown> = { title: payload.title };
  if (payload.priority) body.priority = payload.priority;
  if (payload.dueDate) body.due_date = payload.dueDate;
  if (payload.assignee?.trim()) body.assignee = payload.assignee.trim();
  if (descriptionParts.length) body.description = descriptionParts.join("\n");

  try {
    const res = await tasksFetch(creds, "/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return { ok: false, error: await errorFrom(res) };

    let taskId: string | undefined;
    try {
      const resBody = (await res.json()) as Record<string, unknown>;
      taskId = (resBody.id ?? resBody.taskId) as string | undefined;
    } catch {
      // response body not required for success
    }
    return { ok: true, taskId };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Network error" };
  }
}

// ── Write-back (gated; inert until Antu confirms PATCH/DELETE) ──────────────

export async function updateTask(id: string, patch: Partial<HenleyTask>): Promise<WriteResult> {
  if (!TASKS_WRITE_BACK_ENABLED) {
    return { ok: false, error: "Task write-back is disabled (pending API confirmation)" };
  }
  const creds = await getCredentials();
  if (!creds) return { ok: false, error: "API key not configured" };
  try {
    const res = await tasksFetch(creds, TASKS_UPDATE_PATH(id), {
      method: TASKS_UPDATE_METHOD,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) return { ok: false, error: await errorFrom(res) };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Network error" };
  }
}

export async function deleteTask(id: string): Promise<WriteResult> {
  if (!TASKS_WRITE_BACK_ENABLED) {
    return { ok: false, error: "Task write-back is disabled (pending API confirmation)" };
  }
  const creds = await getCredentials();
  if (!creds) return { ok: false, error: "API key not configured" };
  try {
    const res = await tasksFetch(creds, TASKS_DELETE_PATH(id), { method: TASKS_DELETE_METHOD });
    if (!res.ok) return { ok: false, error: await errorFrom(res) };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Network error" };
  }
}

async function recordTest(ok: boolean, msg: string) {
  await prisma.henleyTasksConfig
    .upsert({
      where: { id: "singleton" },
      update: { lastTestAt: new Date(), lastTestOk: ok, lastTestResult: msg },
      create: { id: "singleton", lastTestAt: new Date(), lastTestOk: ok, lastTestResult: msg },
    })
    .catch(() => {});
}
