import "server-only";
import { prisma } from "@/lib/prisma";
import { canViewAllProjects, type Role } from "@/lib/roles";
import {
  GROUP_AXES,
  isAxis,
} from "@/lib/jobBoard";
import { isValidLeadSource } from "@/lib/taxonomy";
import { listTasks, createTask as createHenleyTask } from "@/lib/henleyTasks";

/**
 * Assistant tool layer. Every tool executes through the same authorization
 * the UI uses — scoped by the SIGNED-IN user's role and assignments, never
 * wider. The tool list itself is filtered per role before the model sees it,
 * and every executor re-checks server-side regardless of what was asked.
 *
 * NAMING MAP: UI "Project" = Engagement model; UI "Job" = Project model.
 *
 * Write tools are confirm-gated by the route: the model's call becomes a
 * proposal; execution happens only after the user clicks confirm, and lands
 * in AuditLog (action prefix "assistant.").
 *
 * Deliberately excluded (human-only): QBO push, time approval, settings/team
 * mutations, API-key management.
 */

export type ToolCtx = {
  userId: string;
  userName: string;
  role: Role;
  clientId: string | null;
};

type JSONSchema = Record<string, unknown>;

export type ToolDef = {
  name: string;
  description: string;
  input_schema: JSONSchema;
  roles: Role[];
  write: boolean;
  proposal?: (input: Record<string, unknown>) => string;
  execute: (ctx: ToolCtx, input: Record<string, unknown>) => Promise<unknown>;
};

const ALL: Role[] = ["CEO", "OFFICE", "FIELD", "SUB", "CLIENT"];
const OFFICE: Role[] = ["CEO", "OFFICE"];
const INTERNAL: Role[] = ["CEO", "OFFICE", "FIELD"];

// Job visibility mirror of the board/projects pages.
function jobsWhere(ctx: ToolCtx) {
  if (canViewAllProjects(ctx.role)) return { archivedAt: null };
  if (ctx.role === "CLIENT" && ctx.clientId) return { archivedAt: null, clientId: ctx.clientId };
  return { archivedAt: null, assignments: { some: { userId: ctx.userId } } };
}

const s = (v: unknown) => (typeof v === "string" ? v.trim() : "");

function jobSummary(p: {
  id: string;
  name: string;
  code: string | null;
  status: string;
  pipelineStage: string | null;
  constructionPhase: string | null;
  warrantyPhase: string | null;
  address: string | null;
  client?: { name: string } | null;
}) {
  return {
    id: p.id,
    name: p.name,
    number: p.code,
    status: p.status,
    pipelineStage: p.pipelineStage,
    constructionPhase: p.constructionPhase,
    warrantyPhase: p.warrantyPhase,
    address: p.address,
    client: p.client?.name ?? null,
    link: `/jobs/${p.id}`,
  };
}

export const TOOLS: ToolDef[] = [
  // ── READ ────────────────────────────────────────────────────────────────
  {
    name: "search_jobs",
    description:
      "Search jobs (the operational unit; DB model Project) by name, number or client name. Returns summaries with cockpit links.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Text to match against job name, number, client" },
        status: { type: "string", description: "Optional status filter: OPEN|PRESALE|WARRANTY|CLOSED|GENERAL" },
      },
    },
    roles: ALL,
    write: false,
    async execute(ctx, input) {
      const q = s(input.query).toLowerCase();
      const status = s(input.status).toUpperCase();
      const rows = await prisma.project.findMany({
        where: { ...jobsWhere(ctx), ...(status ? { status } : {}) },
        include: { client: { select: { name: true } } },
        orderBy: { updatedAt: "desc" },
        take: 200,
      });
      const hits = rows.filter(
        (p) =>
          !q ||
          p.name.toLowerCase().includes(q) ||
          (p.code ?? "").toLowerCase().includes(q) ||
          p.client.name.toLowerCase().includes(q),
      );
      return { count: hits.length, jobs: hits.slice(0, 20).map(jobSummary) };
    },
  },
  {
    name: "get_job",
    description: "Get one job by id: fields, money summary (role-permitting), recent daily logs.",
    input_schema: {
      type: "object",
      properties: { jobId: { type: "string" } },
      required: ["jobId"],
    },
    roles: ALL,
    write: false,
    async execute(ctx, input) {
      const p = await prisma.project.findFirst({
        where: { id: s(input.jobId), ...jobsWhere(ctx) },
        include: {
          client: { select: { name: true } },
          engagement: { select: { id: true, name: true } },
          dailyLogs: { orderBy: { date: "desc" }, take: 5, select: { date: true, notes: true, clientVisible: true } },
        },
      });
      if (!p) return { error: "Job not found or not visible to you" };
      const logs =
        ctx.role === "CLIENT" ? p.dailyLogs.filter((l) => l.clientVisible) : p.dailyLogs;
      const money =
        ctx.role === "CEO" || ctx.role === "OFFICE"
          ? { contractCents: p.contractCents, budgetCents: p.budgetCents }
          : undefined;
      return {
        ...jobSummary(p),
        uiProject: p.engagement ? { name: p.engagement.name, link: `/jobs/projects/${p.engagement.id}` } : null,
        ...money,
        recentLogs: logs.map((l) => ({ date: l.date.toISOString().slice(0, 10), notes: l.notes.slice(0, 300) })),
      };
    },
  },
  {
    name: "list_ui_projects",
    description: 'List UI "Projects" (client engagements that group jobs; DB model Engagement).',
    input_schema: { type: "object", properties: {} },
    roles: OFFICE,
    write: false,
    async execute() {
      const rows = await prisma.engagement.findMany({
        orderBy: { updatedAt: "desc" },
        include: { client: { select: { name: true } }, jobs: { select: { id: true } } },
        take: 50,
      });
      return rows.map((e) => ({
        id: e.id,
        name: e.name,
        client: e.client.name,
        status: e.status,
        jobCount: e.jobs.length,
        link: `/jobs/projects/${e.id}`,
      }));
    },
  },
  {
    name: "search_clients",
    description: "Search CRM clients by name/email/phone. Office roles only.",
    input_schema: {
      type: "object",
      properties: { query: { type: "string" } },
      required: ["query"],
    },
    roles: OFFICE,
    write: false,
    async execute(_ctx, input) {
      const q = s(input.query);
      const rows = await prisma.client.findMany({
        where: {
          OR: [
            { name: { contains: q } },
            { primaryEmail: { contains: q } },
            { primaryPhone: { contains: q } },
          ],
        },
        take: 15,
        select: { id: true, name: true, primaryEmail: true, primaryPhone: true, stage: true },
      });
      return rows.map((c) => ({ ...c, link: `/clients/${c.id}` }));
    },
  },
  {
    name: "search_estimates",
    description: "List estimates, optionally by status (DRAFT|SENT|ACCEPTED|DECLINED). Office roles only.",
    input_schema: { type: "object", properties: { status: { type: "string" } } },
    roles: OFFICE,
    write: false,
    async execute(_ctx, input) {
      const status = s(input.status).toUpperCase();
      const rows = await prisma.estimate.findMany({
        where: status ? { status } : {},
        orderBy: { updatedAt: "desc" },
        take: 20,
        include: { client: { select: { name: true } } },
      });
      return rows.map((e) => ({
        id: e.id,
        number: e.number,
        title: e.title,
        client: e.client.name,
        status: e.status,
        totalCents: e.totalCents,
        link: `/estimates/${e.id}`,
      }));
    },
  },
  {
    name: "list_contracts",
    description: "List contracts, optionally by status (DRAFT|SENT|SIGNED|DEPOSIT_PAID|VOID). Office roles only.",
    input_schema: { type: "object", properties: { status: { type: "string" } } },
    roles: OFFICE,
    write: false,
    async execute(_ctx, input) {
      const status = s(input.status).toUpperCase();
      const rows = await prisma.contract.findMany({
        where: status ? { status } : {},
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { client: { select: { name: true } }, project: { select: { name: true } } },
      });
      return rows.map((c) => ({
        id: c.id,
        number: c.number,
        title: c.title,
        client: c.client.name,
        job: c.project?.name ?? null,
        status: c.status,
        totalCents: c.totalCents,
        link: `/contracts/${c.id}`,
      }));
    },
  },
  {
    name: "search_vendors",
    description: "Search vendors by name or trade, with W-9/COI compliance flags. Office roles only.",
    input_schema: { type: "object", properties: { query: { type: "string" } } },
    roles: OFFICE,
    write: false,
    async execute(_ctx, input) {
      const q = s(input.query).toLowerCase();
      const rows = await prisma.vendor.findMany({
        where: { archivedAt: null },
        orderBy: { name: "asc" },
        take: 400,
      });
      const hits = rows.filter(
        (v) => !q || v.name.toLowerCase().includes(q) || (v.trade ?? "").toLowerCase().includes(q),
      );
      return {
        count: hits.length,
        vendors: hits.slice(0, 20).map((v) => ({
          id: v.id,
          name: v.name,
          trade: v.trade,
          email: v.email,
          phone: v.officePhone,
          w9OnFile: v.w9OnFile,
          coiExpiresAt: v.coiExpiresAt?.toISOString().slice(0, 10) ?? null,
        })),
      };
    },
  },
  {
    name: "get_dashboard_stats",
    description: "Org-level dashboard aggregates (KPIs, phase/status counts, compliance). Office roles only.",
    input_schema: { type: "object", properties: {} },
    roles: OFFICE,
    write: false,
    async execute() {
      const { getDashboardAnalytics } = await import("@/lib/services/dashboardService");
      const a = await getDashboardAnalytics();
      return {
        kpis: a.kpis,
        byStatus: a.byStatus,
        byConstructionPhase: a.byConstructionPhase,
        vendorCompliance: a.vendorCompliance,
        comparison: a.comparison,
      };
    },
  },
  {
    name: "list_daily_logs",
    description: "Recent daily logs for a job (clients see only client-visible logs).",
    input_schema: {
      type: "object",
      properties: { jobId: { type: "string" } },
      required: ["jobId"],
    },
    roles: ALL,
    write: false,
    async execute(ctx, input) {
      const p = await prisma.project.findFirst({
        where: { id: s(input.jobId), ...jobsWhere(ctx) },
        select: { id: true },
      });
      if (!p) return { error: "Job not found or not visible to you" };
      const logs = await prisma.dailyLog.findMany({
        where: { projectId: p.id, ...(ctx.role === "CLIENT" ? { clientVisible: true } : {}) },
        orderBy: { date: "desc" },
        take: 10,
        include: { author: { select: { name: true } } },
      });
      return logs.map((l) => ({
        date: l.date.toISOString().slice(0, 10),
        author: l.author.name,
        notes: l.notes.slice(0, 400),
        clientVisible: l.clientVisible,
      }));
    },
  },
  {
    name: "list_henley_tasks",
    description: "Live Henley Tasks (the task master) — open tasks, optionally filtered by text.",
    input_schema: { type: "object", properties: { query: { type: "string" } } },
    roles: INTERNAL,
    write: false,
    async execute(_ctx, input) {
      const res = await listTasks({ q: s(input.query) || undefined, limit: 25 });
      if (!res.ok) return { error: `Henley Tasks unavailable: ${res.error}` };
      return res.tasks.map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        due: t.due_date ?? null,
        assignee: t.assignee ?? null,
      }));
    },
  },
  {
    name: "search_catalog",
    description: "Search catalog cost items (name/description) with prices in cents. Office roles only.",
    input_schema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
    roles: OFFICE,
    write: false,
    async execute(_ctx, input) {
      const q = s(input.query);
      const rows = await prisma.costItem.findMany({
        where: {
          active: true,
          OR: [{ name: { contains: q } }, { description: { contains: q } }],
        },
        take: 15,
        include: { costCode: { select: { number: true } } },
      });
      return rows.map((i) => ({
        id: i.id,
        name: i.name,
        code: i.costCode?.number ?? null,
        unit: i.unit,
        unitPriceCents: i.unitPriceCents,
      }));
    },
  },

  // ── WRITE (confirm-gated by the route) ──────────────────────────────────
  {
    name: "create_client",
    description: "Create a new CRM client/lead. Office roles only.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string" },
        email: { type: "string" },
        phone: { type: "string" },
        leadSource: { type: "string", description: "Optional canonical lead source" },
      },
      required: ["name"],
    },
    roles: OFFICE,
    write: true,
    proposal: (i) => `Create new lead "${s(i.name)}"${s(i.email) ? ` · ${s(i.email)}` : ""}`,
    async execute(_ctx, input) {
      const name = s(input.name);
      if (!name) return { error: "Name is required" };
      const leadSource = s(input.leadSource);
      const c = await prisma.client.create({
        data: {
          name,
          primaryEmail: s(input.email) || null,
          primaryPhone: s(input.phone) || null,
          leadSource: leadSource && isValidLeadSource(leadSource) ? leadSource : null,
        },
      });
      return { created: true, id: c.id, link: `/clients/${c.id}` };
    },
  },
  {
    name: "create_job",
    description: "Create a new job (DB Project) for an existing client. Office roles only.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string" },
        clientId: { type: "string" },
        address: { type: "string" },
        status: { type: "string", description: "OPEN|PRESALE (default PRESALE)" },
      },
      required: ["name", "clientId"],
    },
    roles: OFFICE,
    write: true,
    proposal: (i) => `Create job "${s(i.name)}" for client ${s(i.clientId)}`,
    async execute(_ctx, input) {
      const name = s(input.name);
      const clientId = s(input.clientId);
      const client = await prisma.client.findUnique({ where: { id: clientId } });
      if (!name || !client) return { error: "Valid name and existing clientId required" };
      const status = s(input.status).toUpperCase() === "OPEN" ? "OPEN" : "PRESALE";
      const p = await prisma.project.create({
        data: { name, clientId, address: s(input.address) || null, status },
      });
      return { created: true, id: p.id, link: `/jobs/${p.id}` };
    },
  },
  {
    name: "create_ui_project",
    description: 'Create a UI "Project" (Engagement grouping jobs) for a client. Office roles only.',
    input_schema: {
      type: "object",
      properties: { name: { type: "string" }, clientId: { type: "string" } },
      required: ["name", "clientId"],
    },
    roles: OFFICE,
    write: true,
    proposal: (i) => `Create project (engagement) "${s(i.name)}"`,
    async execute(_ctx, input) {
      const name = s(input.name);
      const clientId = s(input.clientId);
      if (!name || !(await prisma.client.findUnique({ where: { id: clientId } }))) {
        return { error: "Valid name and existing clientId required" };
      }
      const e = await prisma.engagement.create({ data: { name, clientId } });
      return { created: true, id: e.id, link: `/jobs/projects/${e.id}` };
    },
  },
  {
    name: "add_daily_log",
    description: "Add a daily log to a job you can see (internal roles). Not client-visible by default.",
    input_schema: {
      type: "object",
      properties: { jobId: { type: "string" }, notes: { type: "string" } },
      required: ["jobId", "notes"],
    },
    roles: INTERNAL,
    write: true,
    proposal: (i) => `Add a daily log to job ${s(i.jobId)}: "${s(i.notes).slice(0, 120)}"`,
    async execute(ctx, input) {
      const notes = s(input.notes);
      if (!notes) return { error: "Notes required" };
      const p = await prisma.project.findFirst({
        where: { id: s(input.jobId), ...jobsWhere(ctx) },
        select: { id: true },
      });
      if (!p) return { error: "Job not found or not visible to you" };
      const log = await prisma.dailyLog.create({
        data: { projectId: p.id, authorId: ctx.userId, notes, clientVisible: false },
      });
      return { created: true, id: log.id, link: `/projects/${p.id}` };
    },
  },
  {
    name: "move_job_stage",
    description:
      "Move a job on one board axis (pipelineStage|constructionPhase|warrantyPhase|division|status) to a canonical value, or null to clear. Office roles only.",
    input_schema: {
      type: "object",
      properties: {
        jobId: { type: "string" },
        axis: { type: "string" },
        value: { type: "string", description: "Canonical value, or empty string to clear" },
      },
      required: ["jobId", "axis"],
    },
    roles: OFFICE,
    write: true,
    proposal: (i) => `Move job ${s(i.jobId)} · ${s(i.axis)} → ${s(i.value) || "(cleared)"}`,
    async execute(ctx, input) {
      const axis = s(input.axis);
      const value = s(input.value) || null;
      if (!isAxis(axis)) return { error: `Unknown axis "${axis}"` };
      if (axis === "status" && value === null) return { error: "Status cannot be cleared" };
      if (value !== null && !(GROUP_AXES[axis] as readonly string[]).includes(value)) {
        return { error: `"${value}" is not a canonical ${axis} value` };
      }
      const p = await prisma.project.findFirst({
        where: { id: s(input.jobId), ...jobsWhere(ctx) },
        select: { id: true },
      });
      if (!p) return { error: "Job not found or not visible to you" };
      await prisma.project.update({ where: { id: p.id }, data: { [axis]: value } });
      return { updated: true, link: `/jobs/${p.id}` };
    },
  },
  {
    name: "create_henley_task",
    description: "Create a task in Henley Tasks (the task master). Internal roles.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        dueDate: { type: "string", description: "ISO date, optional" },
        priority: { type: "string", description: "low|medium|high, optional" },
      },
      required: ["title"],
    },
    roles: INTERNAL,
    write: true,
    proposal: (i) => `Create Henley Task "${s(i.title)}"${s(i.dueDate) ? ` due ${s(i.dueDate)}` : ""}`,
    async execute(_ctx, input) {
      const title = s(input.title);
      if (!title) return { error: "Title required" };
      const priority = ["low", "medium", "high"].includes(s(input.priority))
        ? (s(input.priority) as "low" | "medium" | "high")
        : undefined;
      const res = await createHenleyTask({
        title,
        dueDate: s(input.dueDate) || undefined,
        priority,
      });
      if (!res.ok) return { error: res.error };
      return { created: true, taskId: res.taskId ?? null, link: "/tasks" };
    },
  },
  {
    name: "draft_estimate",
    description: "Create an empty DRAFT estimate for a client (lines added in the UI). Office roles only.",
    input_schema: {
      type: "object",
      properties: { clientId: { type: "string" }, title: { type: "string" } },
      required: ["clientId", "title"],
    },
    roles: OFFICE,
    write: true,
    proposal: (i) => `Draft estimate "${s(i.title)}" for client ${s(i.clientId)}`,
    async execute(ctx, input) {
      const { createEstimate } = await import("@/lib/services/estimateService");
      try {
        const e = await createEstimate({
          clientId: s(input.clientId),
          authorId: ctx.userId,
          title: s(input.title),
          lines: [],
        });
        return { created: true, id: e.id, number: e.number, link: `/estimates/${e.id}` };
      } catch (err) {
        return { error: err instanceof Error ? err.message : "Could not create estimate" };
      }
    },
  },
];

export function toolsForRole(role: Role): ToolDef[] {
  return TOOLS.filter((t) => t.roles.includes(role));
}

export function anthropicToolParam(role: Role) {
  return toolsForRole(role).map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema,
  }));
}
