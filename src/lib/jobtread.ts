import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * JobTread Pave API client — read-only pull integration.
 *
 * JobTread has a single endpoint (POST https://api.jobtread.com/pave) that
 * speaks the Pave query language: the request body is a JSON tree describing
 * the query, NOT REST. Auth is a grantKey injected inside the query payload:
 *   { "query": { "$": { "grantKey": "..." }, ... } }
 *
 * The grant key lives in the JobTreadConfig singleton (pasted from Settings,
 * never in .env). All queries are scoped to the configured organization.
 *
 * The four board axes (Sales Pipeline / Construction Phase / Warranty Phase /
 * Division) live as JobTread CUSTOM FIELDS on Job. Their field IDs are
 * discovered at connect time by discoverFieldMap() and persisted to
 * JobTreadConfig.fieldMap — never hardcoded.
 *
 * Error handling precedent (Quo/M365 cards): when a query shape fails, the
 * raw error response is surfaced VERBATIM so it can be shown in the
 * test-connection UI — never silently stubbed.
 */

const PAVE_URL = "https://api.jobtread.com/pave";
const TIMEOUT_MS = 15000;

export class JobTreadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JobTreadError";
  }
}

// ── Field map ────────────────────────────────────────────────────────────────

export const FIELD_MAP_AXES = [
  "pipelineStage",
  "constructionPhase",
  "warrantyPhase",
  "division",
] as const;
export type FieldMapAxis = (typeof FIELD_MAP_AXES)[number];

export type JTCustomField = { id: string; name: string };

export type JobTreadFieldMap = {
  pipelineStage: string | null;
  constructionPhase: string | null;
  warrantyPhase: string | null;
  division: string | null;
  /** All discovered Job custom fields — feeds the manual override picker. */
  fields: JTCustomField[];
};

export function parseFieldMap(raw: string | null | undefined): JobTreadFieldMap | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as Partial<JobTreadFieldMap>;
    return {
      pipelineStage: p.pipelineStage ?? null,
      constructionPhase: p.constructionPhase ?? null,
      warrantyPhase: p.warrantyPhase ?? null,
      division: p.division ?? null,
      fields: Array.isArray(p.fields) ? p.fields : [],
    };
  } catch {
    return null;
  }
}

// ── Config ───────────────────────────────────────────────────────────────────

async function readConfig() {
  try {
    return await prisma.jobTreadConfig.findUnique({ where: { id: "singleton" } });
  } catch {
    return null; // table not generated yet
  }
}

export async function isJobTreadConfigured(): Promise<boolean> {
  const row = await readConfig();
  return Boolean(row?.grantKey);
}

// ── Core Pave query ──────────────────────────────────────────────────────────

/**
 * POST a Pave query tree. `body` is the tree WITHOUT the outer {query:} wrapper
 * and without the grantKey — both are injected here. Throws JobTreadError with
 * the raw response text verbatim on any failure.
 */
export async function jtQuery<T = Record<string, unknown>>(
  body: Record<string, unknown>,
  opts?: { grantKey?: string },
): Promise<T> {
  let grantKey = opts?.grantKey;
  if (!grantKey) {
    const row = await readConfig();
    if (!row?.grantKey) throw new JobTreadError("JobTread is not configured");
    grantKey = row.grantKey;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(PAVE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query: { $: { grantKey }, ...body } }),
      signal: controller.signal,
      cache: "no-store",
    });
    const text = await res.text();
    if (!res.ok) {
      // Surface the raw error response verbatim (Quo/M365 card precedent).
      throw new JobTreadError(`Pave HTTP ${res.status}: ${text.slice(0, 2000)}`);
    }
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      throw new JobTreadError(`Pave returned non-JSON response: ${text.slice(0, 2000)}`);
    }
    const errors = (data as { errors?: unknown }).errors;
    if (errors && (!Array.isArray(errors) || errors.length > 0)) {
      throw new JobTreadError(`Pave query error: ${JSON.stringify(errors).slice(0, 2000)}`);
    }
    return data as T;
  } catch (err) {
    if (err instanceof JobTreadError) throw err;
    throw new JobTreadError(err instanceof Error ? err.message : "JobTread request failed");
  } finally {
    clearTimeout(timer);
  }
}

/** Convenience: query scoped to the configured organization. Returns the org subtree. */
export async function jtOrgQuery<T = Record<string, unknown>>(
  orgBody: Record<string, unknown>,
  opts?: { grantKey?: string; organizationId?: string },
): Promise<T> {
  let organizationId = opts?.organizationId;
  if (!organizationId) {
    const row = await readConfig();
    organizationId = row?.organizationId || "22PVYxTzwCLW";
  }
  const data = await jtQuery<{ organization?: T }>(
    { organization: { $: { id: organizationId }, ...orgBody } },
    { grantKey: opts?.grantKey },
  );
  if (!data.organization) {
    throw new JobTreadError(`Pave response missing organization subtree: ${JSON.stringify(data).slice(0, 500)}`);
  }
  return data.organization;
}

/**
 * Page through a Pave connection under organization. `connection` is the key
 * (e.g. "jobs"), `nodeShape` the fields per node. Handles size+nextPage cursors.
 */
export async function jtOrgListAll<TNode>(
  connection: string,
  nodeShape: Record<string, unknown>,
  opts?: {
    where?: unknown;
    size?: number;
    grantKey?: string;
    organizationId?: string;
    maxPages?: number;
  },
): Promise<TNode[]> {
  const size = opts?.size ?? 100;
  const maxPages = opts?.maxPages ?? 50;
  const nodes: TNode[] = [];
  let page: string | undefined;
  for (let i = 0; i < maxPages; i++) {
    const $: Record<string, unknown> = { size };
    if (opts?.where !== undefined) $.where = opts.where;
    if (page) $.page = page;
    const org = await jtOrgQuery<Record<string, { nodes?: TNode[]; nextPage?: string | null }>>(
      { [connection]: { $, nextPage: {}, nodes: nodeShape } },
      { grantKey: opts?.grantKey, organizationId: opts?.organizationId },
    );
    const conn = org[connection];
    if (!conn) throw new JobTreadError(`Pave response missing "${connection}" connection`);
    nodes.push(...(conn.nodes ?? []));
    if (!conn.nextPage || (conn.nodes ?? []).length < size) break;
    page = conn.nextPage;
  }
  return nodes;
}

// ── Test connection ──────────────────────────────────────────────────────────

async function recordTest(ok: boolean, msg: string) {
  try {
    await prisma.jobTreadConfig.update({
      where: { id: "singleton" },
      data: { lastTestAt: new Date(), lastTestOk: ok, lastTestResult: msg.slice(0, 2000) },
    });
  } catch {
    // best-effort
  }
}

export type JobTreadTestResult =
  | { ok: true; orgName: string; jobCount: number }
  | { ok: false; error: string };

/**
 * Live test: fetch org name and count jobs (paged; no reliance on a Pave
 * count field). Records the result on the singleton.
 */
export async function testJobTreadConnection(opts?: {
  grantKey?: string;
  organizationId?: string;
}): Promise<JobTreadTestResult> {
  try {
    const org = await jtOrgQuery<{ id: string; name: string }>(
      { id: {}, name: {} },
      opts,
    );
    const jobs = await jtOrgListAll<{ id: string }>("jobs", { id: {} }, opts);
    const msg = `Connected to ${org.name} — ${jobs.length} jobs`;
    await recordTest(true, msg);
    return { ok: true, orgName: org.name, jobCount: jobs.length };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "JobTread test failed";
    await recordTest(false, msg);
    return { ok: false, error: msg };
  }
}

// ── Custom-field discovery ───────────────────────────────────────────────────

/**
 * Discover the Job custom fields backing the four board axes by name and
 * persist the mapping to JobTreadConfig.fieldMap. Matching (case-insensitive):
 *   contains "construction"        → constructionPhase
 *   contains "warranty"            → warrantyPhase
 *   contains "division"            → division
 *   contains "pipeline" (else fallback "sales") → pipelineStage
 * A field is assigned to at most one axis (most specific first). Unmatched
 * axes stay null — the Settings card offers a manual override picker.
 */
export async function discoverFieldMap(opts?: {
  grantKey?: string;
  organizationId?: string;
}): Promise<JobTreadFieldMap> {
  type CF = { id: string; name: string; targetType?: string };
  const all = await jtOrgListAll<CF>(
    "customFields",
    { id: {}, name: {}, targetType: {} },
    opts,
  );
  // Keep only Job-targeted fields (targetType value casing per API, e.g. "job").
  const jobFields = all.filter((f) => String(f.targetType ?? "").toLowerCase().includes("job"));
  const pool = jobFields.length > 0 ? jobFields : all;

  const map: JobTreadFieldMap = {
    pipelineStage: null,
    constructionPhase: null,
    warrantyPhase: null,
    division: null,
    fields: pool.map((f) => ({ id: f.id, name: f.name })),
  };

  const taken = new Set<string>();
  const assign = (axis: FieldMapAxis, test: (n: string) => boolean) => {
    for (const f of pool) {
      if (taken.has(f.id)) continue;
      if (test(f.name.toLowerCase())) {
        map[axis] = f.id;
        taken.add(f.id);
        return;
      }
    }
  };
  assign("constructionPhase", (n) => n.includes("construction"));
  assign("warrantyPhase", (n) => n.includes("warranty"));
  assign("division", (n) => n.includes("division"));
  // "pipeline" first so e.g. "Sales Rep" can't shadow "Sales Pipeline";
  // bare "sales" only as a fallback when no pipeline-named field exists.
  assign("pipelineStage", (n) => n.includes("pipeline"));
  if (!map.pipelineStage) assign("pipelineStage", (n) => n.includes("sales"));

  try {
    await prisma.jobTreadConfig.update({
      where: { id: "singleton" },
      data: { fieldMap: JSON.stringify(map) },
    });
  } catch {
    // best-effort; caller may be testing with an unsaved key
  }
  return map;
}

// ── Live to-dos (display-only — never persisted; Henley Tasks is the master) ─

export type JTTodo = {
  id: string;
  name: string;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  progress: number | null;
  jobId: string | null;
  jobName: string | null;
  typeName: string | null;
  assignees: string[];
};

const TODO_NODE_SHAPE = {
  id: {},
  name: {},
  description: {},
  startDate: {},
  endDate: {},
  progress: {},
  job: { id: {}, name: {} },
  taskType: { name: {} },
  taskAssignments: { nodes: { id: {}, membership: { user: { name: {} } } } },
};

type JTTaskNode = {
  id: string;
  name: string;
  description?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  progress?: number | null;
  job?: { id: string; name: string } | null;
  taskType?: { name: string } | null;
  taskAssignments?: { nodes?: { membership?: { user?: { name?: string } | null } | null }[] };
};

function toTodo(t: JTTaskNode): JTTodo {
  return {
    id: t.id,
    name: t.name,
    description: t.description ?? null,
    startDate: t.startDate ?? null,
    endDate: t.endDate ?? null,
    progress: t.progress ?? null,
    jobId: t.job?.id ?? null,
    jobName: t.job?.name ?? null,
    typeName: t.taskType?.name ?? null,
    assignees: (t.taskAssignments?.nodes ?? [])
      .map((a) => a.membership?.user?.name)
      .filter((n): n is string => Boolean(n)),
  };
}

// Pave returns HTTP 413 for large pages of nested-connection shapes; 25 is
// the verified safe page size for the to-do shape.
const TODO_PAGE_SIZE = 25;

/** All open to-dos in the org (progress incomplete), fetched live. */
export async function fetchOpenJobTreadTodos(): Promise<JTTodo[]> {
  const nodes = await jtOrgListAll<JTTaskNode>("tasks", TODO_NODE_SHAPE, {
    where: ["isToDo", "=", true],
    size: TODO_PAGE_SIZE,
  });
  return nodes.map(toTodo).filter((t) => (t.progress ?? 0) < 1);
}

/** Open to-dos for one JobTread job, fetched live (nested where on job.id). */
export async function fetchJobTodos(jobtreadJobId: string): Promise<JTTodo[]> {
  const nodes = await jtOrgListAll<JTTaskNode>("tasks", TODO_NODE_SHAPE, {
    where: { and: [["isToDo", "=", true], [["job", "id"], jobtreadJobId]] },
    size: TODO_PAGE_SIZE,
  });
  return nodes.map(toTodo).filter((t) => (t.progress ?? 0) < 1);
}

export function jobTreadJobUrl(jobtreadJobId: string): string {
  return `https://app.jobtread.com/jobs/${jobtreadJobId}`;
}
