import { PrismaClient as PgClient, Prisma } from "@prisma/client";
import { PrismaClient as SqliteClient } from "../generated/sqlite-client";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";

// One-time sqlite -> postgres data copy. Idempotent: truncates the PG side
// first, so it is safe to re-run until every count matches. dev.db is only
// ever read. Exits nonzero on any count mismatch or unplanned model.

const EXPECTED_MODELS = [
  "User","Client","Engagement","Project","ProjectAssignment","Milestone","Selection",
  "BudgetItem","DailyLog","Document","Thread","Message","Estimate","EstimateLine",
  "Contract","ChangeOrder","TimeEntry","QBOToken","Setting","Department","SettingAudit",
  "AuditLog","UserNotificationPref","M365Config","QuoConfig","JobTreadConfig",
  "HenleyTasksConfig","ScheduleTask","ApiKey","ApiKeyAudit","ApiCallLog","WarrantyItem",
  "JobTemplate","TemplateScheduleItem","TemplateBudgetItem","Vendor","CrmActivity",
  "CostType","CostCode","CostItem","JobView","AnthropicConfig","AssistantThread",
  "AssistantMessage","OAuthClient","OAuthCode","OAuthToken","Notification",
  "NotificationDelivery","NotificationUnsubscribe","Organization","Invite",
  "PasswordResetToken","BrandingConfig",
];

const BATCH = 500;

type ModelMeta = {
  name: string;
  table: string;
  idField: string;
  scalarFields: string[];
  deps: { target: string; fromFields: string[]; nullable: boolean }[];
};

function readMeta(): ModelMeta[] {
  const models = Prisma.dmmf.datamodel.models;
  const names = models.map((m) => m.name);
  const unplanned = names.filter((n) => !EXPECTED_MODELS.includes(n));
  const missing = EXPECTED_MODELS.filter((n) => !names.includes(n));
  if (unplanned.length || missing.length) {
    throw new Error(
      `Copy plan out of date. Unplanned models: [${unplanned}] · planned but absent: [${missing}]`
    );
  }
  return models.map((m) => {
    const idField = m.fields.find((f) => f.isId)?.name;
    if (!idField) throw new Error(`${m.name}: no single @id field — script needs updating`);
    return {
      name: m.name,
      table: m.dbName ?? m.name,
      idField,
      scalarFields: m.fields.filter((f) => f.kind === "scalar").map((f) => f.name),
      deps: m.fields
        .filter((f) => f.kind === "object" && (f.relationFromFields?.length ?? 0) > 0)
        .map((f) => ({
          target: f.type,
          fromFields: [...(f.relationFromFields ?? [])],
          nullable: !f.isRequired,
        })),
    };
  });
}

// Topological order; FK edges that cannot be honored yet are deferred iff
// nullable (self-relations like User.reportsToId, CostCode.parentId land here).
function plan(meta: ModelMeta[]) {
  const order: ModelMeta[] = [];
  const placed = new Set<string>();
  const deferred: { model: string; fields: string[] }[] = [];
  const remaining = [...meta];
  while (remaining.length) {
    let progressed = false;
    for (let i = 0; i < remaining.length; i++) {
      const m = remaining[i];
      const unresolved = m.deps.filter((d) => !placed.has(d.target) || d.target === m.name);
      const hard = unresolved.filter((d) => !d.nullable && d.target !== m.name);
      if (hard.length) continue;
      const deferFields = unresolved.flatMap((d) => {
        if (d.target !== m.name && d.nullable === false) return [];
        return d.fromFields;
      });
      const requiredSelf = m.deps.some((d) => d.target === m.name && !d.nullable);
      if (requiredSelf) throw new Error(`${m.name}: required self-relation — cannot migrate`);
      if (deferFields.length) deferred.push({ model: m.name, fields: deferFields });
      order.push(m);
      placed.add(m.name);
      remaining.splice(i, 1);
      progressed = true;
      i--;
    }
    if (!progressed) {
      throw new Error(`FK cycle not breakable via nullable FKs: ${remaining.map((m) => m.name)}`);
    }
  }
  return { order, deferred };
}

async function main() {
  const sqlite = new SqliteClient();
  const pg = new PgClient();
  const meta = readMeta();
  const { order, deferred } = plan(meta);
  const deferredByModel = new Map(deferred.map((d) => [d.model, d.fields]));

  console.log(`Models: ${meta.length} · copy order computed · deferred self/nullable FKs:`,
    deferred.map((d) => `${d.model}.${d.fields.join("/")}`).join(", ") || "none");

  const tables = order.map((m) => `"${m.table}"`).join(", ");
  console.log("Truncating PG side (idempotent re-run safety)...");
  await pg.$executeRawUnsafe(`TRUNCATE TABLE ${tables} CASCADE`);

  const patches: { model: string; idField: string; rows: Record<string, unknown>[] }[] = [];

  for (const m of order) {
    const rows: Record<string, unknown>[] = await (sqlite as any)[lc(m.name)].findMany();
    const deferFields = deferredByModel.get(m.name) ?? [];
    const patchRows: Record<string, unknown>[] = [];
    const cleaned = rows.map((r) => {
      const row: Record<string, unknown> = {};
      for (const f of m.scalarFields) row[f] = r[f];
      if (deferFields.length) {
        const patch: Record<string, unknown> = { [m.idField]: r[m.idField] };
        let needs = false;
        for (const f of deferFields) {
          if (row[f] != null) { patch[f] = row[f]; needs = true; }
          row[f] = null;
        }
        if (needs) patchRows.push(patch);
      }
      return row;
    });
    for (let i = 0; i < cleaned.length; i += BATCH) {
      await (pg as any)[lc(m.name)].createMany({
        data: cleaned.slice(i, i + BATCH),
        skipDuplicates: false,
      });
    }
    if (patchRows.length) patches.push({ model: m.name, idField: m.idField, rows: patchRows });
    console.log(`  ${m.name}: ${rows.length} copied`);
  }

  for (const p of patches) {
    console.log(`Pass 2 — patching ${p.model} (${p.rows.length} rows)`);
    for (const row of p.rows) {
      const { [p.idField]: id, ...data } = row;
      await (pg as any)[lc(p.model)].update({ where: { [p.idField]: id }, data });
    }
  }

  // No @default(autoincrement()) Int ids exist in this schema (verified via
  // DMMF below) — so there are no PG sequences to reset.
  const autoinc = meta.flatMap((m) =>
    Prisma.dmmf.datamodel.models
      .find((x) => x.name === m.name)!
      .fields.filter((f) => (f.default as any)?.name === "autoincrement")
      .map((f) => `${m.name}.${f.name}`)
  );
  const seqNote = autoinc.length
    ? `Sequences reset required for: ${autoinc.join(", ")} — NOT HANDLED, extend script!`
    : "No autoincrement ids in schema — no sequences to reset.";
  if (autoinc.length) throw new Error(seqNote);

  console.log("\nVerification:");
  const lines = ["# SQLite → Postgres migration counts", "", `Run: ${new Date().toISOString()}`, "",
    "| Model | sqlite | postgres | status |", "|---|---|---|---|"];
  let bad = 0;
  for (const m of order) {
    const a = await (sqlite as any)[lc(m.name)].count();
    const b = await (pg as any)[lc(m.name)].count();
    const ok = a === b;
    if (!ok) bad++;
    lines.push(`| ${m.name} | ${a} | ${b} | ${ok ? "MATCH" : "MISMATCH"} |`);
    console.log(`  ${ok ? "OK  " : "BAD "} ${m.name}: sqlite=${a} pg=${b}`);
  }
  lines.push("", seqNote, "", bad ? `RESULT: ${bad} MISMATCH(ES)` : "RESULT: ALL MATCH");
  const dir = join(process.cwd(), "..", "..", "VERIFICATION_PG");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "counts.md"), lines.join("\n") + "\n");
  console.log(`\nReport: VERIFICATION_PG/counts.md · ${bad ? `${bad} MISMATCH(ES)` : "ALL MATCH"}`);

  await sqlite.$disconnect();
  await pg.$disconnect();
  if (bad) process.exit(1);
}

function lc(s: string) { return s[0].toLowerCase() + s.slice(1); }

main().catch((e) => { console.error(e); process.exit(1); });
