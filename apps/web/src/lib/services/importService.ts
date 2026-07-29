import "server-only";
import { prisma } from "@/lib/prisma";
import {
  parseCsv,
  type CsvRow,
  normalizeStage,
  normalizePipelineStage,
  projectStatusForStage,
} from "@/lib/csv";
import type { ImportField, ImportMapping, ImportRowPreview, ImportSummary } from "@/lib/importPresets";

type RowData = {
  index: number;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  source: string | null;
  clientStage: string;
  notes: string | null;
  jobName: string;
  rawStage: string;
  pipelineStage: string | null;
};

function extractRow(row: CsvRow, mapping: ImportMapping, index: number): RowData | null {
  const get = (f: ImportField) => (mapping[f] ? (row[mapping[f]!] ?? "") : "").trim();
  const nameDirect = get("name");
  const name = nameDirect || [get("firstName"), get("lastName")].filter(Boolean).join(" ").trim();
  if (!name) return null;
  const rawStage = get("stage");
  return {
    index,
    name,
    email: get("email") || null,
    phone: get("phone") || null,
    address: get("address") || null,
    city: get("city") || null,
    state: get("state") || null,
    zip: get("zip") || null,
    source: get("source") || null,
    clientStage: normalizeStage(rawStage),
    notes: get("notes") || null,
    jobName: get("jobName") || name,
    rawStage,
    // Unknown or missing stage values stay null ("unstaged") — never silently
    // coerced to a real stage. The summary reports how many landed there.
    pipelineStage: normalizePipelineStage(rawStage),
  };
}

async function findClientId(
  data: RowData,
): Promise<{ id: string; via: "email" | "phone" | "name" } | null> {
  if (data.email) {
    const byEmail = await prisma.client.findFirst({
      where: { primaryEmail: data.email },
      select: { id: true },
    });
    if (byEmail) return { id: byEmail.id, via: "email" };
  }
  if (data.phone) {
    const byPhone = await prisma.client.findFirst({
      where: { primaryPhone: data.phone },
      select: { id: true },
    });
    if (byPhone) return { id: byPhone.id, via: "phone" };
  }
  const byName = await prisma.client.findFirst({
    where: { name: data.name },
    select: { id: true },
  });
  if (byName) return { id: byName.id, via: "name" };
  return null;
}

export async function runImport(
  csvText: string,
  mapping: ImportMapping,
  opts: { write: boolean },
): Promise<ImportSummary> {
  const { rows } = parseCsv(csvText);
  const summary: ImportSummary = {
    rowsParsed: rows.length,
    clientsCreated: 0,
    clientsMatched: 0,
    jobsCreated: 0,
    jobsSkipped: 0,
    engagementsCreated: 0,
    unstaged: 0,
    nonDedupable: 0,
    skipped: [],
    preview: [],
    dryRun: !opts.write,
  };

  // Dry-run must land on the same counts a real run would, so in-batch matches
  // (two rows sharing an email) are simulated with in-memory registries.
  const batchByEmail = new Map<string, string>();
  const batchByPhone = new Map<string, string>();
  const batchByName = new Map<string, string>();
  const batchJobs = new Set<string>();
  let virtualId = 0;

  for (let i = 0; i < rows.length; i++) {
    const data = extractRow(rows[i], mapping, i + 1);
    if (!data) {
      summary.skipped.push({ index: i + 1, reason: "No client name" });
      continue;
    }

    if (data.pipelineStage === null) summary.unstaged++;
    const nonDedupable = !data.email && !data.phone;
    if (nonDedupable) summary.nonDedupable++;

    let clientId: string;
    let clientAction: ImportRowPreview["clientAction"];
    const batchHit: { id: string; via: "email" | "phone" | "name" } | null =
      (data.email && batchByEmail.has(data.email)
        ? { id: batchByEmail.get(data.email)!, via: "email" as const }
        : null) ??
      (data.phone && batchByPhone.has(data.phone)
        ? { id: batchByPhone.get(data.phone)!, via: "phone" as const }
        : null) ??
      (batchByName.has(data.name)
        ? { id: batchByName.get(data.name)!, via: "name" as const }
        : null);
    const dbHit = batchHit ? null : await findClientId(data);

    if (batchHit) {
      clientId = batchHit.id;
      clientAction = `match-${batchHit.via}` as ImportRowPreview["clientAction"];
      summary.clientsMatched++;
    } else if (dbHit) {
      clientId = dbHit.id;
      clientAction = `match-${dbHit.via}` as ImportRowPreview["clientAction"];
      summary.clientsMatched++;
    } else {
      if (opts.write) {
        const created = await prisma.client.create({
          data: {
            name: data.name,
            primaryEmail: data.email,
            primaryPhone: data.phone,
            address: data.address,
            city: data.city,
            state: data.state,
            zip: data.zip,
            source: data.source,
            leadSource: data.source,
            stage: data.clientStage,
            notes: data.notes,
          },
          select: { id: true },
        });
        clientId = created.id;
      } else {
        clientId = `dry-${virtualId++}`;
      }
      clientAction = "create";
      summary.clientsCreated++;
      if (data.email) batchByEmail.set(data.email, clientId);
      if (data.phone) batchByPhone.set(data.phone, clientId);
      batchByName.set(data.name, clientId);
    }

    let jobAction: ImportRowPreview["jobAction"];
    const jobKey = `${clientId} ${data.jobName}`;
    const jobExists =
      batchJobs.has(jobKey) ||
      (clientAction !== "create" &&
        !!(await prisma.project.findFirst({
          where: { clientId, name: data.jobName },
          select: { id: true },
        })));
    if (jobExists) {
      jobAction = "skip-duplicate";
      summary.jobsSkipped++;
    } else {
      if (opts.write) {
        await prisma.project.create({
          data: {
            clientId,
            name: data.jobName,
            pipelineStage: data.pipelineStage,
            status: projectStatusForStage(data.pipelineStage),
            description: data.notes,
          },
        });
      }
      jobAction = "create";
      summary.jobsCreated++;
      batchJobs.add(jobKey);
    }

    if (summary.preview.length < 20) {
      summary.preview.push({
        index: data.index,
        name: data.name,
        email: data.email,
        phone: data.phone,
        jobName: data.jobName,
        rawStage: data.rawStage,
        pipelineStage: data.pipelineStage,
        clientAction,
        jobAction,
        nonDedupable,
      });
    }
  }

  return summary;
}
