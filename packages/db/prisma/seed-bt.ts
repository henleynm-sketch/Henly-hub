import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import * as XLSX from "xlsx";
import * as fs from "fs";
import * as path from "path";

const dbUrl = process.env.DATABASE_URL ?? "";
if (!dbUrl.startsWith("file:") && process.env.SEED_FORCE !== "1") {
  console.error(
    "SEED GUARD: DATABASE_URL points at a shared (non-sqlite) database. " +
    "Seeding would pollute LIVE shared data. Set SEED_FORCE=1 only if you are certain."
  );
  process.exit(1);
}

const prisma = new PrismaClient();

const IMPORTS_DIR = path.join(process.cwd(), "imports");

// -----------------------------------------------------------------------------
// Source-agnostic column aliases
// -----------------------------------------------------------------------------
// When we switch from BuilderTrend to JobTread (or anywhere else), the column
// names in the exports change but the underlying concepts don't. This map lets
// the seed read whichever column name is actually present in the file. Add the
// JT (or any other source's) names to each list and the seed adapts.

const COLUMN_ALIASES = {
  // Project / opportunity identification
  projectName: ["Project Name", "Opportunity Title", "Job", "Job Name", "Title", "Opportunity"],
  client: ["Client", "Client Name", "Customer", "Customer Name", "Contact"],
  clientFirstName: ["First Name", "Client First Name", "Customer First Name"],
  clientLastName: ["Last Name", "Client Last Name", "Customer Last Name", "Surname"],
  email: ["Email", "Email Address", "Client Email", "Primary Email"],
  phone: ["Phone", "Phone Number", "Primary Phone", "Cell", "Cell Phone", "Mobile"],
  address: ["Address", "Street Address", "Project Address", "Billing Address", "Billing Address*"],
  city: ["City", "Town", "City (Contact)", "City(Opp)"],
  state: ["State", "Province", "Prov", "Prov (Contact)", "Prov(Opp)"],
  zip: ["Zip", "Zip Code", "Postal", "Postal Code", "Postal (Contact)", "Postal(Opp)"],

  // Project metadata
  projectType: ["Project Type", "Type", "Job Type", "Project Type*"],
  status: ["Status", "Job Status", "Lead Status", "Phase", "Stage", "Current Phase"],
  nextStep: ["Next Step", "Critical Next Step", "Notes", "Action"],
  team: ["With", "PM(s)", "Owner", "Project Manager", "Salesperson", "Assigned To"],

  // Financials / dates
  estimatedRevenue: ["Est. Revenue", "Estimated Revenue", "Project Budget", "Estimated Budget", "Budget"],
  startDate: ["Proj. Start", "Projected Start", "Start Date", "Actual Start"],
  endDate: ["Proj. Completion", "Actual Completion", "End Date", "Completion Date", "Sold Date"],
  source: ["Source", "Lead Source", "Lead Source*", "Original Source", "Referral Source"],
  notes: ["Notes", "Description", "Comments", "Notes / Description"],
};

function pick(row: Record<string, any>, field: keyof typeof COLUMN_ALIASES): any {
  for (const alias of COLUMN_ALIASES[field]) {
    if (row[alias] !== null && row[alias] !== undefined && row[alias] !== "") return row[alias];
  }
  return null;
}

// -----------------------------------------------------------------------------
// XLSX helpers
// -----------------------------------------------------------------------------

function readSheet(filename: string, sheetName?: string, opts: { headerRow?: number } = {}): Record<string, any>[] {
  const fullPath = path.join(IMPORTS_DIR, filename);
  if (!fs.existsSync(fullPath)) {
    console.warn(`  (skipping ${filename} — file not found in /imports/)`);
    return [];
  }
  const wb = XLSX.readFile(fullPath, { cellDates: true });
  const sn = sheetName ?? wb.SheetNames[0];
  const ws = wb.Sheets[sn];
  if (!ws) {
    console.warn(`  (skipping ${filename}:${sn} — sheet not found)`);
    return [];
  }
  const range = opts.headerRow ? opts.headerRow - 1 : 0;
  return XLSX.utils.sheet_to_json(ws, { defval: null, raw: false, range }) as Record<string, any>[];
}

// -----------------------------------------------------------------------------
// Normalization
// -----------------------------------------------------------------------------

function normalizePhone(p: string | null | undefined): string {
  if (!p) return "";
  return String(p).replace(/\D/g, "");
}

function formatPhone(p: string | null | undefined): string | null {
  if (!p) return null;
  const d = normalizePhone(p);
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith("1")) return `+${d}`;
  return String(p);
}

function parseRevenue(s: string | null | undefined): { min: number; max: number } {
  if (!s) return { min: 0, max: 0 };
  const cleaned = String(s).replace(/[\$,\s]/g, "");
  const parts = cleaned.split("-").map((p) => parseFloat(p));
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    return { min: parts[0], max: parts[1] };
  }
  const single = parseFloat(cleaned);
  if (!isNaN(single)) return { min: single, max: single };
  return { min: 0, max: 0 };
}

function parseStage(btStage: string | null | undefined): string {
  if (!btStage) return "LEAD";
  const s = String(btStage).toLowerCase();
  if (s.includes("1.1")) return "LEAD";
  if (s.includes("1.2")) return "ONSITE_CONSULT";
  if (s.includes("1.3")) return "DESIGN_PROPOSAL";
  if (s.includes("1.4")) return "PROPOSAL_SENT";
  if (s.includes("on hold")) return "ON_HOLD";
  if (s.includes("sold")) return "SOLD";
  if (s.includes("lost")) return "LOST";
  if (s.includes("no opportunity")) return "DEAD";
  return "LEAD";
}

function inferProjectStatus(currentPhase: string | null | undefined): string {
  if (!currentPhase) return "PLANNING";
  const p = currentPhase.toLowerCase();
  if (p.includes("on hold")) return "ON_HOLD";
  if (p.includes("warranty")) return "WARRANTY";
  if (p.includes("closing") || p.includes("close")) return "CLOSING";
  if (p.includes("finishing") || p.includes("finishings") || p.includes("90%") || p.includes("80%") || p.includes("10%") || p.includes("completion")) return "FINISHING";
  if (p.includes("construction") || p.includes("taping") || p.includes("drywall") || p.includes("framing") || p.includes("insulation")) return "IN_PROGRESS";
  if (p.includes("permitting") || p.includes("permit")) return "PERMITTING";
  if (p.includes("design") || p.includes("budget") || p.includes("drawings") || p.includes("proposal") || p.includes("selections") || p.includes("ordering") || p.includes("home care")) return "DESIGN";
  if (p.includes("negotiation") || p.includes("invoicing")) return "DESIGN";
  if (p.includes("scope") || p.includes("warranty adj")) return "WARRANTY";
  return "PLANNING";
}

function lastNameFromProjectName(name: string): string {
  // "Knight, Curtis - 42 Waywell St" → "Knight"
  const beforeComma = name.split(",")[0]?.trim();
  if (beforeComma && !beforeComma.includes(" ")) return beforeComma;
  // "22 Bayview Lane - Matthews" → "Matthews"
  const afterDash = name.split(" - ").pop()?.trim();
  if (afterDash && /^[A-Za-z]/.test(afterDash) && !afterDash.match(/\d/)) {
    return afterDash.split(/\s+/).pop() ?? "";
  }
  return beforeComma ?? "";
}

function clientNameFromProjectLabel(label: string): string {
  // "Knight, Curtis - 42 Waywell St" → "Curtis Knight"
  const m = label.match(/^([A-Za-z'-]+),\s*([A-Za-z' &]+?)\s*-\s*(.+)$/);
  if (m) {
    const last = m[1].trim();
    const first = m[2].trim();
    return `${first} ${last}`;
  }
  return label;
}

// -----------------------------------------------------------------------------
// Quo SMS data (preserved from previous seed — these conversations are real)
// -----------------------------------------------------------------------------

type Conversation = {
  phone: string;
  fromName: string;
  matchSurname?: string;
  kind: "CLIENT" | "SUB" | "NOISE";
  messages: { direction: "IN" | "OUT"; ts: string; body: string }[];
};

const CONVERSATIONS: Conversation[] = [
  {
    phone: "+12898304620", fromName: "Sean Foehner", matchSurname: "Foehner", kind: "CLIENT",
    messages: [
      { direction: "OUT", ts: "2026-04-02T14:13:58.953Z", body: "Hi Sean, this is Victoria from Henley Contracting. I hope you've had a great week! \n\nWe would like to set up a meeting with you and Sherri next week to go through our construction proposal." },
      { direction: "IN", ts: "2026-04-02T16:12:20.421Z", body: "Hi Victoria. That would be great. What time are you available? Where would you like to meet?" },
      { direction: "OUT", ts: "2026-04-13T18:11:02.271Z", body: "Hey Sean, happy Monday! This phone number is our team texting line we use to communicate with customers. The 6003 number you have is Nicks direct phone and text line. Sorry for any confusion! \n\nSee you Thursday! -Victoria" },
      { direction: "IN", ts: "2026-04-15T21:52:30.611Z", body: "Hi Victoria. Any chance we can move up tomorrow's meeting?" },
      { direction: "OUT", ts: "2026-04-15T23:54:49.858Z", body: "No problem I've moved you up to 9am. Have a great evening!" },
      { direction: "IN", ts: "2026-04-15T23:55:06.410Z", body: "Thank you" },
    ],
  },
  {
    phone: "+14168826377", fromName: "Linda Paterson-Bier", matchSurname: "Paterson", kind: "CLIENT",
    messages: [
      { direction: "IN", ts: "2026-03-25T19:02:27.243Z", body: "Hi Victoria, it's Linda Paterson Bier" },
      { direction: "OUT", ts: "2026-03-25T19:25:45.152Z", body: "Hi Linda! Great speaking with you today. Excellent, thanks for sharing! I am sending the calendar link to our call now." },
      { direction: "IN", ts: "2026-03-26T15:30:09.424Z", body: "Bar seating on each side of double door" },
      { direction: "IN", ts: "2026-03-26T15:31:37.620Z", body: "Railing style on upper decking" },
      { direction: "OUT", ts: "2026-03-26T17:04:41.931Z", body: "Oh I love!! Serena and Lily it's just soo good!" },
      { direction: "IN", ts: "2026-05-04T16:48:43.411Z", body: "Hi Victoria, \nWe are back from Hawaii. Wondering if we can do our second meeting soon so we can keep the ball rolling on the boathouse." },
    ],
  },
  {
    phone: "+16472724955", fromName: "Bryce Marshall", matchSurname: "Marshall", kind: "CLIENT",
    messages: [
      { direction: "OUT", ts: "2026-03-05T21:41:09.634Z", body: "Hi Bryce, I'm Victoria from the Henley team. I received your voicemail looking for someone from our team to check out some structural issues." },
      { direction: "IN", ts: "2026-03-10T13:16:16.268Z", body: "Hi Victoria. Can I give you a call today?" },
      { direction: "OUT", ts: "2026-03-17T21:16:06.160Z", body: "Hey Bryce, great to finally connect with you! I have sent a tentative calendar invite holding and onsite consultation meeting for Monday March 23, 12:30-1:30 to your email address marshallbhh@gmail.com" },
      { direction: "IN", ts: "2026-03-17T23:05:10.248Z", body: "Confirmed. Good for next Monday at 1230." },
    ],
  },
  {
    phone: "+19055501359", fromName: "David Byrne", matchSurname: "Byrne", kind: "CLIENT",
    messages: [
      { direction: "OUT", ts: "2026-04-15T20:34:13.273Z", body: "Okay great! I don't have an email on file to send this teams meeting invite to. Could you please send your email?" },
      { direction: "IN", ts: "2026-04-15T20:52:09.726Z", body: "davidbyrnetwo@gmail.com" },
      { direction: "OUT", ts: "2026-04-15T20:52:53.743Z", body: "Wonderful sending now!" },
      { direction: "IN", ts: "2026-04-15T21:03:02.597Z", body: "Our computer is having trouble with Teams." },
    ],
  },
  {
    phone: "+19052601263", fromName: "Aunt Jan (Janet Knowler)", matchSurname: "Knowler", kind: "CLIENT",
    messages: [
      { direction: "OUT", ts: "2026-04-10T16:29:32.772Z", body: "Hi there Auntie Jan this is Nick! This is our office line I'm going to connect you on here to Victoria she's going to gather some information and we're going to get your projects all scheduled for this spring." },
      { direction: "IN", ts: "2026-05-01T17:53:02.440Z", body: "Hi Nick. Am I still on the list?" },
      { direction: "IN", ts: "2026-05-04T12:30:10.441Z", body: "I was wondering if my projects will fit into your schedule for spring. I heard from Victoria on April 13th. Nothing since." },
      { direction: "OUT", ts: "2026-05-04T16:41:12.001Z", body: "hi Aunt Jan!! Yes you are!" },
    ],
  },
  {
    phone: "+14163999931", fromName: "Tom (Balsam garage lead)", kind: "CLIENT",
    messages: [
      { direction: "OUT", ts: "2026-05-05T18:47:11.786Z", body: "hi Tom, this is Nick Henley, Mike's son. This is our office line. Do you have a survey for your property on Balsam?" },
      { direction: "IN", ts: "2026-05-05T23:48:48.557Z", body: "Nick,\nThe premise for the new garage is bringing a car (23 years old and special to me) back from Florida. It is a complicated process I am working through as it is now registered there, but was originally a Canadian car I sent there 10 years ago.\nLet's hold off on any more work until I get some certainty." },
    ],
  },
  {
    phone: "+19059273134", fromName: "Lucy (4 Wylie Lane)", kind: "CLIENT",
    messages: [
      { direction: "OUT", ts: "2026-04-13T21:49:10.519Z", body: "Hi Lucy this is Nick Henley from Henley Contracting were the builder for 4 Wylie Lane in stouffville" },
    ],
  },
  {
    phone: "+19052591984", fromName: "Chris (tree removal sub)", kind: "SUB",
    messages: [
      { direction: "OUT", ts: "2026-05-05T19:27:43.813Z", body: "hi Chris, this is Nick Henley, this is our office, can you go by 135 Ridge Dr on Balsam Lake, the client marked a bunch of tree's to be removed." },
      { direction: "IN", ts: "2026-05-12T21:07:55.354Z", body: "Hey Nick, \nI stopped by that site last week. \n\nIt would be about 6400$ to get that stuff down and out of there. Not including any stump grinding." },
    ],
  },
  {
    phone: "+19056221776", fromName: "Peter (HVAC sub)", kind: "SUB",
    messages: [
      { direction: "OUT", ts: "2026-05-04T16:40:54.487Z", body: "Hi Peter, this is Nick Henley, did we have an HVAC design for 10201 Mud Lake Road?" },
      { direction: "IN", ts: "2026-05-04T17:37:01.174Z", body: "All sent." },
    ],
  },
  {
    phone: "+19054320531", fromName: "Joe (septic permits sub)", kind: "SUB",
    messages: [
      { direction: "OUT", ts: "2026-05-04T16:40:23.600Z", body: "hi Joe, this is Nick Henley, Did we get the septic permit for 10201 Mudlake Road." },
      { direction: "IN", ts: "2026-05-04T16:42:50.867Z", body: "It went through port Perry office so it would be from crystal Williams" },
    ],
  },
  {
    phone: "+14168177017", fromName: "Wrong number", kind: "NOISE",
    messages: [
      { direction: "IN", ts: "2026-03-13T01:00:54.667Z", body: "I don't think you meant this for me!" },
      { direction: "IN", ts: "2026-03-13T01:01:35.461Z", body: "Oh jeez I meant this for my husband, not for you!! Sorry." },
    ],
  },
  {
    phone: "+15077096859", fromName: "Spam", kind: "NOISE",
    messages: [{ direction: "IN", ts: "2026-04-30T17:23:45.785Z", body: "do u still need work.?" }],
  },
  {
    phone: "+17163551654", fromName: "Recruiter spam", kind: "NOISE",
    messages: [{ direction: "IN", ts: "2026-05-10T20:44:38.267Z", body: "Hey, remote role openings are available actually, can I provide further information?" }],
  },
];

// -----------------------------------------------------------------------------
// Main seed
// -----------------------------------------------------------------------------

async function main() {
  console.log("Wiping all existing data...");
  await prisma.message.deleteMany();
  await prisma.thread.deleteMany();
  await prisma.estimateLine.deleteMany();
  await prisma.estimate.deleteMany();
  await prisma.dailyLog.deleteMany();
  await prisma.budgetItem.deleteMany();
  await prisma.selection.deleteMany();
  await prisma.milestone.deleteMany();
  await prisma.document.deleteMany();
  await prisma.projectAssignment.deleteMany();
  await prisma.project.deleteMany();
  await prisma.user.deleteMany();
  await prisma.client.deleteMany();

  const pw = await bcrypt.hash("demo", 10);

  console.log("Creating real Henley team users...");
  const nick = await prisma.user.create({ data: { email: "nick@henleycontracting.com", name: "Nick Henley", passwordHash: pw, role: "CEO", focusArea: "Sales & Owner", phone: "+19052446003" } });
  const mike = await prisma.user.create({ data: { email: "mike@henleycontracting.com", name: "Mike Henley", passwordHash: pw, role: "CEO", focusArea: "Owner / Production", phone: "+19052600358" } });
  const victoria = await prisma.user.create({ data: { email: "victoria@henleycontracting.com", name: "Victoria Leask", passwordHash: pw, role: "OFFICE", focusArea: "Client Experience Concierge" } });
  const rui = await prisma.user.create({ data: { email: "rui@henleycontracting.com", name: "Rui Tomas", passwordHash: pw, role: "OFFICE", focusArea: "Project Management (Lead)" } });
  const ashley = await prisma.user.create({ data: { email: "ashley@henleycontracting.com", name: "Ashley Vigilante", passwordHash: pw, role: "OFFICE", focusArea: "Permits & Admin" } });
  const michelle = await prisma.user.create({ data: { email: "michelle@henleycontracting.com", name: "Michelle Dobson", passwordHash: pw, role: "OFFICE", focusArea: "Design Coordination" } });
  const andrew = await prisma.user.create({ data: { email: "andrew@henleycontracting.com", name: "Andrew Bapst", passwordHash: pw, role: "OFFICE", focusArea: "Project Management" } });
  const siteSup = await prisma.user.create({ data: { email: "site@henleycontracting.com", name: "Site Crew", passwordHash: pw, role: "FIELD", focusArea: "Field / Production" } });

  // -----------------------------------------------------------------------
  // Read source files
  // -----------------------------------------------------------------------
  console.log("\nReading source files from /imports/...");

  const btClients = readSheet("bt-client-contacts.xlsx", "Client Contacts", { headerRow: 2 });
  const btLeads = readSheet("bt-leads.xlsx", "Leads", { headerRow: 2 });
  const tracker = readSheet("project-milestones.xlsx", "Tracker (New)");
  const pipeline = readSheet("project-milestones.xlsx", "Sales Pipeline");
  const construction = readSheet("project-milestones.xlsx", "Construction & Warranty", { headerRow: 3 });
  const soldLeads = readSheet("project-milestones.xlsx", "Sold Leads", { headerRow: 2 });

  console.log(`  BT Customers:       ${btClients.length}`);
  console.log(`  BT Leads:           ${btLeads.length}`);
  console.log(`  Tracker (active):   ${tracker.length}`);
  console.log(`  Sales Pipeline:     ${pipeline.length}`);
  console.log(`  Construction/Warr.: ${construction.length}`);
  console.log(`  Sold Leads:         ${soldLeads.length}`);

  // -----------------------------------------------------------------------
  // Build client + project records from Tracker (the operational truth)
  // -----------------------------------------------------------------------
  console.log("\nBuilding active projects from Tracker (New)...");

  const clientByName = new Map<string, string>();
  const clientBySurname = new Map<string, string>();
  const clientByPhone = new Map<string, string>();

  async function ensureClient(opts: {
    name: string;
    surname?: string;
    email?: string | null;
    phone?: string | null;
    city?: string | null;
    stage: string;
    source?: string | null;
    notes?: string | null;
  }): Promise<string> {
    const existing = clientByName.get(opts.name);
    if (existing) return existing;
    const phone = formatPhone(opts.phone);
    const c = await prisma.client.create({
      data: {
        name: opts.name,
        primaryEmail: opts.email ?? null,
        primaryPhone: phone,
        city: opts.city ?? null,
        stage: opts.stage,
        source: opts.source ?? null,
        notes: opts.notes ?? null,
      },
    });
    clientByName.set(opts.name, c.id);
    if (opts.surname) {
      const surnameVariants = new Set<string>();
      surnameVariants.add(opts.surname.toLowerCase());
      // Hyphenated names: index each part as well as the whole
      for (const part of opts.surname.split(/[-\s]/)) {
        if (part.length >= 3) surnameVariants.add(part.toLowerCase());
      }
      for (const v of surnameVariants) {
        if (!clientBySurname.has(v)) clientBySurname.set(v, c.id);
      }
    }
    if (phone) clientByPhone.set(normalizePhone(phone), c.id);
    return c.id;
  }

  function lookupClientBySurname(surname: string): string | null {
    return clientBySurname.get(surname.toLowerCase()) ?? null;
  }

  // Index Sales Pipeline by surname for cross-referencing (provides est. revenue, source, etc.)
  const pipelineByLabel = new Map<string, any>();
  for (const row of pipeline) {
    const opp = String(row["Opportunity"] ?? "").trim();
    if (opp) pipelineByLabel.set(opp, row);
  }

  // Index Construction & Warranty by job name for cross-ref
  const constructionByLabel = new Map<string, any>();
  for (const row of construction) {
    const job = String(row["Job"] ?? "").trim();
    if (job) constructionByLabel.set(job, row);
  }

  // Index BT customers by full name for phone/email lookup
  const btClientByName = new Map<string, any>();
  for (const row of btClients) {
    const fn = String(row["First Name"] ?? "").trim();
    const ln = String(row["Last Name"] ?? "").trim();
    const fullName = `${fn} ${ln}`.trim();
    if (fullName) btClientByName.set(fullName.toLowerCase(), row);
    const rawName = String(row["Name"] ?? "").trim();
    if (rawName && rawName !== fullName) btClientByName.set(rawName.toLowerCase(), row);
  }

  // Section dividers in the tracker — skip these
  const SKIP_TRACKER = new Set(["CONSTRUCTION PROJECTS", "Project Name", ""]);

  let trackerProjectCount = 0;
  for (const row of tracker) {
    const label = String(row["Project Name"] ?? "").trim();
    if (!label || SKIP_TRACKER.has(label)) continue;

    const clientName = clientNameFromProjectLabel(label);
    const surname = lastNameFromProjectName(label);
    const projectAddr = label.includes(" - ") ? label.split(" - ").slice(1).join(" - ").trim() : "";
    const town = row["Town"] ?? null;
    const projectType = row["Type"] ?? null;
    const currentPhase = row["Current Phase"] ?? null;
    const nextStep = row["Next Step"] ?? null;
    const team = row["With"] ?? null;

    // Lookup BT customer for contact info
    const btMatch = btClientByName.get(clientName.toLowerCase()) ?? btClientByName.get(surname.toLowerCase());
    const email = btMatch?.["Email"] ?? null;
    const phone = btMatch?.["Cell"] ?? btMatch?.["Phone"] ?? null;
    const stage = currentPhase && String(currentPhase).toLowerCase().includes("on hold") ? "ON_HOLD" : "ACTIVE";

    const status = inferProjectStatus(currentPhase);

    const pipelineMatch = pipelineByLabel.get(label);
    const constructionMatch = constructionByLabel.get(label) ?? constructionByLabel.get(`${projectAddr} - ${surname}`);

    const startDate = constructionMatch?.["Actual Start"] ?? constructionMatch?.["Proj. Start"] ?? pipelineMatch?.["Created"] ?? null;
    const targetEnd = constructionMatch?.["Proj. Completion"] ?? null;
    const actualEnd = constructionMatch?.["Actual Completion"] ?? null;

    const cid = await ensureClient({
      name: clientName,
      surname,
      email,
      phone,
      city: town,
      stage,
      source: pipelineMatch?.["Lead Source"] ?? null,
      notes: constructionMatch?.["Notes"] ?? null,
    });

    const project = await prisma.project.create({
      data: {
        clientId: cid,
        name: label,
        address: projectAddr || null,
        city: town,
        projectType,
        status,
        currentPhase,
        nextStep,
        team,
        startDate: startDate ? new Date(startDate) : null,
        targetEnd: targetEnd ? new Date(targetEnd) : null,
        actualStart: constructionMatch?.["Actual Start"] ? new Date(constructionMatch["Actual Start"]) : null,
        actualEnd: actualEnd ? new Date(actualEnd) : null,
      },
    });

    // Create Milestone records from the Tracker's milestone columns
    const milestoneColumns = [
      "Prelim Designs",
      "Preliminary Estimating",
      "Deposit for Construction",
      "Detailed Design",
      "Detailed Estimating",
      "Permitting",
      "Selections",
      "Contracts",
      "Final Package",
    ];
    for (let i = 0; i < milestoneColumns.length; i++) {
      const col = milestoneColumns[i];
      const raw = row[col];
      if (raw === null || raw === undefined || raw === "" || raw === "Blank") continue;
      const v = String(raw).trim();
      let status: string;
      let dueDate: Date | null = null;
      if (raw instanceof Date) {
        status = "DONE";
        dueDate = raw;
      } else if (v.toLowerCase() === "complete" || v.toLowerCase() === "yes") {
        status = "DONE";
      } else if (v.toLowerCase() === "start" || v.toLowerCase() === "pending") {
        status = "PENDING";
      } else if (v.toLowerCase().includes("progress") || v.toLowerCase() === "run the prompt") {
        status = "IN_PROGRESS";
      } else {
        status = "PENDING";
      }
      await prisma.milestone.create({
        data: {
          projectId: project.id,
          title: col,
          status,
          order: i,
          clientVisible: true,
          dueDate,
        },
      });
    }
    trackerProjectCount += 1;
  }
  console.log(`  Created ${trackerProjectCount} active projects from Tracker (with milestone tracking).`);

  // -----------------------------------------------------------------------
  // Add Construction-only projects (not in Tracker but appear in C&W sheet)
  // -----------------------------------------------------------------------
  console.log("\nAdding construction-only projects (warranty, completed builds not on Tracker)...");
  let constrOnlyCount = 0;

  // Build a set of tracker projects keyed by (surname, address-fingerprint)
  const trackerFingerprints = new Set<string>();
  for (const r of tracker) {
    const label = String(r["Project Name"] ?? "").trim();
    if (!label || SKIP_TRACKER.has(label)) continue;
    const sur = lastNameFromProjectName(label).toLowerCase();
    // Extract numeric portion of address as additional key
    const addrMatch = label.match(/\b(\d+[A-Za-z]?)\s+([A-Za-z]+)/);
    const addrKey = addrMatch ? `${addrMatch[1]}-${addrMatch[2].toLowerCase()}` : "";
    if (sur) trackerFingerprints.add(`sur:${sur}`);
    if (addrKey) trackerFingerprints.add(`addr:${addrKey}`);
  }

  for (const row of construction) {
    const job = String(row["Job"] ?? "").trim();
    if (!job) continue;

    // Extract surname and address from C&W naming "ADDRESS - LASTNAME"
    const constrSurname = lastNameFromProjectName(job).toLowerCase();
    const constrAddrMatch = job.match(/\b(\d+[A-Za-z]?)\s+([A-Za-z]+)/);
    const constrAddrKey = constrAddrMatch ? `${constrAddrMatch[1]}-${constrAddrMatch[2].toLowerCase()}` : "";

    const surMatch = constrSurname && trackerFingerprints.has(`sur:${constrSurname}`);
    const addrMatch = constrAddrKey && trackerFingerprints.has(`addr:${constrAddrKey}`);
    if (surMatch || addrMatch) continue;

    const clientName = String(row["Client"] ?? "").trim();
    if (!clientName) continue;

    // "Anderson (Nelson family)" → "Anderson"; "Paul & Teresa Joblin" stays
    const cleanClient = clientName.replace(/\s*\(.+?\)\s*$/, "").trim();
    const parts = cleanClient.split(/\s+/);
    const surname = parts[parts.length - 1];

    const cid = await ensureClient({
      name: cleanClient,
      surname,
      city: row["City"] ?? null,
      stage: row["Status"] === "WARRANTY" || String(row["Phase"] ?? "").toLowerCase().includes("warranty") ? "WARRANTY" : "ACTIVE",
      notes: row["Notes"] ?? null,
    });

    await prisma.project.create({
      data: {
        clientId: cid,
        name: job,
        address: row["Address"] ?? null,
        city: row["City"] ?? null,
        projectType: row["Job Type"] ?? null,
        status: inferProjectStatus(row["Phase"]),
        currentPhase: row["Phase"] ?? null,
        nextStep: row["Critical Next Step"] ?? null,
        team: row["PM(s)"] ?? null,
        startDate: row["Proj. Start"] ? new Date(row["Proj. Start"]) : null,
        actualStart: row["Actual Start"] ? new Date(row["Actual Start"]) : null,
        targetEnd: row["Proj. Completion"] ? new Date(row["Proj. Completion"]) : null,
        actualEnd: row["Actual Completion"] ? new Date(row["Actual Completion"]) : null,
      },
    });
    constrOnlyCount += 1;
  }
  console.log(`  Created ${constrOnlyCount} construction-only projects.`);

  // -----------------------------------------------------------------------
  // Add sales pipeline opportunities as Lead clients (those not yet matched)
  // -----------------------------------------------------------------------
  console.log("\nAdding sales pipeline leads...");
  let pipelineLeadCount = 0;
  for (const row of pipeline) {
    const opp = String(row["Opportunity"] ?? "").trim();
    if (!opp) continue;

    // If already created as part of tracker, skip
    const surname = lastNameFromProjectName(opp);
    if (clientByName.has(clientNameFromProjectLabel(opp))) continue;

    const clientField = String(row["Client"] ?? "").trim();
    const clientName = clientField || clientNameFromProjectLabel(opp);
    const stage = parseStage(row["Stage"]);
    const town = row["Town"] ?? null;
    const projType = row["Project Type"] ?? null;
    const owner = row["Owner"] ?? null;
    const nextStep = row["Next Step"] ?? null;
    const revStr = row["Est. Revenue"] ?? "";
    const conf = row["Confidence %"] ?? null;
    const notes = row["Notes"] ?? null;

    const cid = await ensureClient({
      name: clientName,
      surname,
      city: town,
      stage,
      source: row["Lead Source"] ?? null,
      notes: notes ? String(notes) : null,
    });

    const { min, max } = parseRevenue(revStr);
    await prisma.project.create({
      data: {
        clientId: cid,
        name: opp,
        address: opp.includes(" - ") ? opp.split(" - ").slice(1).join(" - ").trim() : null,
        city: town,
        projectType: projType,
        status: "PLANNING",
        currentPhase: row["Stage"] ?? null,
        nextStep: nextStep ? String(nextStep) : null,
        team: owner ? String(owner) : null,
        budgetCents: Math.round(min * 100),
        contractCents: Math.round(max * 100),
        description: conf ? `Confidence: ${Math.round(parseFloat(conf) * 100)}%${revStr ? `; Est. revenue: ${revStr}` : ""}` : null,
      },
    });
    pipelineLeadCount += 1;
  }
  console.log(`  Created ${pipelineLeadCount} pipeline lead projects.`);

  // -----------------------------------------------------------------------
  // Add BT customers not yet imported (historical, no active project)
  // -----------------------------------------------------------------------
  console.log("\nAdding BT historical customers (no active project)...");
  let histClientCount = 0;
  for (const row of btClients) {
    const fn = String(row["First Name"] ?? "").trim();
    const ln = String(row["Last Name"] ?? "").trim();
    const name = String(row["Name"] ?? `${fn} ${ln}`.trim());
    if (!name) continue;
    if (clientByName.has(name)) continue;
    if (fn && ln && clientByName.has(`${fn} ${ln}`)) continue;

    const activation = String(row["Activation Status"] ?? "").trim();
    const jobs = Number(row["Jobs"] ?? 0);
    const leadsCount = Number(row["Lead Opportunities"] ?? 0);

    // Heuristic stage
    let stage = "PAST";
    if (activation === "Active") stage = "ACTIVE";
    else if (activation === "Pending") stage = "LEAD";
    else if (jobs === 0 && leadsCount > 0) stage = "DEAD";
    else if (jobs > 0) stage = "PAST";

    await ensureClient({
      name,
      surname: ln || lastNameFromProjectName(name),
      email: row["Email"] ?? null,
      phone: row["Cell"] ?? row["Phone"] ?? null,
      city: row["City"] ?? null,
      stage,
      notes: jobs > 0 ? `BT: ${jobs} job(s), ${leadsCount} lead opportunity(ies)` : null,
    });
    histClientCount += 1;
  }
  console.log(`  Created ${histClientCount} historical clients.`);

  // -----------------------------------------------------------------------
  // Project enrichment — SMS-grounded milestones + daily logs
  // -----------------------------------------------------------------------
  console.log("\nAdding project-specific milestones and daily logs from SMS context...");

  const today = new Date();
  const addDays = (n: number) => { const d = new Date(today); d.setDate(d.getDate() + n); return d; };

  async function findProjectByContains(needle: string) {
    return prisma.project.findFirst({ where: { name: { contains: needle } } });
  }

  async function addExtraMilestones(projectId: string, items: [string, string, number, boolean?][], baseOrder = 100) {
    for (let i = 0; i < items.length; i++) {
      const [title, status, dayOffset, clientVisible] = items[i];
      await prisma.milestone.create({
        data: {
          projectId,
          title,
          status,
          order: baseOrder + i,
          dueDate: addDays(dayOffset),
          clientVisible: clientVisible ?? false,
        },
      });
    }
  }

  async function addLog(projectId: string, authorId: string, dayOffset: number, notes: string, clientVisible: boolean) {
    await prisma.dailyLog.create({
      data: {
        projectId,
        authorId,
        date: addDays(dayOffset),
        notes,
        clientVisible,
      },
    });
  }

  const matthewsAddition = await findProjectByContains("22 Bayview Lane");
  if (matthewsAddition) {
    await addExtraMilestones(matthewsAddition.id, [
      ["Revised drawings to building inspector", "DONE", -125, true],
      ["Backfill inspection complete", "DONE", -125, true],
      ["Truss & lintel details to Glen (engineer)", "DONE", -105, false],
      ["Bayview window updates ordered", "DONE", -85, false],
      ["Schedule 1 form signed by Glen", "IN_PROGRESS", 3, false],
      ["Schedule 1 form resubmitted to permit office", "PENDING", 5, false],
      ["Permit resubmission for detached garage", "IN_PROGRESS", 7, true],
      ["Approve 9 garage POs (~$154K)", "IN_PROGRESS", 5, false],
    ]);
    await addLog(matthewsAddition.id, ashley.id, -2, "Followed up with Adam on Schedule 1 — he has it filled out, just needs Glen's signature. Will receive completed form for resubmission. Permit review initiated with original drawings.", false);
    await addLog(matthewsAddition.id, mike.id, -105, "Specced truss & lintel details for second-floor garage windows — windows increased in size during change order, need confirmation that lintels were spec'd accordingly. Sent details to Glen for review.", false);
    await addLog(matthewsAddition.id, rui.id, -7, "Construction in taping phase. Corner Post $59,541 processed. Glen Harris invoices #1274/1276 clarified. Approve 9 garage POs (~$154K) — permit resubmission for detached garage #1 priority.", true);
  }

  const lindaBoathouse = await findProjectByContains("Paterson-Bier");
  if (lindaBoathouse) {
    await addExtraMilestones(lindaBoathouse.id, [
      ["First intake call", "DONE", -55, true],
      ["Design call #1 — Teams", "DONE", -55, true],
      ["Pinterest board shared", "DONE", -54, true],
      ["Second design meeting (post-Hawaii)", "PENDING", 7, true],
      ["Floor plan draft", "PENDING", 21, true],
      ["Design proposal", "PENDING", 35, true],
    ]);
    await prisma.selection.createMany({
      data: [
        { projectId: lindaBoathouse.id, category: "Style direction", option: "Serena & Lily aesthetic (per Linda)", priceCents: 0, status: "PROPOSED" },
        { projectId: lindaBoathouse.id, category: "Bar layout", option: "Bar seating on both sides of double door", priceCents: 0, status: "PROPOSED" },
        { projectId: lindaBoathouse.id, category: "Railing — Upper decking", option: "Style TBD — Linda shared inspiration photos", priceCents: 0, status: "PROPOSED" },
      ],
    });
    await addLog(lindaBoathouse.id, victoria.id, -55, "First Teams design call with Linda + Mark. Strong direction toward Serena & Lily styling. Discussed bar seating layout (both sides of double door), railing styles for upper decking. Pinterest board invite sent for ongoing collaboration.", true);
    await addLog(lindaBoathouse.id, victoria.id, -1, "Linda back from Hawaii — second meeting requested 'soon' to keep ball rolling on boathouse. Coordinating schedule with Nick. Project currently flagged ON HOLD.", false);
  }

  const anderson = await findProjectByContains("Anderson");
  if (anderson) {
    await addExtraMilestones(anderson.id, [
      ["Construction start", "DONE", -260, true],
      ["Framing complete", "DONE", -160, true],
      ["Mechanical rough-in", "DONE", -120, true],
      ["Drywall & taping", "DONE", -80, true],
      ["Trim delivery (Tues)", "PENDING", 2, false],
      ["Glenn install (Thurs)", "PENDING", 4, false],
      ["Kitchen install (next week)", "PENDING", 7, true],
      ["Final 10% draw at occupancy", "PENDING", 14, true],
      ["Occupancy — Nelson family", "PENDING", 14, true],
      ["CO 0010 Fireplace finalize", "IN_PROGRESS", 7, false],
    ]);
    await addLog(anderson.id, rui.id, -1, "Finishings ~80%. Trim delivery Tuesday, Glenn install Thursday, kitchen install next week. 6 overdue POs to chase. 25% draw invoiced Apr 15. 9 approved COs ($28,822) at 0% invoiced — need to bill. CO 0010 Fireplace DRAFT 3+ months (~$6K actual, ~$14K pending). Fireplace framing mismatch flagged Apr 16.", false);
  }

  const sheehan = await findProjectByContains("Sheehan");
  if (sheehan) {
    await addExtraMilestones(sheehan.id, [
      ["Prelim drawings", "DONE", -240, true],
      ["Detailed design", "DONE", -180, true],
      ["Permit application drafted", "DONE", -90, false],
      ["Awaiting owner permit authorization", "IN_PROGRESS", 5, false],
      ["CLOCA boundary confirmation", "DONE", -14, false],
      ["Carlos/Moffatt Roofing response", "DONE", -6, false],
      ["Permit submitted", "PENDING", 14, true],
      ["Design refresh — update floor plans + pricing", "IN_PROGRESS", 21, true],
    ]);
    await addLog(sheehan.id, ashley.id, -2, "Ashley awaiting owner authorization to submit permit — Rui to follow up, cc Nick for extra nudge. Nick requesting follow-up emails. Victoria to run project through workflow for design + estimate refresh: update floor plans, revise pricing for current year, set new design package standards.", false);
    await addLog(sheehan.id, ashley.id, -14, "CLOCA boundary confirmed. Carlos/Moffatt Roofing replied May 14 with updated quote. Ready to package permit submission once authorization in.", false);
  }

  const bailey = await findProjectByContains("Bailey");
  if (bailey) {
    await addExtraMilestones(bailey.id, [
      ["Initial design call setup (Kate & Dave)", "DONE", -118, true],
      ["Design call — Friday review", "DONE", -113, true],
      ["Tree removal quote received from Chris ($6,400)", "DONE", -7, false],
      ["Floor plan review with Kate", "PENDING", 14, true],
      ["Variance application", "IN_PROGRESS", 21, false],
      ["Site clearing scheduled", "PENDING", 28, false],
    ]);
    await addLog(bailey.id, nick.id, -118, "Set up design call directly with Aunt Kate & Uncle Dave for Friday Jan 23. Will handle until floor plans drafted then bring in Victoria. Updating BuilderTrend lead.", false);
    await addLog(bailey.id, nick.id, -7, "Tree removal quote in from Chris: $6,400 for marked trees at 87 Lakeview Cottage Road, excluding stump grinding. Site clearing schedule pending design approval.", false);
  }

  const lee = await findProjectByContains("Lekani");
  if (lee) {
    await addExtraMilestones(lee.id, [
      ["Construction start", "DONE", -185, true],
      ["Framing complete", "DONE", -120, true],
      ["Mechanical rough-in", "DONE", -90, true],
      ["Drywall & taping", "DONE", -60, true],
      ["Painting 30% complete", "DONE", -45, true],
      ["Finishings (10% remaining)", "IN_PROGRESS", -5, true],
      ["Final walkthrough", "PENDING", 14, true],
      ["Closeout", "PENDING", 21, true],
    ]);
    await addLog(lee.id, rui.id, -3, "Project 90% complete, painting nearly done. 18 days past projected completion (Apr 15) — pushing for final close in next 2 weeks.", false);
  }

  const joblin = await findProjectByContains("Joblin");
  if (joblin) {
    await addExtraMilestones(joblin.id, [
      ["Construction start", "DONE", -210, true],
      ["Demolition", "DONE", -200, true],
      ["Framing & mechanicals", "DONE", -150, true],
      ["Drywall complete", "DONE", -90, true],
      ["Countertop install (9:30 AM today)", "IN_PROGRESS", 0, true],
      ["HD orders pickup (Morningside)", "IN_PROGRESS", 0, false],
      ["Final invoices reconciled", "IN_PROGRESS", 2, false],
      ["Occupancy this week", "PENDING", 5, true],
    ]);
    await addLog(joblin.id, andrew.id, 0, "Countertop install 9:30 AM. HD orders #616251437 & #616256046 ready for pickup at Morningside 7027. Josh & Rui need to connect TODAY on outstanding invoices & final bill. C&H Glass $1,808 due. Durham Flooring payments need verification. Occupancy targeted for this week — PRE-COMPLETION CRITICAL.", false);
  }

  const hallasC = await findProjectByContains("Marconi");
  if (hallasC) {
    await addLog(hallasC.id, victoria.id, -3, "Kitchen coordination phase. Drywall & taping underway. Josh on site for ordering. Anco Contracting (Paul Marconi's company) is the billing entity.", false);
  }

  // -----------------------------------------------------------------------
  // HubSpot import — filter 7,405 → real homeowner leads only
  // -----------------------------------------------------------------------
  const PERSONAL_EMAIL_DOMAINS = new Set([
    "gmail.com", "hotmail.com", "outlook.com", "yahoo.com", "yahoo.ca", "icloud.com",
    "rogers.com", "rogers.ca", "sympatico.ca", "bell.net", "live.com", "me.com",
    "aol.com", "telus.net", "mail.com", "msn.com", "shaw.ca", "cogeco.ca", "nexicom.net",
  ]);
  const HUBSPOT_VENDOR_DOMAINS = new Set([
    "kawarthalakes.ca", "gentek.ca", "yelp.com", "slack.com", "hubspot.com", "meta.com",
    "jobtread.com", "jobbuddy.com", "quo.com", "calendly.com", "dricore.com", "tarion.com",
    "rbc.com", "cra-arc.gc.ca", "squareup.com", "squaretrade.com", "onstar.com",
    "danmartell.com", "brevosend.com", "barrietrim.com", "centurymill.com", "donlealumber.com",
    "monaghanlumber.com", "handleylumber.com", "technometalpost.com", "gni.ca", "pandadoc.net",
    "macklawyers.ca", "remaxjazz.com", "ritsontile.com", "scugoglumber.com", "anco.com",
    "henleycontracting.com",
  ]);

  // Words that strongly suggest a vendor/sub/business, not a homeowner lead.
  // We reject if the email local-part OR the contact's name contains any of these.
  const VENDOR_KEYWORDS = [
    "construction", "contracting", "contractor", "construx", "drywall", "stone", "tile",
    "concrete", "electric", "electrical", "plumbing", "plumb", "roofing", "siding",
    "framing", "carpentry", "carpenter", "painting", "painter", "painters", "flooring", "floors",
    "demolition", "excavation", "landscape", "landscaping", "hvac", "heating", "cooling",
    "windows", "doors", "railing", "railings", "deck", "decking", "exteriors", "exterior",
    "cabinet", "kitchens", "countertop", "supply", "supplies", "lumber", "wholesale",
    "industrial", "commercial", "trades", "design", "renovations",
    "remodel", "builders", "masonry", "mason", "stucco", "insulation",
    "rentals", "rental", "asphalt", "paving", "septic", "drilling", "disposal",
    "guard", "glass", "fence", "fencing", "concrete", "metal", "steel", "geotech",
    "engineering", "surveyor", "surveying", "appraisal", "inspection", "inspector",
    "sunrock", "duradek", "homecovered", "tarion", "centurystone",
  ];

  // Generic role-based inboxes that aren't a homeowner
  const GENERIC_LOCAL_PARTS = new Set([
    "info", "sales", "office", "admin", "support", "contact", "hello", "service",
    "billing", "accounts", "marketing", "noreply", "no-reply", "donotreply",
  ]);

  function looksLikeVendor(text: string): boolean {
    const t = text.toLowerCase();
    return VENDOR_KEYWORDS.some((kw) => t.includes(kw));
  }

  function isRealHubSpotLead(row: Record<string, any>): boolean {
    const email = String(row["Email"] ?? "").trim().toLowerCase();
    const fn = String(row["First Name"] ?? "").trim();
    const ln = String(row["Last Name"] ?? "").trim();
    const phone = String(row["Phone Number"] ?? row["Phone"] ?? "").trim();
    if (!fn && !ln) return false;
    if (!email && !phone) return false;
    if (fn.includes("@")) return false;

    const domain = email.includes("@") ? email.split("@")[1] : "";
    const localPart = email.includes("@") ? email.split("@")[0] : "";
    if (HUBSPOT_VENDOR_DOMAINS.has(domain)) return false;
    if (email.includes("noreply") || email.includes("@city") || email.includes("@gov") || email.includes("municipal")) return false;
    if (GENERIC_LOCAL_PARTS.has(localPart)) return false;

    // Reject if the email local-part, full email, OR name contains a vendor keyword
    const fullName = `${fn} ${ln}`.trim();
    if (looksLikeVendor(localPart)) return false;
    if (looksLikeVendor(domain)) return false;
    if (looksLikeVendor(fullName)) return false;

    // Reject obvious business names (have Ltd / Inc / LLC / Corp / Co. / Group / Services)
    if (/\b(ltd|inc|llc|corp|co\.|group|services|solutions|technologies|partners|consulting|industries)\b/i.test(fullName)) return false;

    // Accept personal email
    if (PERSONAL_EMAIL_DOMAINS.has(domain)) return true;

    // Accept if has any form-submission evidence
    if (row["Description of first engagement"]) return true;
    if (row["Customer Value Rank"]) return true;

    // Last resort: accept if has both email + phone + city (engaged contact)
    if (email && phone && row["City"]) return true;

    return false;
  }

  console.log("\nImporting HubSpot leads (filtered from 7,405)...");
  const hubspotPath = path.join(IMPORTS_DIR, "hubspot-allcontacts.csv");
  let hubspotAdded = 0, hubspotMatched = 0, hubspotSkipped = 0;
  if (fs.existsSync(hubspotPath)) {
    const wb = XLSX.readFile(hubspotPath);
    const hsRows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: null, raw: false }) as Record<string, any>[];

    // Build email + phone lookup for existing clients
    const existingByEmail = new Map<string, string>();
    const existingByPhone = new Map<string, string>();
    const allExisting = await prisma.client.findMany();
    for (const c of allExisting) {
      if (c.primaryEmail) existingByEmail.set(c.primaryEmail.toLowerCase(), c.id);
      if (c.primaryPhone) existingByPhone.set(normalizePhone(c.primaryPhone), c.id);
    }

    for (const row of hsRows) {
      if (!isRealHubSpotLead(row)) { hubspotSkipped += 1; continue; }
      const email = String(row["Email"] ?? "").trim().toLowerCase();
      const phone = String(row["Phone Number"] ?? row["Phone"] ?? "").trim();
      const normPhone = phone ? normalizePhone(phone) : "";
      if (email && existingByEmail.has(email)) { hubspotMatched += 1; continue; }
      if (normPhone && existingByPhone.has(normPhone)) { hubspotMatched += 1; continue; }

      const fn = String(row["First Name"] ?? "").trim();
      const ln = String(row["Last Name"] ?? "").trim();
      const name = `${fn} ${ln}`.trim() || email || "Unnamed HubSpot lead";

      const lifecycle = String(row["Lifecycle Stage"] ?? "").trim();
      const stage = lifecycle === "Opportunity" ? "ONSITE_CONSULT" : lifecycle === "Customer" ? "PAST" : "LEAD";

      const noteParts: string[] = [];
      if (row["Description of first engagement"]) noteParts.push(`First engagement: ${row["Description of first engagement"]}`);
      if (row["Type of first engagement"]) noteParts.push(`Type: ${row["Type of first engagement"]}`);
      if (row["Customer Value Rank"]) noteParts.push(`Value rank: ${row["Customer Value Rank"]}`);

      // Parse HubSpot Create Date for accurate sorting
      let createdAt: Date | null = null;
      const cdRaw = String(row["Create Date"] ?? "").trim();
      if (cdRaw) {
        const parsed = new Date(cdRaw);
        if (!isNaN(parsed.getTime())) createdAt = parsed;
      }

      const formattedPhone = formatPhone(phone);
      const c = await prisma.client.create({
        data: {
          name,
          primaryEmail: row["Email"] || null,
          primaryPhone: formattedPhone,
          city: row["City"] ?? null,
          stage,
          source: "HubSpot",
          notes: noteParts.length > 0 ? noteParts.join("\n") : null,
          ...(createdAt ? { createdAt } : {}),
        },
      });
      // Mirror into the in-memory indexes used by the rest of the seed
      clientByName.set(name, c.id);
      if (ln) {
        const variants = new Set<string>([ln.toLowerCase()]);
        for (const part of ln.split(/[-\s]/)) {
          if (part.length >= 3) variants.add(part.toLowerCase());
        }
        for (const v of variants) {
          if (!clientBySurname.has(v)) clientBySurname.set(v, c.id);
        }
      }
      if (formattedPhone) clientByPhone.set(normalizePhone(formattedPhone), c.id);
      hubspotAdded += 1;
    }
  }
  console.log(`  HubSpot: ${hubspotAdded} new, ${hubspotMatched} matched existing, ${hubspotSkipped} filtered out`);

  // -----------------------------------------------------------------------
  // SMS-only leads — Quo conversations with no BT/Tracker counterpart
  // -----------------------------------------------------------------------
  console.log("\nCreating SMS-only lead records...");
  const SMS_ONLY_LEADS: { phone: string; name: string; stage: string; notes: string }[] = [
    { phone: "+14163999931", name: "Tom (Balsam garage)", stage: "ON_HOLD", notes: "Balsam Lake new garage. Outreach via SMS. On hold while client navigates Florida-Canadian car registration return. Survey + septic design coordination via Shepherds." },
    { phone: "+19059273134", name: "Lucy (4 Wylie Lane)", stage: "LEAD", notes: "Builder intro for 4 Wylie Lane Stouffville (sibling to Ariss/Carville project)." },
  ];
  let smsLeadCount = 0;
  for (const lead of SMS_ONLY_LEADS) {
    const phone = formatPhone(lead.phone);
    if (!phone) continue;
    if (clientByPhone.has(normalizePhone(phone))) continue;
    await ensureClient({ name: lead.name, surname: lead.name.split(" ")[0], phone, stage: lead.stage, source: "Quo SMS", notes: lead.notes });
    smsLeadCount += 1;
  }
  console.log(`  ${smsLeadCount} SMS-only leads created.`);

  // -----------------------------------------------------------------------
  // SMS threads from Quo
  // -----------------------------------------------------------------------
  console.log("\nSeeding Quo SMS threads...");
  let threadCount = 0, messageCount = 0, linkedCount = 0;

  for (const conv of CONVERSATIONS) {
    const sorted = [...conv.messages].sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());
    const lastAt = new Date(sorted[sorted.length - 1].ts);
    let clientId: string | null = null;
    if (conv.phone) clientId = clientByPhone.get(normalizePhone(conv.phone)) ?? null;
    if (!clientId && conv.matchSurname) clientId = lookupClientBySurname(conv.matchSurname);

    const projectId = clientId ? (await prisma.project.findFirst({ where: { clientId } }))?.id ?? null : null;

    const subject = conv.kind === "NOISE" ? `Unknown · ${conv.phone}` : conv.fromName;
    const thread = await prisma.thread.create({
      data: {
        clientId,
        projectId,
        subject,
        channel: "SMS",
        lastAt,
        unread: conv.kind === "NOISE" ? 0 : (sorted[sorted.length - 1].direction === "IN" ? 1 : 0),
      },
    });

    for (const m of sorted) {
      await prisma.message.create({
        data: {
          threadId: thread.id,
          direction: m.direction,
          body: m.body,
          channel: "SMS",
          fromName: m.direction === "IN" ? conv.fromName : "Henley team",
          sentAt: new Date(m.ts),
        },
      });
    }
    threadCount += 1;
    messageCount += sorted.length;
    if (clientId) linkedCount += 1;
  }
  console.log(`  ${threadCount} threads, ${messageCount} messages, ${linkedCount} linked to clients.`);

  // -----------------------------------------------------------------------
  // Assign team to active projects
  // -----------------------------------------------------------------------
  console.log("\nAssigning team to active projects...");
  const activeProjects = await prisma.project.findMany({
    where: { status: { in: ["IN_PROGRESS", "FINISHING", "PERMITTING", "DESIGN", "CLOSING"] } },
  });
  let assignmentCount = 0;
  for (const p of activeProjects) {
    const teamStr = (p.team ?? "").toLowerCase();
    const assignments: { userId: string; role: string }[] = [];
    if (teamStr.includes("nick")) assignments.push({ userId: nick.id, role: "PM" });
    if (teamStr.includes("mike")) assignments.push({ userId: mike.id, role: "PM" });
    if (teamStr.includes("victoria")) assignments.push({ userId: victoria.id, role: "PM" });
    if (teamStr.includes("rui")) assignments.push({ userId: rui.id, role: "LEAD" });
    if (teamStr.includes("ashley")) assignments.push({ userId: ashley.id, role: "PM" });
    if (teamStr.includes("michelle")) assignments.push({ userId: michelle.id, role: "DESIGNER" });
    if (teamStr.includes("andrew") || teamStr.includes("bapst")) assignments.push({ userId: andrew.id, role: "PM" });
    for (const a of assignments) {
      try {
        await prisma.projectAssignment.create({ data: { projectId: p.id, ...a } });
        assignmentCount += 1;
      } catch {}
    }
  }
  console.log(`  ${assignmentCount} team assignments created.`);

  // -----------------------------------------------------------------------
  // Summary
  // -----------------------------------------------------------------------
  const totalClients = await prisma.client.count();
  const totalProjects = await prisma.project.count();
  const totalLeads = await prisma.client.count({ where: { stage: { in: ["LEAD", "ONSITE_CONSULT", "DESIGN_PROPOSAL", "PROPOSAL_SENT"] } } });
  const totalActive = await prisma.project.count({ where: { status: { in: ["IN_PROGRESS", "FINISHING", "PERMITTING", "DESIGN"] } } });

  console.log(`
=============================================================
  Real-data seed complete (from BuilderTrend exports + Quo SMS)
=============================================================

  Clients:           ${totalClients}
    Active leads:    ${totalLeads}
  Projects:          ${totalProjects}
    Active builds:   ${totalActive}
  Threads:           ${threadCount} (${linkedCount} linked)
  Messages:          ${messageCount}

  Team logins (password: demo)
    CEO    nick@henleycontracting.com      Nick Henley
    CEO    mike@henleycontracting.com      Mike Henley
    OFFICE victoria@henleycontracting.com  Victoria Leask (Sales/Concierge)
    OFFICE rui@henleycontracting.com       Rui Tomas (PM Lead)
    OFFICE ashley@henleycontracting.com    Ashley Vigilante (Permits)
    OFFICE michelle@henleycontracting.com  Michelle Dobson (Design)
    OFFICE andrew@henleycontracting.com    Andrew Bapst (PM)
    FIELD  site@henleycontracting.com      Site Crew
`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
