import "server-only";
import { prisma } from "@/lib/prisma";
import {
  PIPELINE_STAGE,
  CONSTRUCTION_PHASE,
  WARRANTY_PHASE,
  JOB_STATUS,
  DIVISION,
} from "@/lib/taxonomy";
import { listTasks } from "@/lib/henleyTasks";

/**
 * One-pass aggregates for the CEO/Office dashboard. Every number is derived
 * from real rows; nothing is invented. Naming map: UI "Job" = Project model,
 * UI "Project" = Engagement model.
 */

const OPEN_STATUSES = ["OPEN", "WARRANTY", "PRESALE"];

export type StageValue = { label: string; valueCents: number; count: number };
export type CountSlice = { label: string; count: number };
export type WeekPoint = { week: string; logs: number; estimates: number };
export type ComparisonRow = { metric: string; thisMonth: number; lastMonth: number };
export type TasksSnapshot =
  | { ok: true; open: number; dueToday: number; overdue: number }
  | { ok: false };

export type DashboardAnalytics = {
  kpis: {
    activeClients: number;
    totalClients: number;
    jobsInFlight: number;
    openPipelineCents: number;
    clockedInNow: number;
  };
  pipelineByStage: StageValue[];
  unstagedPipelineCents: number;
  byConstructionPhase: CountSlice[];
  byStatus: CountSlice[];
  byDivision: CountSlice[];
  warrantyByPhase: CountSlice[];
  activityTrend: WeekPoint[];
  vendorCompliance: { missingW9: number; expiringSoon: number; expired: number };
  tasks: TasksSnapshot;
  comparison: ComparisonRow[];
};

function weekKey(d: Date): string {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  const day = copy.getDay();
  copy.setDate(copy.getDate() + (day === 0 ? -6 : 1 - day));
  return copy.toISOString().slice(0, 10);
}

export async function getDashboardAnalytics(): Promise<DashboardAnalytics> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const eightWeeksAgo = new Date(now);
  eightWeeksAgo.setDate(now.getDate() - 7 * 8);
  const in30 = new Date(now);
  in30.setDate(now.getDate() + 30);

  const [
    totalClients,
    activeClientRows,
    jobsInFlight,
    pipelineAgg,
    clockedInNow,
    jobGroups,
    openEstimates,
    stagedJobs,
    trendLogs,
    trendEstimates,
    vendorsAll,
    cmpClients,
    cmpEstimatesCreated,
    cmpEstimatesAccepted,
    cmpLogs,
    cmpComplete,
  ] = await Promise.all([
    prisma.client.count(),
    prisma.client.findMany({
      where: { projects: { some: { status: { not: "CLOSED" }, archivedAt: null } } },
      select: { id: true },
    }),
    prisma.project.count({ where: { status: { in: OPEN_STATUSES }, archivedAt: null } }),
    prisma.estimate.aggregate({
      _sum: { totalCents: true },
      where: { status: { in: ["DRAFT", "SENT"] } },
    }),
    prisma.timeEntry.count({ where: { clockOut: null } }),
    prisma.project.groupBy({
      by: ["status", "constructionPhase", "warrantyPhase", "division", "pipelineStage"],
      where: { archivedAt: null },
      _count: { _all: true },
    }),
    prisma.estimate.findMany({
      where: { status: { in: ["DRAFT", "SENT"] } },
      select: { clientId: true, totalCents: true },
    }),
    prisma.project.findMany({
      where: { pipelineStage: { not: null }, archivedAt: null },
      select: { clientId: true, pipelineStage: true },
    }),
    prisma.dailyLog.findMany({
      where: { createdAt: { gte: eightWeeksAgo } },
      select: { createdAt: true },
    }),
    prisma.estimate.findMany({
      where: { createdAt: { gte: eightWeeksAgo } },
      select: { createdAt: true },
    }),
    prisma.vendor.findMany({
      where: { archivedAt: null },
      select: { w9OnFile: true, coiExpiresAt: true },
    }),
    Promise.all([
      prisma.client.count({ where: { createdAt: { gte: monthStart } } }),
      prisma.client.count({ where: { createdAt: { gte: lastMonthStart, lt: monthStart } } }),
    ]),
    Promise.all([
      prisma.estimate.count({ where: { createdAt: { gte: monthStart } } }),
      prisma.estimate.count({ where: { createdAt: { gte: lastMonthStart, lt: monthStart } } }),
    ]),
    Promise.all([
      prisma.estimate.count({ where: { status: "ACCEPTED", updatedAt: { gte: monthStart } } }),
      prisma.estimate.count({
        where: { status: "ACCEPTED", updatedAt: { gte: lastMonthStart, lt: monthStart } },
      }),
    ]),
    Promise.all([
      prisma.dailyLog.count({ where: { createdAt: { gte: monthStart } } }),
      prisma.dailyLog.count({ where: { createdAt: { gte: lastMonthStart, lt: monthStart } } }),
    ]),
    Promise.all([
      prisma.project.count({
        where: { constructionPhase: "Complete", updatedAt: { gte: monthStart } },
      }),
      prisma.project.count({
        where: { constructionPhase: "Complete", updatedAt: { gte: lastMonthStart, lt: monthStart } },
      }),
    ]),
  ]);

  // Slice helpers over the single job groupBy result.
  const sum = (pick: (g: (typeof jobGroups)[number]) => string | null | undefined) => {
    const map = new Map<string, number>();
    for (const g of jobGroups) {
      const k = pick(g);
      if (!k) continue;
      map.set(k, (map.get(k) ?? 0) + g._count._all);
    }
    return map;
  };
  const phaseMap = sum((g) => g.constructionPhase);
  const statusMap = sum((g) => g.status);
  const divisionMap = sum((g) => g.division);
  const warrantyMap = sum((g) => g.warrantyPhase);
  const stageCountMap = sum((g) => g.pipelineStage);

  // Pipeline $ by stage: open (draft+sent) estimate totals attributed via the
  // client's staged jobs. A client with several staged jobs attributes to its
  // most-advanced stage; estimates with no staged client job land in
  // "Unstaged" — attribution rule is shown in the panel hint.
  const clientStage = new Map<string, number>();
  for (const j of stagedJobs) {
    const idx = PIPELINE_STAGE.indexOf(j.pipelineStage as (typeof PIPELINE_STAGE)[number]);
    if (idx < 0) continue;
    const cur = clientStage.get(j.clientId);
    if (cur === undefined || idx > cur) clientStage.set(j.clientId, idx);
  }
  const stageValue = new Array(PIPELINE_STAGE.length).fill(0);
  let unstagedPipelineCents = 0;
  for (const e of openEstimates) {
    const idx = clientStage.get(e.clientId);
    if (idx === undefined) unstagedPipelineCents += e.totalCents;
    else stageValue[idx] += e.totalCents;
  }

  const trend = new Map<string, { logs: number; estimates: number }>();
  for (let i = 7; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - 7 * i);
    trend.set(weekKey(d), { logs: 0, estimates: 0 });
  }
  for (const l of trendLogs) {
    const k = weekKey(l.createdAt);
    const b = trend.get(k);
    if (b) b.logs++;
  }
  for (const e of trendEstimates) {
    const k = weekKey(e.createdAt);
    const b = trend.get(k);
    if (b) b.estimates++;
  }

  const vendorCompliance = {
    missingW9: vendorsAll.filter((v) => !v.w9OnFile).length,
    expired: vendorsAll.filter((v) => v.coiExpiresAt && v.coiExpiresAt < now).length,
    expiringSoon: vendorsAll.filter(
      (v) => v.coiExpiresAt && v.coiExpiresAt >= now && v.coiExpiresAt <= in30,
    ).length,
  };

  // Live Henley Tasks metrics — graceful unavailable state, nothing cached.
  let tasks: TasksSnapshot = { ok: false };
  try {
    const res = await listTasks({ limit: 200 });
    if (res.ok) {
      const today = now.toISOString().slice(0, 10);
      const openTasks = res.tasks.filter((t) => t.status !== "done");
      tasks = {
        ok: true,
        open: openTasks.length,
        dueToday: openTasks.filter((t) => t.due_date === today).length,
        overdue: openTasks.filter((t) => t.due_date && t.due_date < today).length,
      };
    }
  } catch {
    tasks = { ok: false };
  }

  return {
    kpis: {
      activeClients: activeClientRows.length,
      totalClients,
      jobsInFlight,
      openPipelineCents: pipelineAgg._sum.totalCents ?? 0,
      clockedInNow,
    },
    pipelineByStage: PIPELINE_STAGE.map((label, i) => ({
      label,
      valueCents: stageValue[i],
      count: stageCountMap.get(label) ?? 0,
    })),
    unstagedPipelineCents,
    byConstructionPhase: CONSTRUCTION_PHASE.map((label) => ({
      label,
      count: phaseMap.get(label) ?? 0,
    })),
    byStatus: JOB_STATUS.map((label) => ({ label, count: statusMap.get(label) ?? 0 })),
    byDivision: DIVISION.map((label) => ({ label, count: divisionMap.get(label) ?? 0 })),
    warrantyByPhase: WARRANTY_PHASE.map((label) => ({
      label,
      count: warrantyMap.get(label) ?? 0,
    })),
    activityTrend: [...trend.entries()].map(([week, v]) => ({ week, ...v })),
    vendorCompliance,
    tasks,
    comparison: [
      { metric: "New leads", thisMonth: cmpClients[0], lastMonth: cmpClients[1] },
      { metric: "Estimates created", thisMonth: cmpEstimatesCreated[0], lastMonth: cmpEstimatesCreated[1] },
      { metric: "Estimates accepted", thisMonth: cmpEstimatesAccepted[0], lastMonth: cmpEstimatesAccepted[1] },
      { metric: "Daily logs posted", thisMonth: cmpLogs[0], lastMonth: cmpLogs[1] },
      { metric: "Jobs reaching Complete", thisMonth: cmpComplete[0], lastMonth: cmpComplete[1] },
    ],
  };
}
