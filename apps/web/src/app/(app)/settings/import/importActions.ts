"use server";

import { auth } from "@/auth";
import { canManageTeam, type Role } from "@/lib/roles";
import { revalidatePath } from "next/cache";
import { runImport } from "@/lib/services/importService";
import {
  isValidImportSource,
  inferImportMapping,
  type ImportMapping,
  type ImportSummary,
} from "@/lib/importPresets";
import { parseCsv } from "@/lib/csv";

const MAX_CSV_BYTES = 5 * 1024 * 1024;

export type PreviewResult =
  | { ok: true; headers: string[]; mapping: ImportMapping; summary: ImportSummary }
  | { ok: false; error: string };

export type CommitResult = { ok: true; summary: ImportSummary } | { ok: false; error: string };

async function requireCeo() {
  const me = await auth();
  const role = me?.user?.role as Role | undefined;
  if (!role || !canManageTeam(role)) return null;
  return me!;
}

function validate(csvText: string, source: string): string | null {
  if (!csvText.trim()) return "CSV is empty";
  if (csvText.length > MAX_CSV_BYTES) return "CSV is larger than 5 MB";
  if (!isValidImportSource(source)) return "Unknown source preset";
  return null;
}

export async function inferMappingAction(
  csvText: string,
  source: string,
): Promise<{ ok: true; headers: string[]; mapping: ImportMapping } | { ok: false; error: string }> {
  const me = await requireCeo();
  if (!me) return { ok: false, error: "CEO only" };
  const invalid = validate(csvText, source);
  if (invalid || !isValidImportSource(source)) return { ok: false, error: invalid ?? "Unknown source preset" };
  const { headers } = parseCsv(csvText);
  if (headers.length === 0) return { ok: false, error: "No header row found" };
  return { ok: true, headers, mapping: inferImportMapping(headers, source) };
}

export async function previewImportAction(
  csvText: string,
  source: string,
  mapping: ImportMapping,
): Promise<PreviewResult> {
  const me = await requireCeo();
  if (!me) return { ok: false, error: "CEO only" };
  const invalid = validate(csvText, source);
  if (invalid) return { ok: false, error: invalid };
  const { headers } = parseCsv(csvText);
  const summary = await runImport(csvText, mapping, { write: false });
  return { ok: true, headers, mapping, summary };
}

export async function commitImportAction(
  csvText: string,
  source: string,
  mapping: ImportMapping,
): Promise<CommitResult> {
  const me = await requireCeo();
  if (!me) return { ok: false, error: "CEO only" };
  const invalid = validate(csvText, source);
  if (invalid) return { ok: false, error: invalid };
  const summary = await runImport(csvText, mapping, { write: true });
  revalidatePath("/clients");
  revalidatePath("/crm");
  revalidatePath("/jobs");
  revalidatePath("/financials");
  return { ok: true, summary };
}
