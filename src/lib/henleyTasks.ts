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
    const res = await fetch(`${creds.apiBaseUrl}/ping`, {
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

async function recordTest(ok: boolean, msg: string) {
  await prisma.henleyTasksConfig
    .upsert({
      where: { id: "singleton" },
      update: { lastTestAt: new Date(), lastTestOk: ok, lastTestResult: msg },
      create: { id: "singleton", lastTestAt: new Date(), lastTestOk: ok, lastTestResult: msg },
    })
    .catch(() => {});
}
