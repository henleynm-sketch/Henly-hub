"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canManageTeam, type Role } from "@/lib/roles";
import { revalidatePath } from "next/cache";
import { jtQuery, jtOrgListAll, parseFieldMap, type JobTreadFieldMap } from "@/lib/jobtread";
import {
  isValidJobStatus,
  isValidPipelineStage,
  isValidConstructionPhase,
  isValidWarrantyPhase,
  isValidDivision,
  isValidVendorTrade,
  isValidVendorType,
  isValidLeadSource,
} from "@/lib/taxonomy";

/**
 * JobTread entity sync — pull-only, idempotent.
 *
 * Every sync function upserts keyed on the JobTread ID column and never
 * fabricates data: values map only when they validate against the canonical
 * taxonomy (src/lib/taxonomy.ts); anything else is counted as unmatched and
 * left null. Custom-field IDs are never hardcoded — the four board axes come
 * from JobTreadConfig.fieldMap and everything else is resolved by field NAME
 * against the org's discovered custom-field list at sync time.
 *
 * JobTread wins on re-sync for fields it has a valid value for (divergence
 * from Hub-side edits is accepted and made visible by re-sync). Fields JT has
 * no value for are never nulled out — Hub-side classification survives.
 */

// ── Types ────────────────────────────────────────────────────────────────────

type CFV = { value: unknown; customField: { id: string } };
type JTCustomFieldDef = { id: string; name: string; targetType: string };

type JTAccount = {
  id: string;
  name: string;
  createdAt?: string;
  customFieldValues?: { nodes?: CFV[] };
  contacts?: { nodes?: { id: string; name: string; customFieldValues?: { nodes?: CFV[] } }[] };
};

type JTJob = {
  id: string;
  name: string;
  number?: string | null;
  closedOn?: string | null;
  description?: string | null;
  location?: { address?: string | null; latitude?: number | null; longitude?: number | null; account?: { id: string } | null } | null;
  customFieldValues?: { nodes?: CFV[] };
  projectedPrice?: number | null;
  projectedPriceWithTax?: number | null;
  projectedCost?: number | null;
  actualCost?: number | null;
  costItems?: { count?: number; costSum?: number | null; priceWithTaxSum?: number | null };
};

type JTJobCostItem = {
  id: string;
  name: string;
  cost?: number | null;
  costCode?: { name?: string | null } | null;
};

type JTDocument = {
  id: string;
  name: string;
  number?: number | null;
  status?: string | null;
  price?: number | null;
  priceWithTax?: number | null;
  tax?: number | null;
  job?: { id: string } | null;
};

type JTDailyLog = {
  id: string;
  date?: string | null;
  notes?: string | null;
  job?: { id: string } | null;
  customFieldValues?: { nodes?: CFV[] };
};

export type EntityCounts = {
  created: number;
  updated: number;
  skipped: number;
  [k: string]: number;
};

export type JobTreadSyncSummary = {
  ranAt: string;
  customers?: EntityCounts;
  vendors?: EntityCounts;
  jobs?: EntityCounts & { noClient: number };
  unmatchedTaxonomy?: Record<string, number>;
  dailyLogs?: EntityCounts;
  catalog?: { costTypes: EntityCounts; costCodes: EntityCounts; costItems: EntityCounts };
  budgetItems?: EntityCounts;
  estimates?: EntityCounts & { linked: number; noProject: number };
  todos?: { count: number };
  error?: string;
};

export type SyncActionResult = { ok: boolean; error?: string; summary?: JobTreadSyncSummary };

// ── Guards & helpers (module scope per settings convention) ──────────────────

async function ceo() {
  const me = await auth();
  if (!me?.user || !canManageTeam(me.user.role as Role)) return null;
  return me;
}

// Field-name lookup over the org's custom fields, scoped by targetType.
class CFLookup {
  private byId = new Map<string, JTCustomFieldDef>();
  constructor(defs: JTCustomFieldDef[]) {
    for (const d of defs) this.byId.set(d.id, d);
  }
  value(nodes: CFV[] | undefined, targetType: string, name: string): unknown {
    if (!nodes) return undefined;
    for (const n of nodes) {
      const def = this.byId.get(n.customField.id);
      if (def && def.targetType === targetType && def.name.toLowerCase() === name.toLowerCase()) {
        if (n.value !== null && n.value !== undefined && String(n.value) !== "") return n.value;
      }
    }
    return undefined;
  }
  valueById(nodes: CFV[] | undefined, fieldId: string | null): unknown {
    if (!nodes || !fieldId) return undefined;
    for (const n of nodes) {
      if (n.customField.id === fieldId) {
        if (n.value !== null && n.value !== undefined && String(n.value) !== "") return n.value;
      }
    }
    return undefined;
  }
}

async function loadCFLookup(): Promise<CFLookup> {
  const defs = await jtOrgListAll<JTCustomFieldDef>("customFields", {
    id: {},
    name: {},
    targetType: {},
  });
  return new CFLookup(defs);
}

const str = (v: unknown): string | undefined =>
  v === undefined || v === null ? undefined : String(v).trim() || undefined;

const bool = (v: unknown): boolean =>
  v === true || v === "true" || v === "Yes" || v === "yes" || v === 1;

const date = (v: unknown): Date | undefined => {
  const s = str(v);
  if (!s) return undefined;
  const d = new Date(s);
  return isNaN(d.getTime()) ? undefined : d;
};

// Only report an update when something actually changes — keeps the second
// sync run honest (created 0 / updated 0 / skipped N).
function changed<T extends Record<string, unknown>>(existing: Record<string, unknown>, data: T): boolean {
  for (const [k, v] of Object.entries(data)) {
    const cur = existing[k];
    if (v instanceof Date && cur instanceof Date) {
      if (v.getTime() !== cur.getTime()) return true;
    } else if (cur !== v) {
      return true;
    }
  }
  return false;
}

const CFV_SHAPE = { $: { size: 25 }, nodes: { value: {}, customField: { id: {} } } };

// ── 1. Customers ─────────────────────────────────────────────────────────────

export async function syncJobTreadCustomers(): Promise<SyncActionResult> {
  const me = await ceo();
  if (!me) return { ok: false, error: "Not authorized" };
  try {
    const cf = await loadCFLookup();
    const counts = await customersSync(cf);
    return { ok: true, summary: { ranAt: new Date().toISOString(), customers: counts } };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Customer sync failed" };
  }
}

async function customersSync(cf: CFLookup): Promise<EntityCounts> {
  const accounts = await jtOrgListAll<JTAccount>(
    "accounts",
    {
      id: {},
      name: {},
      customFieldValues: CFV_SHAPE,
      contacts: { $: { size: 5 }, nodes: { id: {}, name: {}, customFieldValues: CFV_SHAPE } },
    },
    { where: ["type", "=", "customer"], size: 25 },
  );

  const counts: EntityCounts = { created: 0, updated: 0, skipped: 0 };
  for (const a of accounts) {
    const contactCfs = a.contacts?.nodes?.flatMap((c) => c.customFieldValues?.nodes ?? []) ?? [];
    const email = str(
      cf.value(contactCfs, "customerContact", "Email") ??
        cf.value(contactCfs, "customerContact", "Secondary Email"),
    );
    const phone = str(
      cf.value(contactCfs, "customerContact", "Phone") ??
        cf.value(contactCfs, "customerContact", "Mobile"),
    );
    const leadSourceRaw = str(cf.value(a.customFieldValues?.nodes, "customer", "Lead Source"));
    const leadSource = leadSourceRaw && isValidLeadSource(leadSourceRaw) ? leadSourceRaw : undefined;

    // Dedupe: jobtreadAccountId → exact email → exact name (+ compatible phone) → create.
    let existing = await prisma.client.findUnique({ where: { jobtreadAccountId: a.id } });
    if (!existing && email) {
      existing = await prisma.client.findFirst({ where: { primaryEmail: email } });
    }
    if (!existing) {
      const byName = await prisma.client.findMany({ where: { name: a.name } });
      existing =
        byName.find((c) => !c.jobtreadAccountId && (!c.primaryPhone || !phone || c.primaryPhone === phone)) ?? null;
    }

    if (existing) {
      // Fill gaps only — never overwrite Hub-entered contact data.
      const data: Record<string, unknown> = { jobtreadAccountId: a.id };
      if (!existing.primaryEmail && email) data.primaryEmail = email;
      if (!existing.primaryPhone && phone) data.primaryPhone = phone;
      if (!existing.leadSource && leadSource) data.leadSource = leadSource;
      if (changed(existing as unknown as Record<string, unknown>, data)) {
        await prisma.client.update({ where: { id: existing.id }, data });
        counts.updated++;
      } else {
        counts.skipped++;
      }
    } else {
      await prisma.client.create({
        data: {
          name: a.name,
          jobtreadAccountId: a.id,
          primaryEmail: email ?? null,
          primaryPhone: phone ?? null,
          leadSource: leadSource ?? null,
        },
      });
      counts.created++;
    }
  }
  return counts;
}

// ── 2. Vendors ───────────────────────────────────────────────────────────────

export async function syncJobTreadVendors(): Promise<SyncActionResult> {
  const me = await ceo();
  if (!me) return { ok: false, error: "Not authorized" };
  try {
    const cf = await loadCFLookup();
    const counts = await vendorsSync(cf);
    return { ok: true, summary: { ranAt: new Date().toISOString(), vendors: counts } };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Vendor sync failed" };
  }
}

async function vendorsSync(cf: CFLookup): Promise<EntityCounts> {
  const accounts = await jtOrgListAll<JTAccount>(
    "accounts",
    { id: {}, name: {}, customFieldValues: CFV_SHAPE },
    { where: ["type", "=", "vendor"], size: 25 },
  );

  const counts: EntityCounts = { created: 0, updated: 0, skipped: 0 };
  for (const a of accounts) {
    const nodes = a.customFieldValues?.nodes;
    const email = str(cf.value(nodes, "vendor", "Email") ?? cf.value(nodes, "vendor", "Secondary Email"));
    const officePhone = str(cf.value(nodes, "vendor", "Office Phone") ?? cf.value(nodes, "vendor", "Phone"));
    const fax = str(cf.value(nodes, "vendor", "Fax"));
    const tradeRaw = str(cf.value(nodes, "vendor", "Trade"));
    const typeRaw = str(cf.value(nodes, "vendor", "Type"));
    const w9v = cf.value(nodes, "vendor", "W-9");
    const coi = date(cf.value(nodes, "vendor", "COI Expires"));
    const divisionsText = str(cf.value(nodes, "vendor", "Divisions"));

    // Non-canonical trade/divisions text lands in notes — never invented onto
    // the validated columns.
    const noteBits: string[] = [];
    if (tradeRaw && !isValidVendorTrade(tradeRaw)) noteBits.push(`Trade (JT): ${tradeRaw}`);
    if (divisionsText) noteBits.push(`Divisions (JT): ${divisionsText}`);
    const jtNotes = noteBits.length ? noteBits.join("\n") : undefined;

    const data: Record<string, unknown> = { jobtreadAccountId: a.id, name: a.name };
    if (email) data.email = email;
    if (officePhone) data.officePhone = officePhone;
    if (fax) data.fax = fax;
    if (tradeRaw && isValidVendorTrade(tradeRaw)) data.trade = tradeRaw;
    if (typeRaw && isValidVendorType(typeRaw)) data.type = typeRaw;
    if (w9v !== undefined) data.w9OnFile = bool(w9v); // absent in JT → leave Hub value
    if (coi) data.coiExpiresAt = coi;

    let existing = await prisma.vendor.findUnique({ where: { jobtreadAccountId: a.id } });
    if (existing?.archivedAt) {
      // Deliberately removed in the Hub — never resurrect or update.
      counts.skipped++;
      continue;
    }
    if (!existing) {
      existing = await prisma.vendor.findFirst({
        where: { name: a.name, jobtreadAccountId: null, archivedAt: null },
      });
    }

    if (existing) {
      if (jtNotes && !existing.notes?.includes(jtNotes)) {
        data.notes = existing.notes ? `${existing.notes}\n${jtNotes}` : jtNotes;
      }
      if (changed(existing as unknown as Record<string, unknown>, data)) {
        await prisma.vendor.update({ where: { id: existing.id }, data });
        counts.updated++;
      } else {
        counts.skipped++;
      }
    } else {
      if (jtNotes) data.notes = jtNotes;
      await prisma.vendor.create({ data: data as Parameters<typeof prisma.vendor.create>[0]["data"] });
      counts.created++;
    }
  }
  return counts;
}

// ── 3. Jobs ──────────────────────────────────────────────────────────────────

export async function syncJobTreadJobs(): Promise<SyncActionResult> {
  const me = await ceo();
  if (!me) return { ok: false, error: "Not authorized" };
  try {
    const cf = await loadCFLookup();
    const fieldMap = await loadFieldMap();
    const { counts, unmatched, budgetItems } = await jobsSync(cf, fieldMap);
    return {
      ok: true,
      summary: {
        ranAt: new Date().toISOString(),
        jobs: counts,
        unmatchedTaxonomy: unmatched,
        budgetItems,
      },
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Job sync failed" };
  }
}

async function loadFieldMap(): Promise<JobTreadFieldMap> {
  const row = await prisma.jobTreadConfig.findUnique({ where: { id: "singleton" } });
  const map = parseFieldMap(row?.fieldMap);
  if (!map) throw new Error("No custom-field map — run field discovery on the JobTread card first");
  return map;
}

const AXIS_VALIDATORS = {
  pipelineStage: isValidPipelineStage,
  constructionPhase: isValidConstructionPhase,
  warrantyPhase: isValidWarrantyPhase,
  division: isValidDivision,
} as const;

async function jobsSync(cf: CFLookup, fieldMap: JobTreadFieldMap) {
  // Money fields verified against the live Pave schema (introspected 2026-07):
  // job-level projectedPrice/projectedPriceWithTax/projectedCost/actualCost
  // exist but return null even for budgeted jobs, while the per-job costItems
  // connection provably carries the budget (cost / priceWithTax sums). Prefer
  // the job-level field when present, fall back to the sums.
  const jobs = await jtOrgListAll<JTJob>(
    "jobs",
    {
      id: {},
      name: {},
      number: {},
      closedOn: {},
      description: {},
      location: { address: {}, latitude: {}, longitude: {}, account: { id: {} } },
      customFieldValues: CFV_SHAPE,
      projectedPrice: {},
      projectedPriceWithTax: {},
      projectedCost: {},
      actualCost: {},
      costItems: {
        count: {},
        costSum: { _: "sum", $: "cost" },
        priceWithTaxSum: { _: "sum", $: "priceWithTax" },
      },
    },
    { size: 25 },
  );

  const counts: EntityCounts & { noClient: number } = { created: 0, updated: 0, skipped: 0, noClient: 0 };
  const budgetItems: EntityCounts = { created: 0, updated: 0, skipped: 0 };
  const unmatched: Record<string, number> = {
    pipelineStage: 0,
    constructionPhase: 0,
    warrantyPhase: 0,
    division: 0,
    status: 0,
  };

  for (const j of jobs) {
    const nodes = j.customFieldValues?.nodes;

    const data: Record<string, unknown> = { jobtreadJobId: j.id, name: j.name };
    if (j.location?.address) data.address = j.location.address;
    // JT-provided coordinates: persist with source "jobtread" unless a manual
    // fix exists. No Nominatim calls in sync (rate limit) — on-demand only.
    const jtLat = j.location?.latitude ?? null;
    const jtLng = j.location?.longitude ?? null;

    // Four board axes through the discovered fieldMap; exact match against the
    // canonical constants — unmatched values are counted and left alone.
    for (const axis of ["pipelineStage", "constructionPhase", "warrantyPhase", "division"] as const) {
      const raw = str(cf.valueById(nodes, fieldMap[axis]));
      if (raw === undefined) continue;
      if (AXIS_VALIDATORS[axis](raw)) data[axis] = raw;
      else unmatched[axis]++;
    }
    // Job Status is also a JT custom field whose option set is the canonical
    // JOB_STATUS list — resolved by name, mapped only when valid.
    const statusRaw = str(cf.value(nodes, "job", "Status"));
    if (statusRaw !== undefined) {
      if (isValidJobStatus(statusRaw)) data.status = statusRaw;
      else unmatched.status++;
    }

    // Contract / projected cost — JobTread wins when it has a value at all
    // (a budgeted job whose price sums to 0 IS a JT value of 0); jobs with no
    // budget and no job-level figure leave the Hub fields untouched.
    const hasBudget = (j.costItems?.count ?? 0) > 0;
    if (j.projectedPriceWithTax != null) {
      data.contractCents = cents(j.projectedPriceWithTax);
    } else if (hasBudget) {
      data.contractCents = cents(j.costItems?.priceWithTaxSum);
    }
    if (j.projectedCost != null) {
      data.budgetCents = cents(j.projectedCost);
    } else if (hasBudget) {
      data.budgetCents = cents(j.costItems?.costSum);
    }

    const existing = await prisma.project.findUnique({ where: { jobtreadJobId: j.id } });

    // Job number → Project.code, only when Hub hasn't assigned one (and the
    // number isn't already taken by another project — code is unique).
    const number = str(j.number);
    async function codeFor(currentCode: string | null): Promise<string | undefined> {
      if (!number || currentCode) return undefined;
      const taken = await prisma.project.findUnique({ where: { code: number } });
      if (taken && taken.jobtreadJobId !== j.id) return undefined;
      return number;
    }

    let hubProjectId: string | null = null;
    if (existing) {
      hubProjectId = existing.id;
      const code = await codeFor(existing.code);
      if (code) data.code = code;
      const addressChanged =
        j.location?.address !== undefined &&
        j.location?.address !== null &&
        j.location.address !== existing.address;
      if (jtLat != null && jtLng != null) {
        const coordsDiffer = existing.latitude !== jtLat || existing.longitude !== jtLng;
        if (coordsDiffer && (existing.geocodeSource !== "manual" || existing.latitude == null)) {
          data.latitude = jtLat;
          data.longitude = jtLng;
          data.geocodedAt = new Date();
          data.geocodeSource = "jobtread";
        }
      } else if (addressChanged && existing.latitude != null) {
        // Address moved and JT has no coords — clear the now-stale pin.
        data.latitude = null;
        data.longitude = null;
        data.geocodedAt = null;
        data.geocodeSource = null;
      }
      if (changed(existing as unknown as Record<string, unknown>, data)) {
        await prisma.project.update({ where: { id: existing.id }, data });
        counts.updated++;
      } else {
        counts.skipped++;
      }
    } else {
      const accountId = j.location?.account?.id;
      const client = accountId
        ? await prisma.client.findUnique({ where: { jobtreadAccountId: accountId } })
        : null;
      if (!client) {
        counts.noClient++;
        continue;
      }
      const code = await codeFor(null);
      if (code) data.code = code;
      if (j.description) data.description = j.description;
      if (jtLat != null && jtLng != null) {
        data.latitude = jtLat;
        data.longitude = jtLng;
        data.geocodedAt = new Date();
        data.geocodeSource = "jobtread";
      }
      const created = await prisma.project.create({
        data: {
          ...(data as object),
          clientId: client.id,
          name: j.name,
        } as Parameters<typeof prisma.project.create>[0]["data"],
      });
      hubProjectId = created.id;
      counts.created++;
    }

    if (hubProjectId && hasBudget) {
      await jobBudgetItemsSync(j.id, hubProjectId, budgetItems);
    }
    // Job-level actual cost has no per-item breakdown in JT — it lands on one
    // aggregate row so /financials actuals stay honest without double-counting.
    if (hubProjectId && j.actualCost != null) {
      const actualData = {
        projectId: hubProjectId,
        category: "JobTread",
        description: "Actual cost to date (JobTread)",
        actualCents: cents(j.actualCost),
      };
      const row = await prisma.budgetItem.findUnique({ where: { jobtreadId: `${j.id}:actual` } });
      if (row) {
        if (changed(row as unknown as Record<string, unknown>, actualData)) {
          await prisma.budgetItem.update({ where: { id: row.id }, data: actualData });
          budgetItems.updated++;
        } else {
          budgetItems.skipped++;
        }
      } else {
        await prisma.budgetItem.create({ data: { ...actualData, jobtreadId: `${j.id}:actual` } });
        budgetItems.created++;
      }
    }
  }
  return { counts, unmatched, budgetItems };
}

async function fetchJobCostItems(jobtreadJobId: string): Promise<JTJobCostItem[]> {
  const out: JTJobCostItem[] = [];
  let page: string | undefined;
  for (let i = 0; i < 20; i++) {
    const $: Record<string, unknown> = { size: 50 };
    if (page) $.page = page;
    const res = await jtQuery<{
      job?: { costItems?: { nodes?: JTJobCostItem[]; nextPage?: string | null } };
    }>({
      job: {
        $: { id: jobtreadJobId },
        costItems: {
          $,
          nextPage: {},
          nodes: { id: {}, name: {}, cost: {}, costCode: { name: {} } },
        },
      },
    });
    const conn = res.job?.costItems;
    if (!conn) break;
    out.push(...(conn.nodes ?? []));
    if (!conn.nextPage || (conn.nodes ?? []).length < 50) break;
    page = conn.nextPage;
  }
  return out;
}

// Upserts keyed on the JT cost-item id. estimateCents mirrors JT projected
// cost; actualCents is never touched here — actuals belong to QBO/Hub.
async function jobBudgetItemsSync(
  jobtreadJobId: string,
  projectId: string,
  counts: EntityCounts,
): Promise<void> {
  const items = await fetchJobCostItems(jobtreadJobId);
  for (const it of items) {
    const data = {
      projectId,
      category: str(it.costCode?.name) ?? "JobTread",
      description: it.name,
      estimateCents: cents(it.cost),
    };
    const existing = await prisma.budgetItem.findUnique({ where: { jobtreadId: it.id } });
    if (existing) {
      if (changed(existing as unknown as Record<string, unknown>, data)) {
        await prisma.budgetItem.update({ where: { id: existing.id }, data });
        counts.updated++;
      } else {
        counts.skipped++;
      }
    } else {
      await prisma.budgetItem.create({ data: { ...data, jobtreadId: it.id } });
      counts.created++;
    }
  }
}

// ── 4. Daily logs ────────────────────────────────────────────────────────────

export async function syncJobTreadDailyLogs(): Promise<SyncActionResult> {
  const me = await ceo();
  if (!me) return { ok: false, error: "Not authorized" };
  try {
    const cf = await loadCFLookup();
    const counts = await dailyLogsSync(cf, me.user.id);
    return { ok: true, summary: { ranAt: new Date().toISOString(), dailyLogs: counts } };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Daily log sync failed" };
  }
}

async function dailyLogsSync(cf: CFLookup, syncUserId: string): Promise<EntityCounts> {
  const logs = await jtOrgListAll<JTDailyLog>(
    "dailyLogs",
    { id: {}, date: {}, notes: {}, job: { id: {} }, customFieldValues: CFV_SHAPE },
    { size: 25 },
  );

  const counts: EntityCounts = { created: 0, updated: 0, skipped: 0, noProject: 0 };
  for (const l of logs) {
    const project = l.job?.id
      ? await prisma.project.findUnique({ where: { jobtreadJobId: l.job.id } })
      : null;
    if (!project) {
      counts.noProject++;
      continue;
    }

    const nodes = l.customFieldValues?.nodes;
    const logDate = date(l.date) ?? new Date();
    const header = `Synced from JobTread — ${logDate.toISOString().slice(0, 10)}`;
    const notes = l.notes ? `${header}\n\n${l.notes}` : header;

    const data = {
      projectId: project.id,
      date: logDate,
      notes,
      clientVisible: false, // always — JT logs are internal until Hub decides otherwise
      anticipatedDelays: bool(cf.value(nodes, "dailyLog", "Anticipated Delays")),
      materialDeliveries: bool(cf.value(nodes, "dailyLog", "Material Pickups / Deliveries")),
      safetyIncidents: str(cf.value(nodes, "dailyLog", "Safety Incidents")) ?? null,
      tradesOnsite: str(cf.value(nodes, "dailyLog", "Trades Onsite")) ?? null,
      unplannedTasks: str(cf.value(nodes, "dailyLog", "Unplanned Tasks")) ?? null,
      internalNotes: str(cf.value(nodes, "dailyLog", "Internal Notes")) ?? null,
    };

    const existing = await prisma.dailyLog.findUnique({ where: { jobtreadId: l.id } });
    if (existing) {
      if (changed(existing as unknown as Record<string, unknown>, data)) {
        await prisma.dailyLog.update({ where: { id: existing.id }, data });
        counts.updated++;
      } else {
        counts.skipped++;
      }
    } else {
      await prisma.dailyLog.create({ data: { ...data, jobtreadId: l.id, authorId: syncUserId } });
      counts.created++;
    }
  }
  return counts;
}

// ── 5. Estimates (JT customerOrder documents → Hub estimates, job-linked) ────

const DOC_STATUS_MAP: Record<string, string> = {
  draft: "DRAFT",
  pending: "SENT",
  approved: "ACCEPTED",
  denied: "DECLINED",
};

export async function syncJobTreadEstimates(): Promise<SyncActionResult> {
  const me = await ceo();
  if (!me) return { ok: false, error: "Not authorized" };
  try {
    const counts = await estimatesSync(me.user.id);
    return { ok: true, summary: { ranAt: new Date().toISOString(), estimates: counts } };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Estimate sync failed" };
  }
}

async function estimatesSync(syncUserId: string): Promise<EntityCounts & { linked: number; noProject: number }> {
  const counts: EntityCounts & { linked: number; noProject: number } = {
    created: 0,
    updated: 0,
    skipped: 0,
    linked: 0,
    noProject: 0,
  };

  // Document type/status values verified against the live Pave schema:
  // documentType oneOf bidRequest|customerInvoice|customerOrder|vendorBill|
  // vendorOrder — customerOrder is the JT estimate/proposal; documentStatus
  // oneOf draft|pending|approved|denied.
  const docs = await jtOrgListAll<JTDocument>(
    "documents",
    {
      id: {},
      name: {},
      number: {},
      status: {},
      price: {},
      priceWithTax: {},
      tax: {},
      job: { id: {} },
    },
    { where: ["type", "=", "customerOrder"], size: 25 },
  );

  for (const d of docs) {
    const project = d.job?.id
      ? await prisma.project.findUnique({
          where: { jobtreadJobId: d.job.id },
          select: { id: true, clientId: true },
        })
      : null;
    if (!project) {
      counts.noProject++;
      continue;
    }

    const data = {
      clientId: project.clientId,
      projectId: project.id,
      title: d.name,
      status: DOC_STATUS_MAP[String(d.status ?? "").toLowerCase()] ?? "DRAFT",
      subtotalCents: cents(d.price),
      taxCents: cents(d.tax),
      totalCents: cents(d.priceWithTax),
    };
    const existing = await prisma.estimate.findUnique({ where: { jobtreadDocumentId: d.id } });
    if (existing) {
      if (changed(existing as unknown as Record<string, unknown>, data)) {
        await prisma.estimate.update({ where: { id: existing.id }, data });
        counts.updated++;
      } else {
        counts.skipped++;
      }
    } else {
      const base = `JT-${d.number ?? d.id}`;
      const taken = await prisma.estimate.findUnique({ where: { number: base }, select: { id: true } });
      await prisma.estimate.create({
        data: {
          ...data,
          jobtreadDocumentId: d.id,
          number: taken ? `JT-${d.id}` : base,
          authorId: syncUserId,
        },
      });
      counts.created++;
    }
  }

  // Deterministic backfill for Hub-native estimates: a client with exactly one
  // live job is unambiguous — link so the pipeline chart can attribute the
  // estimate to that job's stage. Multi-job or job-less clients stay unlinked
  // ("unstaged" stays honest).
  const unlinked = await prisma.estimate.findMany({
    where: { projectId: null },
    select: { id: true, clientId: true },
  });
  for (const e of unlinked) {
    const jobs = await prisma.project.findMany({
      where: { clientId: e.clientId, archivedAt: null },
      select: { id: true },
      take: 2,
    });
    if (jobs.length === 1) {
      await prisma.estimate.update({ where: { id: e.id }, data: { projectId: jobs[0].id } });
      counts.linked++;
    }
  }
  return counts;
}

// ── 6. To-dos (display-only — never persisted; Henley Tasks is the master) ───

async function todosCount(): Promise<number> {
  const todos = await jtOrgListAll<{ id: string }>(
    "tasks",
    { id: {} },
    { where: ["isToDo", "=", true], size: 100 },
  );
  return todos.length;
}

// ── Catalog: cost types / codes / items ──────────────────────────────────────

export async function syncJobTreadCatalog(): Promise<SyncActionResult> {
  const me = await ceo();
  if (!me) return { ok: false, error: "Not authorized" };
  try {
    const catalog = await catalogSync();
    return { ok: true, summary: { ranAt: new Date().toISOString(), catalog } };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Catalog sync failed" };
  }
}

const cents = (v: unknown): number => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? 0));
  return isNaN(n) ? 0 : Math.round(n * 100);
};

async function catalogSync() {
  const types = await jtOrgListAll<{ id: string; name: string; margin?: number | null; isTaxable?: boolean }>(
    "costTypes",
    { id: {}, name: {}, margin: {}, isTaxable: {} },
    { size: 100 },
  );
  const typeCounts: EntityCounts = { created: 0, updated: 0, skipped: 0 };
  for (const t of types) {
    const margin = typeof t.margin === "number" ? t.margin : 0;
    const marginBps = Math.round(margin * 10000);
    const markupBps = margin > 0 && margin < 1 ? Math.round((margin / (1 - margin)) * 10000) : 0;
    const data = {
      name: t.name,
      defaultMarginPct: marginBps,
      defaultMarkupPct: markupBps,
      taxable: Boolean(t.isTaxable),
    };
    const existing = await prisma.costType.findUnique({ where: { jobtreadId: t.id } });
    if (existing) {
      if (changed(existing as unknown as Record<string, unknown>, data)) {
        await prisma.costType.update({ where: { id: existing.id }, data });
        typeCounts.updated++;
      } else typeCounts.skipped++;
    } else {
      await prisma.costType.create({ data: { ...data, jobtreadId: t.id } });
      typeCounts.created++;
    }
  }

  const codes = await jtOrgListAll<{
    id: string;
    name: string;
    number?: string | null;
    parentCostCode?: { id: string } | null;
  }>("costCodes", { id: {}, name: {}, number: {}, parentCostCode: { id: {} } }, { size: 100 });
  const codeCounts: EntityCounts = { created: 0, updated: 0, skipped: 0 };
  // Pass 1: upsert nodes without parents.
  for (const c of codes) {
    const data = { name: c.name, number: str(c.number) ?? "" };
    const existing = await prisma.costCode.findUnique({ where: { jobtreadId: c.id } });
    if (existing) {
      if (changed(existing as unknown as Record<string, unknown>, data)) {
        await prisma.costCode.update({ where: { id: existing.id }, data });
        codeCounts.updated++;
      } else codeCounts.skipped++;
    } else {
      await prisma.costCode.create({ data: { ...data, jobtreadId: c.id } });
      codeCounts.created++;
    }
  }
  // Pass 2: parent links (jobtreadId → local id).
  for (const c of codes) {
    const self = await prisma.costCode.findUnique({ where: { jobtreadId: c.id } });
    if (!self) continue;
    const parent = c.parentCostCode?.id
      ? await prisma.costCode.findUnique({ where: { jobtreadId: c.parentCostCode.id } })
      : null;
    const parentId = parent?.id ?? null;
    if (self.parentId !== parentId) {
      await prisma.costCode.update({ where: { id: self.id }, data: { parentId } });
      if (codeCounts.skipped > 0) codeCounts.skipped--;
      codeCounts.updated++;
    }
  }

  const items = await jtOrgListAll<{
    id: string;
    name: string;
    description?: string | null;
    unitCost?: number | null;
    unitPrice?: number | null;
    isTaxable?: boolean;
    unit?: { name?: string | null } | null;
    costType?: { id: string } | null;
    costCode?: { id: string } | null;
  }>(
    "costItems",
    {
      id: {},
      name: {},
      description: {},
      unitCost: {},
      unitPrice: {},
      isTaxable: {},
      unit: { name: {} },
      costType: { id: {} },
      costCode: { id: {} },
    },
    { size: 50 },
  );
  const itemCounts: EntityCounts = { created: 0, updated: 0, skipped: 0 };
  for (const i of items) {
    const type = i.costType?.id
      ? await prisma.costType.findUnique({ where: { jobtreadId: i.costType.id } })
      : null;
    const code = i.costCode?.id
      ? await prisma.costCode.findUnique({ where: { jobtreadId: i.costCode.id } })
      : null;
    const data = {
      name: i.name,
      description: str(i.description) ?? null,
      unit: str(i.unit?.name) ?? null,
      unitCostCents: cents(i.unitCost),
      unitPriceCents: cents(i.unitPrice),
      taxable: Boolean(i.isTaxable),
      costTypeId: type?.id ?? null,
      costCodeId: code?.id ?? null,
    };
    const existing = await prisma.costItem.findUnique({ where: { jobtreadId: i.id } });
    if (existing) {
      if (changed(existing as unknown as Record<string, unknown>, data)) {
        await prisma.costItem.update({ where: { id: existing.id }, data });
        itemCounts.updated++;
      } else itemCounts.skipped++;
    } else {
      await prisma.costItem.create({ data: { ...data, jobtreadId: i.id } });
      itemCounts.created++;
    }
  }

  return { costTypes: typeCounts, costCodes: codeCounts, costItems: itemCounts };
}

// ── Sync all ─────────────────────────────────────────────────────────────────

export async function syncAllJobTread(): Promise<SyncActionResult> {
  const me = await ceo();
  if (!me) return { ok: false, error: "Not authorized" };

  const summary: JobTreadSyncSummary = { ranAt: new Date().toISOString() };
  try {
    const cf = await loadCFLookup();
    summary.customers = await customersSync(cf);
    summary.vendors = await vendorsSync(cf);
    const fieldMap = await loadFieldMap();
    const jobsRes = await jobsSync(cf, fieldMap);
    summary.jobs = jobsRes.counts;
    summary.unmatchedTaxonomy = jobsRes.unmatched;
    summary.budgetItems = jobsRes.budgetItems;
    summary.dailyLogs = await dailyLogsSync(cf, me.user.id);
    summary.estimates = await estimatesSync(me.user.id);
    summary.catalog = await catalogSync();
    summary.todos = { count: await todosCount() };
  } catch (err) {
    // Surface the raw error verbatim; partial progress above is already
    // persisted and reflected honestly in the summary.
    summary.error = err instanceof Error ? err.message : String(err);
  }

  await prisma.jobTreadConfig
    .update({
      where: { id: "singleton" },
      data: { lastSyncAt: new Date(), lastSyncSummary: JSON.stringify(summary) },
    })
    .catch(() => {});

  await prisma.auditLog.create({
    data: { actorId: me.user.id, action: "jobtread.sync", target: summary.error ? "failed" : "ok" },
  });

  revalidatePath("/settings");
  revalidatePath("/projects");
  revalidatePath("/clients");
  revalidatePath("/jobs");
  revalidatePath("/jobs/catalog");
  revalidatePath("/financials");
  revalidatePath("/estimates");
  revalidatePath("/dashboard");
  return summary.error ? { ok: false, error: summary.error, summary } : { ok: true, summary };
}
