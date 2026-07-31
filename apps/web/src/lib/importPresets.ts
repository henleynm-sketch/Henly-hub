export const IMPORT_SOURCES = [
  "hubspot-contacts",
  "hubspot-deals",
  "buildertrend-jobs",
  "buildertrend-clients",
  "generic",
] as const;
export type ImportSource = (typeof IMPORT_SOURCES)[number];
export const isValidImportSource = (v: string): v is ImportSource =>
  (IMPORT_SOURCES as readonly string[]).includes(v);

export const IMPORT_SOURCE_LABELS: Record<ImportSource, string> = {
  "hubspot-contacts": "HubSpot contacts",
  "hubspot-deals": "HubSpot deals",
  "buildertrend-jobs": "BuilderTrend jobs",
  "buildertrend-clients": "BuilderTrend clients",
  generic: "Generic CSV",
};

export const IMPORT_FIELDS = [
  "name",
  "firstName",
  "lastName",
  "email",
  "phone",
  "address",
  "city",
  "state",
  "zip",
  "source",
  "stage",
  "notes",
  "jobName",
] as const;
export type ImportField = (typeof IMPORT_FIELDS)[number];

export const IMPORT_FIELD_LABELS: Record<ImportField, string> = {
  name: "Client name",
  firstName: "First name",
  lastName: "Last name",
  email: "Email",
  phone: "Phone",
  address: "Address",
  city: "City",
  state: "State / Province",
  zip: "Zip / Postal code",
  source: "Lead source",
  stage: "Pipeline stage",
  notes: "Notes",
  jobName: "Job name",
};

const BASE_ALIASES: Record<ImportField, string[]> = {
  name: ["name", "full name", "company name", "client", "customer", "display name"],
  firstName: ["first name", "given name", "fname"],
  lastName: ["last name", "surname", "lname", "family name"],
  email: ["email", "email address", "primary email", "e-mail"],
  phone: ["phone", "phone number", "primary phone", "mobile", "cell", "telephone"],
  address: ["address", "street address", "address line 1", "street"],
  city: ["city", "town"],
  state: ["state", "state/region", "region", "province"],
  zip: ["zip", "zip code", "postal code", "postcode"],
  source: ["source", "lead source", "original source", "original traffic source"],
  stage: ["stage", "lifecycle stage", "deal stage", "status"],
  notes: ["notes", "description", "comments", "about"],
  jobName: ["job name", "deal name", "project name", "job"],
};

const SOURCE_ALIASES: Record<ImportSource, Partial<Record<ImportField, string[]>>> = {
  "hubspot-contacts": {
    phone: ["phone number", "mobile phone number"],
    zip: ["postal code"],
    state: ["state/region"],
    stage: ["lifecycle stage", "lead status"],
    source: ["original source", "original traffic source"],
  },
  "hubspot-deals": {
    jobName: ["deal name"],
    stage: ["deal stage"],
    name: ["associated company", "associated contact", "associated company (primary)"],
    notes: ["deal description", "description"],
  },
  "buildertrend-jobs": {
    jobName: ["job name", "jobsite name", "job"],
    name: ["owner name", "customer name", "customer", "owner"],
    stage: ["job status", "status"],
    address: ["job address", "jobsite address", "street address"],
    phone: ["cell phone", "phone"],
  },
  "buildertrend-clients": {
    name: ["customer name", "owner name", "contact name"],
    phone: ["cell phone", "home phone", "phone"],
    email: ["email", "email address"],
  },
  generic: {},
};

export type ImportMapping = Partial<Record<ImportField, string | null>>;

export function inferImportMapping(headers: string[], source: ImportSource): ImportMapping {
  const lowerToOriginal = new Map<string, string>();
  for (const h of headers) lowerToOriginal.set(h.toLowerCase().trim(), h);
  const mapping: ImportMapping = {};
  for (const field of IMPORT_FIELDS) {
    const aliases = [...(SOURCE_ALIASES[source][field] ?? []), ...BASE_ALIASES[field]];
    const hit = aliases.find((a) => lowerToOriginal.has(a));
    mapping[field] = hit ? lowerToOriginal.get(hit)! : null;
  }
  return mapping;
}

export type ImportRowPreview = {
  index: number;
  name: string;
  email: string | null;
  phone: string | null;
  jobName: string;
  rawStage: string;
  pipelineStage: string | null;
  clientAction: "create" | "match-email" | "match-phone" | "match-name";
  jobAction: "create" | "skip-duplicate";
  nonDedupable: boolean;
};

export type ImportSummary = {
  rowsParsed: number;
  clientsCreated: number;
  clientsMatched: number;
  jobsCreated: number;
  jobsSkipped: number;
  engagementsCreated: number;
  unstaged: number;
  nonDedupable: number;
  skipped: { index: number; reason: string }[];
  preview: ImportRowPreview[];
  dryRun: boolean;
};
