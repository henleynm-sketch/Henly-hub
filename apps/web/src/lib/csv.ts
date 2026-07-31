export type CsvRow = Record<string, string>;

export function parseCsv(text: string): { headers: string[]; rows: CsvRow[] } {
  const lines = splitLines(text);
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = parseRow(lines[0]).map((h) => h.trim());
  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const cells = parseRow(lines[i]);
    const row: CsvRow = {};
    headers.forEach((h, idx) => {
      row[h] = (cells[idx] ?? "").trim();
    });
    rows.push(row);
  }
  return { headers, rows };
}

function splitLines(text: string): string[] {
  const out: string[] = [];
  let buf = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      inQuotes = !inQuotes;
      buf += c;
    } else if ((c === "\n" || c === "\r") && !inQuotes) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      out.push(buf);
      buf = "";
    } else {
      buf += c;
    }
  }
  if (buf.length) out.push(buf);
  return out;
}

function parseRow(line: string): string[] {
  const cells: string[] = [];
  let buf = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        buf += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === "," && !inQuotes) {
      cells.push(buf);
      buf = "";
    } else {
      buf += c;
    }
  }
  cells.push(buf);
  return cells;
}

const STAGE_MAP: Record<string, string> = {
  subscriber: "LEAD",
  lead: "LEAD",
  "marketing qualified lead": "QUALIFIED",
  mql: "QUALIFIED",
  "sales qualified lead": "QUALIFIED",
  sql: "QUALIFIED",
  opportunity: "PROPOSAL",
  "appointment scheduled": "QUALIFIED",
  "qualified to buy": "QUALIFIED",
  "presentation scheduled": "PROPOSAL",
  "decision maker bought-in": "PROPOSAL",
  "contract sent": "PROPOSAL",
  "closed won": "WON",
  "closed lost": "LOST",
  customer: "ACTIVE",
  "evangelist": "PAST",
  "other": "LEAD",
};

export function normalizeStage(raw: string | undefined | null): string {
  if (!raw) return "LEAD";
  const key = raw.toLowerCase().trim();
  if (STAGE_MAP[key]) return STAGE_MAP[key];
  const upper = key.toUpperCase().replace(/[\s-]/g, "_");
  const valid = ["LEAD", "QUALIFIED", "PROPOSAL", "WON", "LOST", "ACTIVE", "PAST"];
  if (valid.includes(upper)) return upper;
  return "LEAD";
}

// Normalizes a raw "Deal Stage" string from a HubSpot deal CSV to a Henley
// PIPELINE_STAGE constant (see src/lib/taxonomy.ts). Case-insensitive.
// Returns null when no match is found (caller should fall back to "New Lead").
export function normalizePipelineStage(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const key = raw.trim().toLowerCase();
  const map: Record<string, string> = {
    "new lead": "New Lead",
    "new": "New Lead",
    "contacted": "Contacted",
    "contact made": "Contacted",
    "consultation booked": "Consultation Booked",
    "consult booked": "Consultation Booked",
    "onsite consultation complete": "Onsite Consultation Complete",
    "onsite complete": "Onsite Consultation Complete",
    "design proposal sent": "Design Proposal Sent",
    "proposal sent": "Design Proposal Sent",
    "design proposal signed": "Design Proposal Signed",
    "proposal signed": "Design Proposal Signed",
    "onsite kickoff": "Onsite Kickoff",
    "kickoff": "Onsite Kickoff",
    "budget & drawings underway": "Budget & Drawings Underway",
    "budget and drawings underway": "Budget & Drawings Underway",
    "drawings underway": "Budget & Drawings Underway",
    "construction proposal sent": "Construction Proposal Sent",
    "construction proposal": "Construction Proposal Sent",
    "negotiation": "Negotiation",
    "closed won": "Closed Won",
    "won": "Closed Won",
    "closed lost": "Closed Lost",
    "lost": "Closed Lost",
  };
  return map[key] ?? null;
}

// Maps a normalized PIPELINE_STAGE to Project.status for the CRM board.
// "Closed Won"  -> "OPEN"    (contract signed; active project; shows in default board filter)
// "Closed Lost" -> "CLOSED"  (lost deal; hidden from default board filter)
// everything else -> "PRESALE" (pre-contract; shows in default board filter)
export function projectStatusForStage(stage: string | null): string {
  if (stage === "Closed Won") return "OPEN";
  if (stage === "Closed Lost") return "CLOSED";
  return "PRESALE";
}
