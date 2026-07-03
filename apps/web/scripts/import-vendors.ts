/**
 * scripts/import-vendors.ts
 *
 * Idempotent upsert of Vendor rows from a JobTread vendor export.
 * Supports CSV (default) and JSON (detected by .json extension).
 *
 * Usage:
 *   npx ts-node --project tsconfig.json scripts/import-vendors.ts <path-to-file>
 *
 * Expected CSV columns (case-insensitive header matching):
 *   name            -- required; used as upsert key together with email
 *   email           -- optional; used as secondary upsert key
 *   trade           -- optional (e.g. "Electrical", "Plumbing")
 *   type            -- optional (e.g. "Subcontractor", "Supplier")
 *   officePhone     -- optional (also matched as "office_phone" or "phone")
 *   fax             -- optional
 *   division        -- optional (e.g. "Client Project")
 *   w9OnFile        -- optional boolean ("true"/"yes"/"1" = true)
 *   coiExpiresAt    -- optional ISO date string or MM/DD/YYYY
 *   notes           -- optional
 *
 * Expected JSON shape: array of objects with the same keys above.
 *
 * Records are matched on (name, email). If a match exists the row is updated;
 * otherwise a new Vendor is created. No records are ever deleted.
 *
 * No secrets, API keys, or hardcoded data in this file.
 * Supply the export file path as a CLI argument.
 */

import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ─── Column-name aliases ──────────────────────────────────────────────────────

const COL = {
  name:         ["name", "vendor_name", "company", "company_name"],
  email:        ["email", "email_address"],
  trade:        ["trade", "trade_type", "specialty"],
  type:         ["type", "vendor_type", "category"],
  officePhone:  ["officephone", "office_phone", "phone", "phone_number"],
  fax:          ["fax", "fax_number"],
  division:     ["division"],
  w9OnFile:     ["w9onfile", "w9_on_file", "w9", "has_w9"],
  coiExpiresAt: ["coiexpiresat", "coi_expires_at", "coi_expiry", "coi_expires", "coiexpiry", "insuranceexpiry", "insurance_expiry"],
  notes:        ["notes", "note", "comments"],
} as const;

function pick(row: Record<string, string>, aliases: readonly string[]): string | undefined {
  for (const alias of aliases) {
    const val = row[alias] ?? row[alias.toLowerCase()] ?? undefined;
    if (val !== undefined && val !== "") return val;
  }
  return undefined;
}

// ─── Date parsing ─────────────────────────────────────────────────────────────

function parseDate(raw: string | undefined): Date | null {
  if (!raw) return null;
  // Try MM/DD/YYYY
  const mmddyyyy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mmddyyyy) {
    const [, m, d, y] = mmddyyyy;
    return new Date(`${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}T00:00:00Z`);
  }
  // Try ISO or any format Date can parse
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

// ─── Boolean parsing ──────────────────────────────────────────────────────────

function parseBool(raw: string | undefined): boolean {
  if (!raw) return false;
  return ["true", "yes", "1", "y"].includes(raw.toLowerCase().trim());
}

// ─── CSV parser (no external deps) ───────────────────────────────────────────

function parseCSV(content: string): Record<string, string>[] {
  const lines = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  if (lines.length < 2) return [];

  // Parse header — normalize to lowercase, strip BOM
  const rawHeader = lines[0].replace(/^﻿/, "");
  const headers = rawHeader.split(",").map((h) => h.trim().replace(/^"|"$/g, "").toLowerCase());

  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    // Simple CSV split (handles quoted fields with embedded commas)
    const values: string[] = [];
    let inQuote = false;
    let cur = "";
    for (const ch of line) {
      if (ch === '"') { inQuote = !inQuote; }
      else if (ch === "," && !inQuote) { values.push(cur.trim()); cur = ""; }
      else { cur += ch; }
    }
    values.push(cur.trim());

    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = values[idx] ?? ""; });
    rows.push(row);
  }
  return rows;
}

// ─── Row → data shape ─────────────────────────────────────────────────────────

function rowToData(row: Record<string, string>) {
  return {
    name:         pick(row, COL.name)        ?? "",
    email:        pick(row, COL.email)       || null,
    trade:        pick(row, COL.trade)       || null,
    type:         pick(row, COL.type)        || null,
    officePhone:  pick(row, COL.officePhone) || null,
    fax:          pick(row, COL.fax)         || null,
    division:     pick(row, COL.division)    || null,
    w9OnFile:     parseBool(pick(row, COL.w9OnFile)),
    coiExpiresAt: parseDate(pick(row, COL.coiExpiresAt)),
    notes:        pick(row, COL.notes)       || null,
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Usage: npx ts-node scripts/import-vendors.ts <path-to-file>");
    process.exit(1);
  }

  const absPath = path.resolve(filePath);
  if (!fs.existsSync(absPath)) {
    console.error(`File not found: ${absPath}`);
    process.exit(1);
  }

  const content = fs.readFileSync(absPath, "utf-8");
  const ext = path.extname(absPath).toLowerCase();

  let rawRows: Record<string, string>[];
  if (ext === ".json") {
    const parsed = JSON.parse(content);
    if (!Array.isArray(parsed)) {
      console.error("JSON file must be an array of vendor objects");
      process.exit(1);
    }
    rawRows = parsed.map((item: unknown) => {
      if (typeof item !== "object" || !item) return {};
      return Object.fromEntries(
        Object.entries(item as Record<string, unknown>).map(([k, v]) => [k.toLowerCase(), String(v ?? "")])
      ) as Record<string, string>;
    });
  } else {
    rawRows = parseCSV(content);
  }

  console.log(`Loaded ${rawRows.length} rows from ${absPath}`);

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const raw of rawRows) {
    const data = rowToData(raw);
    if (!data.name) { skipped++; continue; }

    // Upsert key: name (+ email if present)
    const existing = await prisma.vendor.findFirst({
      where: {
        name: data.name,
        ...(data.email ? { email: data.email } : {}),
      },
    });

    if (existing) {
      await prisma.vendor.update({ where: { id: existing.id }, data });
      updated++;
    } else {
      await prisma.vendor.create({ data });
      created++;
    }
  }

  console.log(`\nImport complete:`);
  console.log(`  Created : ${created}`);
  console.log(`  Updated : ${updated}`);
  console.log(`  Skipped : ${skipped} (missing name)`);
  console.log(`  Total   : ${rawRows.length}`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  prisma.$disconnect();
  process.exit(1);
});
