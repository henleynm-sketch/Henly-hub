import "server-only";
import { prisma } from "./prisma";

const DEFAULT_BASE = "https://tasks.henleycontracting.com/api";

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
  note?: string;
  projectName?: string;
};

export type TestResult = { ok: true } | { ok: false; error: string };
export type CreateResult = { ok: true; taskId?: string } | { ok: false; error: string };

export async function testConnection(): Promise<TestResult> {
  const creds = await getCredentials();
  if (!creds) {
    await recordTest(false, "API key not configured");
    return { ok: false, error: "API key not configured" };
  }

  try {
    const res = await fetch(`${creds.apiBaseUrl}/tasks?limit=1`, {
      method: "GET",
      headers: { Authorization: `Bearer ${creds.apiKey}` },
      cache: "no-store",
    });

    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try {
        const body = await res.json() as Record<string, unknown>;
        const err = body.error as Record<string, unknown> | undefined;
        msg = (err?.message ?? body.message ?? msg) as string;
      } catch {
        // leave msg as HTTP status
      }
      await recordTest(false, msg);
      return { ok: false, error: msg };
    }

    // Confirm the response has the expected shape (tasks API returns { tasks, total })
    try {
      const body = await res.json() as Record<string, unknown>;
      if (typeof body.total !== "number") {
        const msg = "Unexpected response — connected but body missing 'total'";
        await recordTest(false, msg);
        return { ok: false, error: msg };
      }
    } catch {
      // Body unreadable — still treat as connected (2xx is sufficient)
    }

    await recordTest(true, "OK");
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Network error";
    await recordTest(false, msg);
    return { ok: false, error: msg };
  }
}

export async function createTask(payload: TaskPayload): Promise<CreateResult> {
  const creds = await getCredentials();
  if (!creds) {
    return { ok: false, error: "API key not configured — set it in Settings → Integrations" };
  }

  try {
    const res = await fetch(`${creds.apiBaseUrl}/tasks`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${creds.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try {
        const body = await res.json() as Record<string, unknown>;
        const err = body.error as Record<string, unknown> | undefined;
        msg = (err?.message ?? body.message ?? msg) as string;
      } catch {
        // leave msg as HTTP status
      }
      return { ok: false, error: msg };
    }

    let taskId: string | undefined;
    try {
      const body = await res.json() as Record<string, unknown>;
      taskId = (body.id ?? body.taskId) as string | undefined;
    } catch {
      // response body not required for success
    }
    return { ok: true, taskId };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Network error" };
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
    const res = await fetch(`${creds.apiBaseUrl}/tasks?${params.toString()}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${creds.apiKey}` },
      cache: "no-store",
    });

    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try {
        const body = await res.json() as Record<string, unknown>;
        const err = body.error as Record<string, unknown> | undefined;
        msg = (err?.message ?? body.message ?? msg) as string;
      } catch {
        // leave msg as HTTP status
      }
      return { ok: false, error: msg };
    }

    const body = await res.json() as { tasks: HenleyTask[]; total: number };
    return { ok: true, tasks: body.tasks ?? [], total: body.total ?? 0 };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Network error" };
  }
}

export async function getTask(id: string): Promise<GetTaskResult> {
  const creds = await getCredentials();
  if (!creds) return { ok: false, error: "API key not configured" };

  try {
    const res = await fetch(`${creds.apiBaseUrl}/tasks/${encodeURIComponent(id)}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${creds.apiKey}` },
      cache: "no-store",
    });

    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try {
        const body = await res.json() as Record<string, unknown>;
        const err = body.error as Record<string, unknown> | undefined;
        msg = (err?.message ?? body.message ?? msg) as string;
      } catch {
        // leave msg as HTTP status
      }
      return { ok: false, error: msg };
    }

    const task = await res.json() as HenleyTask;
    return { ok: true, task };
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
