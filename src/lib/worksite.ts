import "server-only";

export class WorksiteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorksiteError";
  }
}

export type WorksitePing = {
  ok: boolean;
  enums: { status: string[]; priority: string[] };
};

export type WorksiteUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  title: string;
};

export type WorksiteTask = {
  id: string;
  title: string;
  desc: string;
  projectId: string | null;
  assignerId: string;
  assignees: string[];
  priority: string;
  status: string;
  due: string | null;
  est: number;
  created: number;
  updatedBy: string | null;
  updatedMs: number;
  lastAction: string | null;
};

export async function worksiteCall<T>(action: string, payload: object = {}): Promise<T> {
  const url = process.env.WORKSITE_API_URL;
  const key = process.env.WORKSITE_API_KEY;
  if (!url || !key) throw new WorksiteError("Worksite API is not configured");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Api-Key": key },
      body: JSON.stringify({ action, ...payload }),
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) throw new WorksiteError(`Worksite returned HTTP ${res.status}`);
    const data = (await res.json()) as { ok?: boolean; error?: string } & T;
    if (!data || data.ok === false) {
      throw new WorksiteError(String(data?.error ?? "Unknown Worksite error"));
    }
    return data;
  } catch (err) {
    if (err instanceof WorksiteError) throw err;
    throw new WorksiteError(err instanceof Error ? err.message : "Worksite unreachable");
  } finally {
    clearTimeout(timer);
  }
}

export function worksitePing(): Promise<WorksitePing> {
  return worksiteCall<WorksitePing>("ping");
}

export async function worksiteListUsers(): Promise<WorksiteUser[]> {
  const r = await worksiteCall<{ users: WorksiteUser[] }>("user.list");
  return r.users ?? [];
}

export async function worksiteListTasks(filters?: {
  projectId?: string;
  status?: string;
  since?: number;
}): Promise<WorksiteTask[]> {
  const r = await worksiteCall<{ tasks: WorksiteTask[] }>("task.list", filters ?? {});
  return r.tasks ?? [];
}

export async function worksiteCreateTask(input: {
  title: string;
  desc?: string;
  projectId?: string;
  assigneeIds: string[];
  priority: string;
  due?: string;
  creatorEmail: string;
}): Promise<WorksiteTask> {
  const r = await worksiteCall<{ task: WorksiteTask }>("task.create", input);
  return r.task;
}
