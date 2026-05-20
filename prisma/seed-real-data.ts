import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Data extracted from:
//   - Henley_Contracting_Ltd._Project_Profitability_Summary.xlsx (Google Drive)
//   - FULL Procedures Sheet - NEW.xlsx (team + roles)
//   - Quo workspace SMS history (+17052426548 Henley Contracting Ltd line)
// ---------------------------------------------------------------------------

type ProjectSeed = {
  name: string;
  address: string;
  code?: string;
  incomeCents: number;
  costCents: number;
  status: "PLANNING" | "IN_PROGRESS" | "ON_HOLD" | "COMPLETE";
};

type ClientSeed = {
  name: string;
  surname: string;
  primaryEmail?: string;
  primaryPhone?: string;
  city?: string;
  stage: "LEAD" | "QUALIFIED" | "PROPOSAL" | "WON" | "LOST" | "ACTIVE" | "PAST";
  source?: string;
  notes?: string;
  createPortalLogin?: boolean;
  projects: ProjectSeed[];
};

const CLIENTS: ClientSeed[] = [
  {
    name: "Terry Anderson",
    surname: "Anderson",
    stage: "PAST",
    notes: "Largest single-residence project on record (94.79% margin). High-value referral source.",
    projects: [{ name: "167 McKelvey Road", address: "167 McKelvey Road", incomeCents: 25659436, costCents: 1337448, status: "COMPLETE" }],
  },
  {
    name: "Bill Allen",
    surname: "Allen",
    stage: "PAST",
    projects: [{ name: "973 Orchid", address: "973 Orchid", incomeCents: 2669000, costCents: 1080590, status: "COMPLETE" }],
  },
  {
    name: "Sandra Barrett",
    surname: "Barrett",
    city: "Fenelon Falls",
    stage: "PAST",
    notes: "Repeat client — house then garage addition (gas line, R-60 attic, shelving).",
    projects: [
      { name: "211 Francis St E", address: "211 Francis St E, Fenelon Falls", incomeCents: 3219809, costCents: 65481, status: "COMPLETE" },
      { name: "Garage at 211 Francis St E", address: "211 Francis St E, Fenelon Falls", incomeCents: 19659481, costCents: 15016673, status: "COMPLETE" },
    ],
  },
  {
    name: "Kayte Black",
    surname: "Black",
    stage: "PAST",
    notes: "Recent punch list (Jan 2026): pantry under-lighting motion, secret door stoppers, basement bathroom HRV, master bathroom trim gaps. Family-adjacent client.",
    projects: [{ name: "3140 Cochrane Street", address: "3140 Cochrane Street", incomeCents: 7137168, costCents: 3117284, status: "COMPLETE" }],
  },
  {
    name: "Laura & Wesley Bogaert",
    surname: "Bogaert",
    stage: "PAST",
    notes: "Slightly underwater (-2.88% margin) — review for future bid calibration.",
    projects: [{ name: "21 Maconnachie Place", address: "21 Maconnachie Place", incomeCents: 4707600, costCents: 4842955, status: "COMPLETE" }],
  },
  {
    name: "Marilyn Caccamo",
    surname: "Caccamo",
    stage: "PAST",
    projects: [{ name: "722 Indian Point Road", address: "722 Indian Point Road", incomeCents: 30527739, costCents: 20656036, status: "COMPLETE" }],
  },
  {
    name: "Randy Cheesman",
    surname: "Cheesman",
    primaryEmail: "randy.cheesman@example.com",
    stage: "PAST",
    notes: "Long-running project: spiral staircase install, steel beam, masonry, attic framing, transom windows. Largest # of line items in P&L.",
    createPortalLogin: true,
    projects: [{ name: "3395 Hollywood Court", address: "3395 Hollywood Court", incomeCents: 28573269, costCents: 25789090, status: "COMPLETE" }],
  },
  {
    name: "Paul & Nicole Cleary",
    surname: "Cleary",
    city: "Uxbridge",
    stage: "PAST",
    projects: [{ name: "26 Cemetery Rd", address: "26 Cemetery Rd, Uxbridge", incomeCents: 4336788, costCents: 3498923, status: "COMPLETE" }],
  },
  {
    name: "Lindsey Clegg",
    surname: "Clegg",
    primaryEmail: "lindsayclegg3@gmail.com",
    stage: "PROPOSAL",
    notes: "Basement design intake on file (2025-02-18): mixed-wood stained cabinets, two-tone with accent colours, slatted accent wall, EV port rough-in, electric feature fireplace.",
    createPortalLogin: true,
    projects: [{ name: "90 William Stephenson Drive — Basement", address: "90 William Stephenson Drive", incomeCents: 289000, costCents: 121077, status: "PLANNING" }],
  },
  {
    name: "Darryl Cooper",
    surname: "Cooper",
    stage: "PAST",
    projects: [{ name: "62 Mason Lane", address: "62 Mason Lane", incomeCents: 2788210, costCents: 1231377, status: "COMPLETE" }],
  },
  {
    name: "Jane & Giovanni De Vito",
    surname: "De Vito",
    stage: "PAST",
    projects: [{ name: "171 Beehive Drive", address: "171 Beehive Drive", incomeCents: 24210688, costCents: 16300362, status: "COMPLETE" }],
  },
  {
    name: "Robert Donaldson",
    surname: "Donaldson",
    stage: "PAST",
    projects: [{ name: "610 Indian Point Road", address: "610 Indian Point Road", incomeCents: 4746527, costCents: 2808362, status: "COMPLETE" }],
  },
  {
    name: "Alex French & Jackie Pengilly",
    surname: "French",
    stage: "PAST",
    projects: [{ name: "570 Masson St", address: "570 Masson St", incomeCents: 5295750, costCents: 1818622, status: "COMPLETE" }],
  },
  {
    name: "Dario & Ainsley Gabbani",
    surname: "Gabbani",
    city: "Cavan",
    stage: "PAST",
    notes: "Custom home build — largest project ever ($1M+ income). 16.85% margin.",
    projects: [{ name: "717 Syer Line", address: "717 Syer Line, Cavan", incomeCents: 101984954, costCents: 84801328, status: "COMPLETE" }],
  },
  {
    name: "Joyce Goodier",
    surname: "Goodier",
    city: "Fenelon Falls",
    stage: "PAST",
    projects: [{ name: "37 Bayview Road", address: "37 Bayview Road, Fenelon Falls", incomeCents: 4705896, costCents: 3978717, status: "COMPLETE" }],
  },
  {
    name: "Jim Graham",
    surname: "Graham",
    stage: "PAST",
    projects: [{ name: "1955 Arborwood Drive", address: "1955 Arborwood Drive", incomeCents: 8884965, costCents: 7321986, status: "COMPLETE" }],
  },
  {
    name: "Ken & Heather Haire",
    surname: "Haire",
    stage: "PAST",
    projects: [{ name: "138 Grove Road", address: "138 Grove Road", incomeCents: 333265, costCents: 115305, status: "COMPLETE" }],
  },
  {
    name: "Mike Hallas",
    surname: "Hallas",
    stage: "PAST",
    projects: [{ name: "1 Cottonwood Dr", address: "1 Cottonwood Dr", incomeCents: 4945850, costCents: 4317092, status: "COMPLETE" }],
  },
  {
    name: "Lynn & Wayne Hallas-Coulson",
    surname: "Hallas",
    primaryEmail: "coulson.lott@gmail.com",
    primaryPhone: "+17059341295",
    stage: "ACTIVE",
    notes: "52 Mason Lane — variance application in progress. Construction draws against detailed proposal. Survey/drawings/permit prep ongoing.",
    projects: [{ name: "52 Mason Lane", address: "52 Mason Lane", incomeCents: 9361274, costCents: 7253978, status: "IN_PROGRESS" }],
  },
  {
    name: "Janet Knowler",
    surname: "Henley",
    stage: "PAST",
    notes: "Family — 131 Sutherland 2025 projects.",
    projects: [{ name: "131 Sutherland — 2025", address: "131 Sutherland", incomeCents: 280875, costCents: 131864, status: "COMPLETE" }],
  },
  {
    name: "Nancy Hooper",
    surname: "Hooper",
    stage: "PAST",
    projects: [{ name: "309 Kent Street", address: "309 Kent Street", incomeCents: 825758, costCents: 7662, status: "COMPLETE" }],
  },
  {
    name: "Jeff Landis",
    surname: "Landis",
    stage: "PAST",
    projects: [{ name: "664 Indian Point Road", address: "664 Indian Point Road", incomeCents: 1361376, costCents: 404448, status: "COMPLETE" }],
  },
  {
    name: "Jill & Gordon Lee",
    surname: "Lee",
    stage: "PAST",
    notes: "Repeat client — Lekani residence and Mason Lane addition.",
    projects: [
      { name: "533 Lekani Crt", address: "533 Lekani Crt", incomeCents: 373275, costCents: 442474, status: "COMPLETE" },
      { name: "68 Mason Ln (HC-2209)", address: "68 Mason Lane", code: "HC-2209", incomeCents: 0, costCents: 389052, status: "COMPLETE" },
    ],
  },
  {
    name: "Jessie MacAlpine Shearer",
    surname: "MacAlpine",
    stage: "PAST",
    projects: [{ name: "881 Renaissance Drive", address: "881 Renaissance Drive", incomeCents: 15855963, costCents: 14799037, status: "COMPLETE" }],
  },
  {
    name: "Dave & Gloria MacDonald",
    surname: "MacDonald",
    stage: "PAST",
    projects: [{ name: "149 Wychwood Cres", address: "149 Wychwood Cres", code: "HC-2246", incomeCents: 1590850, costCents: 0, status: "COMPLETE" }],
  },
  {
    name: "John & Lorraine Madill",
    surname: "Madill",
    stage: "PAST",
    projects: [{ name: "914 Wyldewood Dr", address: "914 Wyldewood Dr", incomeCents: 3739000, costCents: 80984, status: "COMPLETE" }],
  },
  {
    name: "Seva Marouchko",
    surname: "Marouchko",
    stage: "PAST",
    projects: [{ name: "41 Roma Drive", address: "41 Roma Drive", incomeCents: 10862500, costCents: 9655223, status: "COMPLETE" }],
  },
  {
    name: "Chris & Joanne Massiah",
    surname: "Massiah",
    stage: "PAST",
    projects: [{ name: "546 Indian Point Road", address: "546 Indian Point Road", incomeCents: 6156768, costCents: 3139308, status: "COMPLETE" }],
  },
  {
    name: "James Matthews",
    surname: "Matthews",
    stage: "ACTIVE",
    notes: "Active garage addition follow-up at 22 Bayview Lane. Permit Schedule 1 form re-submit in progress with Adam (engineer) and Glen for signature. Backfill inspection done Jan 13 (Mel coordinated via Jon Cunningham, building inspector). Truss/lintel details for second-floor garage windows requested by Mike — Ashley to forward to Glen.",
    projects: [
      { name: "22 Bayview Lane — Original", address: "22 Bayview Lane", incomeCents: 2898000, costCents: 260000, status: "COMPLETE" },
      { name: "22 Bayview Lane — Garage Addition", address: "22 Bayview Lane", incomeCents: 0, costCents: 0, status: "IN_PROGRESS" },
    ],
  },
  {
    name: "Karen & Steve Moote",
    surname: "Moote",
    stage: "PAST",
    projects: [{ name: "323 Aldred Drive", address: "323 Aldred Drive", incomeCents: 2321876, costCents: 1941521, status: "COMPLETE" }],
  },
  {
    name: "Adam Morrow & Claire Howard",
    surname: "Morrow",
    city: "Lindsay",
    stage: "PAST",
    projects: [{ name: "226 Elgin St", address: "226 Elgin St, Lindsay", incomeCents: 3459000, costCents: 2731209, status: "COMPLETE" }],
  },
  {
    name: "Shannon & Dave Nickerson",
    surname: "Nickerson",
    stage: "PAST",
    projects: [{ name: "24 Greenway Blvd", address: "24 Greenway Blvd", incomeCents: 10703125, costCents: 6339752, status: "COMPLETE" }],
  },
  {
    name: "Julia & William Oxley",
    surname: "Oxley",
    stage: "PAST",
    notes: "Negative margin (-37%) — flag for retro review.",
    projects: [{ name: "1449 Oneida Crt", address: "1449 Oneida Crt", incomeCents: 3408080, costCents: 4672980, status: "COMPLETE" }],
  },
  {
    name: "Chris & Ivy Parks",
    surname: "Parks",
    stage: "PAST",
    projects: [{ name: "134 Grove Road", address: "134 Grove Road", incomeCents: 1449000, costCents: 621500, status: "COMPLETE" }],
  },
  {
    name: "Linda Paterson-Bier",
    surname: "Paterson",
    primaryPhone: "+14168826377",
    stage: "ACTIVE",
    notes: "Active design phase — boathouse project at 137 Lightning Point Rd. Second meeting requested May 4 after returning from Hawaii. Loves Serena & Lily. Teams meeting preferred over FaceTime.",
    createPortalLogin: true,
    projects: [{ name: "Boathouse — 137 Lightning Point Rd", address: "137 Lightning Point Rd", incomeCents: 0, costCents: 260000, status: "PLANNING" }],
  },
  {
    name: "Joanne Payne",
    surname: "Payne",
    city: "Ajax",
    stage: "PAST",
    notes: "Repeat client — Burden Cres main + addition.",
    projects: [
      { name: "43 Burden Cres", address: "43 Burden Cres, Ajax", incomeCents: 8855751, costCents: 8686721, status: "COMPLETE" },
      { name: "43 Burden Addition", address: "43 Burden Cres, Ajax", incomeCents: 517154, costCents: 599798, status: "COMPLETE" },
    ],
  },
  {
    name: "Dean Peel",
    surname: "Peel",
    stage: "PAST",
    projects: [{ name: "568 Indian Point Road", address: "568 Indian Point Road", incomeCents: 11845030, costCents: 6282231, status: "COMPLETE" }],
  },
  {
    name: "Doug & Lesley Perry",
    surname: "Perry",
    stage: "PAST",
    projects: [{ name: "764 Indian Point Road", address: "764 Indian Point Road", incomeCents: 3000000, costCents: 856500, status: "COMPLETE" }],
  },
  {
    name: "Scott & Jenna Pidgeon",
    surname: "Pidgeon",
    stage: "PAST",
    projects: [{ name: "969 Lavender Ct", address: "969 Lavender Ct", incomeCents: 4163000, costCents: 3797846, status: "COMPLETE" }],
  },
  {
    name: "Tracy Pigott",
    surname: "Pigott",
    stage: "PAST",
    projects: [{ name: "315 Aldred Drive", address: "315 Aldred Drive", incomeCents: 42980110, costCents: 35370139, status: "COMPLETE" }],
  },
  {
    name: "Steve & Susan Riesberry",
    surname: "Riesberry",
    stage: "PAST",
    projects: [{ name: "20 Goodman Road — Kitchen", address: "20 Goodman Road", incomeCents: 9774355, costCents: 5640497, status: "COMPLETE" }],
  },
  {
    name: "Dan Risorto",
    surname: "Risorto",
    stage: "PAST",
    projects: [{ name: "115 Lakeview Cottage Rd", address: "115 Lakeview Cottage Rd", incomeCents: 1080000, costCents: 662154, status: "COMPLETE" }],
  },
  {
    name: "Thomas Sheehan",
    surname: "Sheehan",
    stage: "PAST",
    notes: "10201 Mud Lake Road — HVAC design from Peter, septic permit from Joe (Port Perry / Crystal Williams). Recent permit follow-up in May 2026 suggests possible repeat work.",
    projects: [{ name: "10201 Mud Lake Road", address: "10201 Mud Lake Road", incomeCents: 18138336, costCents: 13947753, status: "COMPLETE" }],
  },
  {
    name: "Tom Singer",
    surname: "Singer",
    stage: "PAST",
    projects: [{ name: "33 Cedar Villa Rd", address: "33 Cedar Villa Rd", incomeCents: 1403625, costCents: 577394, status: "COMPLETE" }],
  },
  {
    name: "Paula Van Kessel",
    surname: "Van Kessel",
    stage: "PAST",
    projects: [{ name: "5170 Oakridge Trail", address: "5170 Oakridge Trail", incomeCents: 15151382, costCents: 9573833, status: "COMPLETE" }],
  },
  {
    name: "Dave Bailey",
    surname: "Bailey",
    stage: "ACTIVE",
    notes: "Family — Nick's uncle. 85 & 87 Lakeview Cottage Road. Active design call setup in Jan 2026 (with Kate). Tree removal quoted by Chris at $6,400 for site clearing.",
    projects: [{ name: "85 & 87 Lakeview Cottage Road", address: "85 & 87 Lakeview Cottage Road", code: "HC-2239", incomeCents: 2145460, costCents: 404084, status: "PLANNING" }],
  },
];

const NEW_LEADS: ClientSeed[] = [
  {
    name: "Sean & Sherri Walker",
    surname: "Walker",
    primaryPhone: "+12898304620",
    stage: "PROPOSAL",
    source: "Inbound — Victoria intake",
    notes: "Family home update. Onsite proposal review meeting Apr 16, 9am. Nick presenting; tailored proposal rather than emailed quote. Demo starting soon.",
    projects: [{ name: "Walker Family Home Update", address: "TBD", incomeCents: 0, costCents: 0, status: "PLANNING" }],
  },
  {
    name: "Brittany",
    surname: "Brittany",
    primaryPhone: "+12899233237",
    stage: "QUALIFIED",
    source: "Inbound — Nick direct",
    notes: "Onsite consult booked Jan 28. Victoria handed off as 'Client Experience Concierge'. Awaiting next steps.",
    projects: [],
  },
  {
    name: "Bryce Marshall",
    surname: "Marshall",
    primaryEmail: "marshallbhh@gmail.com",
    primaryPhone: "+16472724955",
    stage: "QUALIFIED",
    source: "Voicemail inquiry",
    notes: "Structural issues — onsite consultation Mar 23 12:30-1:30 with Nick.",
    projects: [{ name: "Marshall — Structural review", address: "TBD", incomeCents: 0, costCents: 0, status: "PLANNING" }],
  },
  {
    name: "David Byrne",
    surname: "Byrne",
    primaryEmail: "davidbyrnetwo@gmail.com",
    primaryPhone: "+19055501359",
    stage: "QUALIFIED",
    source: "Inbound — design call",
    notes: "Teams design call Apr 15 (computer/Teams update issues delayed start).",
    projects: [],
  },
  {
    name: "Aunt Jan",
    surname: "Knowler",
    primaryPhone: "+19052601263",
    stage: "ACTIVE",
    source: "Family / referral",
    notes: "Family. Spring 2026 projects. Victoria + Nick coordinating. Apr 10 handoff, May 1 + May 4 follow-up after gap in comms.",
    projects: [{ name: "Spring 2026 projects", address: "TBD", incomeCents: 0, costCents: 0, status: "PLANNING" }],
  },
  {
    name: "Tom (Balsam garage)",
    surname: "Tom",
    primaryPhone: "+14163999931",
    stage: "QUALIFIED",
    source: "Referral — Mike",
    notes: "Balsam Lake garage. Survey + septic design coordination via Shepherds. On hold while client navigates Florida-Canadian car registration return.",
    projects: [{ name: "Balsam Lake Garage", address: "Balsam Lake", incomeCents: 0, costCents: 0, status: "ON_HOLD" }],
  },
  {
    name: "Jim (Balsam)",
    surname: "Jim",
    primaryPhone: "+19054400061",
    stage: "LEAD",
    source: "Outbound check-in",
    notes: "Outreach May 5 — checking on Balsam property garage interest after winter thaw. Awaiting response.",
    projects: [],
  },
  {
    name: "Lucy (4 Wylie Lane)",
    surname: "Lucy",
    primaryPhone: "+19059273134",
    city: "Stouffville",
    stage: "QUALIFIED",
    source: "Builder intro",
    notes: "Henley confirmed as builder for 4 Wylie Lane Stouffville. Initial outreach Apr 13.",
    projects: [{ name: "4 Wylie Lane Build", address: "4 Wylie Lane, Stouffville", incomeCents: 0, costCents: 0, status: "PLANNING" }],
  },
  {
    name: "Patrick (54 Mason Lane)",
    surname: "Patrick",
    primaryPhone: "+16472622888",
    stage: "ACTIVE",
    source: "Site meeting",
    notes: "Measure scheduled at 54 Mason Lane (Balsam Lake) — Mike Henley onsite May 2. Sibling project to 52 Mason Lane (Hallas/Coulson).",
    projects: [{ name: "54 Mason Lane — Measure", address: "54 Mason Lane, Balsam Lake", incomeCents: 0, costCents: 0, status: "PLANNING" }],
  },
];

type Conversation = {
  phone: string;
  fromName: string;
  matchSurname?: string;
  kind: "CLIENT" | "SUB" | "NOISE";
  subjectOverride?: string;
  messages: { direction: "IN" | "OUT"; ts: string; body: string }[];
};

const CONVERSATIONS: Conversation[] = [
  {
    phone: "+12898304620",
    fromName: "Sean Walker",
    matchSurname: "Walker",
    kind: "CLIENT",
    messages: [
      { direction: "OUT", ts: "2026-04-02T14:13:58.953Z", body: "Hi Sean, this is Victoria from Henley Contracting. I hope you've had a great week! \n\nWe would like to set up a meeting with you and Sherri next week to go through our construction proposal. Our preference is to meet in person all together for about 1 hour to go through everything and answer any questions you may have. \n\nPlease let me know a time next week we can schedule in this meeting for you guys! Talk soon." },
      { direction: "IN", ts: "2026-04-02T16:12:20.421Z", body: "Hi Victoria. That would be great. What time are you available? Where would you like to meet?" },
      { direction: "IN", ts: "2026-04-02T16:12:38.622Z", body: "My wife has lunch around 12:30- 1:30" },
      { direction: "OUT", ts: "2026-04-06T20:17:48.037Z", body: "Hey Sean, I hope you've had a great weekend! This week we have availability tomorrow, Thursday and Friday 12:30-1:30\n\nWe can bring this meeting to you within your home if that is most convenient for you. I know you mentioned you were starting demo so let me know if that would work or not." },
      { direction: "IN", ts: "2026-04-06T20:18:44.424Z", body: "Thursday sounds great. At our house is great too" },
      { direction: "OUT", ts: "2026-04-06T20:21:33.300Z", body: "Wonderful I will get you booked in and send you a calendar invite" },
      { direction: "IN", ts: "2026-04-06T20:21:50.728Z", body: "Perfect. Thank you" },
      { direction: "IN", ts: "2026-04-10T13:05:12.201Z", body: "Good morning Victoria. Any luck having the proposal sent over?" },
      { direction: "OUT", ts: "2026-04-10T14:23:11.055Z", body: "Hi Sean, this is Nick. I've been out with the flu this week and pushed my schedule.\nBecause I know how important this project is, I don't want to just send a quote over email. For similar clients who updated a family home, the best approach is to customize the proposal with you. Review the details, answer your questions, and ensure the plan reflects what works best for you.\nIf you need to move ahead immediately that's ok, I understand. If you're comfortable waiting until next week, Ill come by and go over it with you. Is that ok?" },
      { direction: "IN", ts: "2026-04-10T16:38:53.218Z", body: "Hi Nick. My apologies on sending this text while you are under the weather. For some reason I have 2 messages from Henley 705 242 6548 and a 905 244-6003. Not sure how these are crossed. The first one came from Victoria and the later from you.\n\nNext week is still great. See you Thursday. Feel better" },
      { direction: "OUT", ts: "2026-04-13T18:11:02.271Z", body: "Hey Sean, happy Monday! This phone number is our team texting line we use to communicate with customers. The 6003 number you have is Nicks direct phone and text line. Sorry for any confusion! \n\nSee you Thursday! -Victoria" },
      { direction: "IN", ts: "2026-04-15T21:52:30.611Z", body: "Hi Victoria. Any chance we can move up tomorrow's meeting?" },
      { direction: "OUT", ts: "2026-04-15T22:06:13.758Z", body: "Hey Sean, our availability is quite flexible tomorrow morning. Is there a time which works best for you?" },
      { direction: "IN", ts: "2026-04-15T22:06:51.514Z", body: "9 am?" },
      { direction: "OUT", ts: "2026-04-15T23:54:49.858Z", body: "No problem I've moved you up to 9am. Have a great evening!" },
      { direction: "IN", ts: "2026-04-15T23:55:00.415Z", body: "Great!" },
      { direction: "IN", ts: "2026-04-15T23:55:06.410Z", body: "Thank you" },
    ],
  },
  {
    phone: "+14168826377",
    fromName: "Linda Paterson-Bier",
    matchSurname: "Paterson",
    kind: "CLIENT",
    subjectOverride: "Linda Paterson-Bier — Boathouse",
    messages: [
      { direction: "IN", ts: "2026-03-25T19:02:27.243Z", body: "Hi Victoria, it's Linda Paterson Bier" },
      { direction: "OUT", ts: "2026-03-25T19:25:45.152Z", body: "Hi Linda! Great speaking with you today. Excellent, thanks for sharing! I am sending the calendar link to our call now. Let's try connecting on Teams mobile to start out and if that doesn't work we can switch to FaceTime if needed. \n\nTo use teams you can download the app for mobile and join as a guest. Talk soon!" },
      { direction: "IN", ts: "2026-03-25T19:37:30.482Z", body: "So nice speaking with you as well! Sounds like a great plan. Chat tomorrow" },
      { direction: "IN", ts: "2026-03-26T15:30:09.424Z", body: "Bar seating on each side of double door" },
      { direction: "IN", ts: "2026-03-26T15:31:37.620Z", body: "Railing style on upper decking" },
      { direction: "IN", ts: "2026-03-26T15:40:10.577Z", body: "Just a few photos of things that we like. See you in a few minutes" },
      { direction: "OUT", ts: "2026-03-26T15:44:17.888Z", body: "Awesome! Thank you for sharing" },
      { direction: "OUT", ts: "2026-03-26T16:01:09.104Z", body: "Hi Linda I'm in teams ready when you are! Let me know if you are having trouble signing into our meeting through the link" },
      { direction: "OUT", ts: "2026-03-26T17:04:41.931Z", body: "Oh I love!! Serena and Lily it's just soo good!" },
      { direction: "IN", ts: "2026-03-26T17:05:06.173Z", body: "lol I agree" },
      { direction: "IN", ts: "2026-05-04T16:48:43.411Z", body: "Hi Victoria, \nWe are back from Hawaii. Wondering if we can do our second meeting soon so we can keep the ball rolling on the boathouse. \nLet me know your schedule when you have a minute. \nMany thanks!\nLinda" },
    ],
  },
  {
    phone: "+16472724955",
    fromName: "Bryce Marshall",
    matchSurname: "Marshall",
    kind: "CLIENT",
    messages: [
      { direction: "OUT", ts: "2026-03-05T21:41:09.634Z", body: "Hi Bryce, I'm Victoria from the Henley team. I received your voicemail looking for someone from our team to check out some structural issues. Feel free to connect with me over text to fill me in a bit on your project and what you're hoping we can help with. \n\nLooking forward to connecting! -Victoria" },
      { direction: "IN", ts: "2026-03-10T13:16:16.268Z", body: "Hi Victoria. Can I give you a call today?" },
      { direction: "OUT", ts: "2026-03-10T13:47:41.027Z", body: "Of course, I am available this morning or anytime after 3pm today. Talk soon!" },
      { direction: "IN", ts: "2026-03-16T18:54:01.155Z", body: "Hi Victoria. Tried you back a few times and we keep missing each other. Let me know when you're free. Thanks." },
      { direction: "OUT", ts: "2026-03-17T19:48:24.923Z", body: "Hi Bryce I am Available for a call this afternoon until 5pm or anytime tomorrow between 9-12" },
      { direction: "OUT", ts: "2026-03-17T21:16:06.160Z", body: "Hey Bryce, great to finally connect with you! I have sent a tentative calendar invite holding and onsite consultation meeting for Monday March 23, 12:30-1:30 to your email address marshallbhh@gmail.com\n\nPlease confirm this date and time works for you and Nick will be by to see your project. Thanks!" },
      { direction: "IN", ts: "2026-03-17T23:05:10.248Z", body: "Confirmed. Good for next Monday at 1230." },
      { direction: "OUT", ts: "2026-03-19T20:18:31.102Z", body: "Excellent!" },
    ],
  },
  {
    phone: "+19055501359",
    fromName: "David Byrne",
    matchSurname: "Byrne",
    kind: "CLIENT",
    messages: [
      { direction: "IN", ts: "2026-04-15T20:14:12.432Z", body: "That works well!!" },
      { direction: "OUT", ts: "2026-04-15T20:34:13.273Z", body: "Okay great! I don't have an email on file to send this teams meeting invite to. Could you please send your email?" },
      { direction: "IN", ts: "2026-04-15T20:52:09.726Z", body: "davidbyrnetwo@gmail.com" },
      { direction: "OUT", ts: "2026-04-15T20:52:53.743Z", body: "Wonderful sending now!" },
      { direction: "IN", ts: "2026-04-15T20:53:42.450Z", body: "Thank you. See you in a minute." },
      { direction: "IN", ts: "2026-04-15T21:03:02.597Z", body: "Our computer is having trouble with Teams." },
      { direction: "IN", ts: "2026-04-15T21:03:20.673Z", body: "We just need to restart. Update related." },
      { direction: "OUT", ts: "2026-04-15T21:03:29.189Z", body: "No problem!" },
    ],
  },
  {
    phone: "+12899233237",
    fromName: "Brittany",
    matchSurname: "Brittany",
    kind: "CLIENT",
    messages: [
      { direction: "OUT", ts: "2026-01-13T12:40:16.762Z", body: "Hi there Brittany this is Nick from Henley Contracting. Thanks for reaching out to us! Can I call you this morning around 830am?" },
      { direction: "IN", ts: "2026-01-13T12:41:29.472Z", body: "Yup sounds good!" },
      { direction: "IN", ts: "2026-01-16T17:41:12.188Z", body: "Hi Nick! Just wanted to confirm we are still booked for 1:00pm today?" },
      { direction: "OUT", ts: "2026-01-16T17:49:12.187Z", body: "Yes on my way" },
      { direction: "IN", ts: "2026-01-16T17:49:48.136Z", body: "Awesome" },
      { direction: "OUT", ts: "2026-01-16T17:50:20.681Z", body: "I'm just running 5 minutes behind" },
      { direction: "IN", ts: "2026-01-16T17:50:28.276Z", body: "No problem" },
      { direction: "IN", ts: "2026-01-28T22:14:19.403Z", body: "Hey Nick, are we still meeting today?" },
      { direction: "OUT", ts: "2026-01-28T22:18:19.333Z", body: "Hi Brittany, this is Victoria from the Henley Contracting Team. I am the Client Experience Concierge texting you from our team phone line.\n\nAs you navigate through your project with Henley Contracting, I will be here to guide you through the entire process letting you know next steps, setting up meetings and answering any questions you may have along the way. Think of me as your personal Henley Contracting concierge! \n\nPS; I'm a real person on the other end of the line – no AI bot here!" },
      { direction: "OUT", ts: "2026-01-28T22:19:07.159Z", body: "Nick does have you in the calendar to meet tonight! If you have any questions following your on-site consultation please let me know! \n-Victoria" },
      { direction: "IN", ts: "2026-01-28T22:20:06.250Z", body: "Okay thank you!" },
    ],
  },
  {
    phone: "+19052601263",
    fromName: "Aunt Jan",
    matchSurname: "Knowler",
    kind: "CLIENT",
    messages: [
      { direction: "OUT", ts: "2026-04-10T16:29:32.772Z", body: "Hi there Auntie Jan this is Nick! This is our office line I'm going to connect you on here to Victoria she's going to gather some information and we're going to get your projects all scheduled for this spring. Thanks for being so patient with us" },
      { direction: "IN", ts: "2026-04-10T17:00:18.760Z", body: "Hi Nick. Thank you for the message. I'm so glad you will be able to get this going, as I know how busy you are." },
      { direction: "IN", ts: "2026-05-01T17:53:02.440Z", body: "Hi Nick. Am I still on the list?" },
      { direction: "IN", ts: "2026-05-04T12:30:10.441Z", body: "I was wondering if my projects will fit into your schedule for spring. I heard from Victoria on April 13th. Nothing since." },
      { direction: "OUT", ts: "2026-05-04T16:41:12.001Z", body: "hi Aunt Jan!! Yes you are!" },
      { direction: "IN", ts: "2026-05-04T16:48:06.684Z", body: "Hi Nick. Thank you so much!" },
    ],
  },
  {
    phone: "+14163999931",
    fromName: "Tom",
    matchSurname: "Tom",
    kind: "CLIENT",
    messages: [
      { direction: "OUT", ts: "2026-05-05T18:47:11.786Z", body: "hi Tom, this is Nick Henley, Mike's son. This is our office line. Do you have a survey for your property on Balsam?" },
      { direction: "IN", ts: "2026-05-05T18:49:12.998Z", body: "I sent one recently to Mike, but can do one to you.\nJustin send me by email the email address you wish me to send it to.\nTom" },
      { direction: "OUT", ts: "2026-05-05T18:54:28.486Z", body: "ok great ill find it in Mike's email, no problem" },
      { direction: "OUT", ts: "2026-05-05T21:02:03.675Z", body: "hi Tom, do you have a copy of the septic design for your lot? and approximately how big do you think the garage should be?" },
      { direction: "IN", ts: "2026-05-05T23:48:48.557Z", body: "Nick,\nThe premise for the new garage is bringing a car (23 years old and special to me) back from Florida. It is a complicated process I am working through as it is now registered there, but was originally a Canadian car I sent there 10 years ago.\nLet's hold off on any more work until I get some certainty.\nWorking on it." },
      { direction: "OUT", ts: "2026-05-06T14:42:20.701Z", body: "no problem Tom! I found the septic design from Shepherds. Ill email it to you for your records." },
    ],
  },
  {
    phone: "+19054400061",
    fromName: "Jim",
    matchSurname: "Jim",
    kind: "CLIENT",
    messages: [
      { direction: "OUT", ts: "2026-05-05T18:37:44.005Z", body: "hi Jim, this is Nick Henley, are you still looking at doing a new garage on your Balsam property? How's the property looking after the winter thaw?" },
    ],
  },
  {
    phone: "+19059273134",
    fromName: "Lucy",
    matchSurname: "Lucy",
    kind: "CLIENT",
    messages: [
      { direction: "OUT", ts: "2026-04-13T21:49:10.519Z", body: "Hi Lucy this is Nick Henley from Henley Contracting were the builder for 4 Wylie Lane in stouffville" },
    ],
  },
  {
    phone: "+16472622888",
    fromName: "Patrick",
    matchSurname: "Patrick",
    kind: "CLIENT",
    messages: [
      { direction: "OUT", ts: "2026-05-02T17:04:31.320Z", body: "Hi Patrick, this is victoria from Henley Contracting. We have a measure scheduled for today 3-4pm at our 54 Mason Lane project on Balsam Lake. \n\nOur owner Mike Henley will meet you there. If you could give him a call once you're onsite he will be right over. \n\nHis cell is 905-260-0358" },
    ],
  },
  {
    phone: "+19052591984",
    fromName: "Chris (tree removal sub)",
    kind: "SUB",
    messages: [
      { direction: "OUT", ts: "2026-05-05T19:27:43.813Z", body: "hi Chris, this is Nick Henley, this is our office, can you go by 135 Ridge Dr on Balsam Lake, the client marked a bunch of tree's to be removed. We're going to be adding onto the one cottage on the left side of the lot." },
      { direction: "IN", ts: "2026-05-05T19:29:34.257Z", body: "Yeah I should be able to swing by there tomorrow sometime" },
      { direction: "OUT", ts: "2026-05-05T20:19:47.890Z", body: "thank you sir" },
      { direction: "OUT", ts: "2026-05-05T20:53:44.731Z", body: "whats new chris, how have you been? hey did you ever do the trees at my uncle dave's place at 87 lakeview cottage road?" },
      { direction: "IN", ts: "2026-05-05T21:11:09.202Z", body: "We have been good Nick, busy with our house build up here. \nNo I didn't end up doing anymore there. For some reason I thought he had someone else doing a bit of work there and I was waiting to hear from Mike." },
      { direction: "IN", ts: "2026-05-12T21:07:55.354Z", body: "Hey Nick, \nI stopped by that site last week. \n\nIt would be about 6400$ to get that stuff down and out of there. Not including any stump grinding." },
    ],
  },
  {
    phone: "+17058799988",
    fromName: "Adam (permits)",
    kind: "SUB",
    messages: [
      { direction: "OUT", ts: "2026-05-08T14:05:55.135Z", body: "Hi Adam, this is Ashley from Henley.  I sent you an email yesterday to update the schedule 1 form.  Please have a look at the email and return so I can resubmit.  We have submitted with the original dwgs to get the permit review started.  Thank you." },
      { direction: "IN", ts: "2026-05-08T14:44:58.236Z", body: "Hey Ashley, I have one filled out I just need Glen to sign it then I will get it to you" },
    ],
  },
  {
    phone: "+19056221776",
    fromName: "Peter (HVAC)",
    kind: "SUB",
    messages: [
      { direction: "OUT", ts: "2026-05-04T16:40:54.487Z", body: "Hi Peter, this is Nick Henley, did we have an HVAC design for 10201 Mud Lake Road?" },
      { direction: "IN", ts: "2026-05-04T16:58:06.694Z", body: "Yes there is. Do you need a copy?" },
      { direction: "OUT", ts: "2026-05-04T17:05:16.898Z", body: "yes please send to ashley" },
      { direction: "IN", ts: "2026-05-04T17:31:51.449Z", body: "Okay" },
      { direction: "IN", ts: "2026-05-04T17:37:01.174Z", body: "All sent." },
      { direction: "OUT", ts: "2026-05-05T15:05:28.097Z", body: "thank you sir!" },
    ],
  },
  {
    phone: "+19054320531",
    fromName: "Joe (septic permits)",
    kind: "SUB",
    messages: [
      { direction: "OUT", ts: "2026-05-04T16:40:23.600Z", body: "hi Joe, this is Nick Henley, Did we get the septic permit for 10201 Mudlake Road." },
      { direction: "IN", ts: "2026-05-04T16:41:10.545Z", body: "I'm 99 % sure we did" },
      { direction: "OUT", ts: "2026-05-04T16:41:37.443Z", body: "ok can you check your files? or who would we follow up with on that?" },
      { direction: "IN", ts: "2026-05-04T16:42:50.867Z", body: "It went through port Perry office so it would be from crystal Williams" },
      { direction: "OUT", ts: "2026-05-04T16:43:05.791Z", body: "ok can you email her and copy us please?" },
      { direction: "IN", ts: "2026-05-04T16:45:23.598Z", body: "What's your email" },
      { direction: "OUT", ts: "2026-05-04T16:48:24.279Z", body: "projects@henleycontracting.com" },
      { direction: "OUT", ts: "2026-05-04T16:48:30.819Z", body: "thats ashley, copy her" },
    ],
  },
  {
    phone: "+14168177017",
    fromName: "Unknown",
    kind: "NOISE",
    subjectOverride: "Wrong number",
    messages: [
      { direction: "IN", ts: "2026-03-13T00:36:29.480Z", body: "Where are you?" },
      { direction: "IN", ts: "2026-03-13T01:00:54.667Z", body: "I don't think you meant this for me!" },
      { direction: "IN", ts: "2026-03-13T01:01:35.461Z", body: "Oh jeez I meant this for my husband, not for you!! Sorry." },
    ],
  },
  {
    phone: "+15077096859",
    fromName: "Unknown",
    kind: "NOISE",
    subjectOverride: "Spam — \"do u still need work\"",
    messages: [
      { direction: "IN", ts: "2026-04-30T17:23:45.785Z", body: "do u still need work.?" },
    ],
  },
  {
    phone: "+17163551654",
    fromName: "Unknown",
    kind: "NOISE",
    subjectOverride: "Spam — recruiter",
    messages: [
      { direction: "IN", ts: "2026-05-10T20:44:38.267Z", body: "Hey, remote role openings are available actually, can I provide further information?" },
    ],
  },
];

function normalizePhone(p: string): string {
  return p.replace(/\D/g, "");
}

function formatPhone(p: string): string {
  const d = normalizePhone(p);
  if (d.length === 11 && d.startsWith("1")) return `(${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  return p;
}

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

  console.log("Creating Henley team users...");
  const nick = await prisma.user.create({
    data: { email: "nick@henleycontracting.com", name: "Nick Henley", passwordHash: pw, role: "CEO", focusArea: "Sales & Owner", phone: "+19052446003" },
  });
  const mike = await prisma.user.create({
    data: { email: "mike@henleycontracting.com", name: "Mike Henley", passwordHash: pw, role: "CEO", focusArea: "Owner / Production", phone: "+19052600358" },
  });
  const ashley = await prisma.user.create({
    data: { email: "ashley@henleycontracting.com", name: "Ashley", passwordHash: pw, role: "OFFICE", focusArea: "Permits & Admin" },
  });
  const victoria = await prisma.user.create({
    data: { email: "victoria@henleycontracting.com", name: "Victoria", passwordHash: pw, role: "OFFICE", focusArea: "Client Experience Concierge" },
  });
  const nikki = await prisma.user.create({
    data: { email: "nikki@henleycontracting.com", name: "Nikki", passwordHash: pw, role: "OFFICE", focusArea: "Quote Gathering & Project Setup" },
  });
  const michelle = await prisma.user.create({
    data: { email: "michelle@henleycontracting.com", name: "Michelle", passwordHash: pw, role: "OFFICE", focusArea: "Design Coordination" },
  });
  const siteSup = await prisma.user.create({
    data: { email: "site@henleycontracting.com", name: "Site Supervisor", passwordHash: pw, role: "FIELD", focusArea: "Production / Site Lead" },
  });

  console.log("Creating clients + projects...");
  const allClients = [...CLIENTS, ...NEW_LEADS];
  const clientByName = new Map<string, { id: string; surname: string }>();
  const clientBySurname = new Map<string, string>();
  const clientByPhone = new Map<string, string>();

  for (const c of allClients) {
    const client = await prisma.client.create({
      data: {
        name: c.name,
        primaryEmail: c.primaryEmail,
        primaryPhone: c.primaryPhone,
        city: c.city,
        stage: c.stage as string,
        source: c.source,
        notes: c.notes,
      },
    });
    clientByName.set(c.name, { id: client.id, surname: c.surname });
    if (!clientBySurname.has(c.surname)) clientBySurname.set(c.surname, client.id);
    if (c.primaryPhone) clientByPhone.set(normalizePhone(c.primaryPhone), client.id);

    for (const p of c.projects) {
      await prisma.project.create({
        data: {
          clientId: client.id,
          name: p.name,
          address: p.address,
          status: p.status,
          contractCents: p.incomeCents,
          budgetCents: p.costCents,
          description: p.code ? `Project code: ${p.code}` : undefined,
        },
      });
    }
  }
  console.log(`  ${allClients.length} clients, ${allClients.reduce((n, c) => n + c.projects.length, 0)} projects.`);

  console.log("Creating client portal logins...");
  for (const c of CLIENTS) {
    if (!c.createPortalLogin) continue;
    const cid = clientByName.get(c.name)?.id;
    if (!cid || !c.primaryEmail) continue;
    await prisma.user.create({
      data: {
        email: c.primaryEmail,
        name: c.name,
        passwordHash: pw,
        role: "CLIENT",
        clientId: cid,
      },
    });
    console.log(`  Portal login: ${c.primaryEmail}`);
  }

  console.log("Assigning team to key active projects...");
  const activeClients = ["Lynn & Wayne Hallas-Coulson", "James Matthews", "Linda Paterson-Bier", "Lindsey Clegg", "Dave Bailey", "Sean & Sherri Walker", "Bryce Marshall"];
  for (const name of activeClients) {
    const c = clientByName.get(name);
    if (!c) continue;
    const projects = await prisma.project.findMany({ where: { clientId: c.id } });
    for (const p of projects) {
      for (const [u, role] of [[nick, "PM"], [michelle, "DESIGNER"], [siteSup, "LEAD"], [victoria, "PM"]] as const) {
        try {
          await prisma.projectAssignment.create({ data: { projectId: p.id, userId: u.id, role } });
        } catch {}
      }
    }
  }

  console.log("Adding milestones, selections, daily logs for active projects...");

  const today = new Date();
  const addDays = (n: number) => { const d = new Date(today); d.setDate(d.getDate() + n); return d; };

  async function findProject(clientName: string, projectName: string) {
    const c = clientByName.get(clientName);
    if (!c) return null;
    return prisma.project.findFirst({ where: { clientId: c.id, name: projectName } });
  }

  async function addMilestones(projectId: string, items: [string, string, number, boolean?][]) {
    for (let i = 0; i < items.length; i++) {
      const [title, status, dayOffset, clientVisible] = items[i];
      await prisma.milestone.create({
        data: {
          projectId,
          title,
          status,
          order: i,
          dueDate: addDays(dayOffset),
          clientVisible: clientVisible ?? true,
        },
      });
    }
  }

  async function addSelections(projectId: string, items: [string, string, number, string, number?][]) {
    for (const [category, option, priceCents, status, decidedDaysAgo] of items) {
      await prisma.selection.create({
        data: {
          projectId,
          category,
          option,
          priceCents,
          status,
          decidedAt: decidedDaysAgo !== undefined ? addDays(-decidedDaysAgo) : null,
        },
      });
    }
  }

  async function addLog(projectId: string, authorId: string, dayOffset: number, notes: string, clientVisible: boolean, weather?: string, crew?: string, hours?: number) {
    await prisma.dailyLog.create({
      data: {
        projectId,
        authorId,
        date: addDays(dayOffset),
        notes,
        clientVisible,
        weather,
        crewOnSite: crew,
        hoursWorked: hours,
      },
    });
  }

  const cleggBasement = await findProject("Lindsey Clegg", "90 William Stephenson Drive — Basement");
  if (cleggBasement) {
    await addMilestones(cleggBasement.id, [
      ["Initial intake call", "DONE", -95, true],
      ["Client Vision & Design Intake completed", "DONE", -91, true],
      ["Design proposal draft", "IN_PROGRESS", 7, true],
      ["Design proposal review with client", "PENDING", 14, true],
      ["Sign design proposal & pay design fee", "PENDING", 21, true],
      ["Floor plans finalized", "PENDING", 45, true],
      ["Construction estimate proposal", "PENDING", 60, true],
      ["Project kickoff call", "PENDING", 70, true],
    ]);
    await addSelections(cleggBasement.id, [
      ["Interior Doors", "Panel doors (3-panel); glass at wine area", 0, "PROPOSED"],
      ["Trim — Baseboards & Casings", "Step bevel", 0, "APPROVED", 30],
      ["Flooring — Main spaces", "Wide-plank vinyl plank, matte or satin", 0, "PROPOSED"],
      ["Flooring — Bathroom", "Tile (different pattern than main)", 0, "PROPOSED"],
      ["Cabinetry", "Mixed-wood stained, two-toned with accent colours", 0, "PROPOSED"],
      ["Cabinet hardware", "Black knobs/pulls", 0, "APPROVED", 30],
      ["Countertops", "Quartz or wood (color TBD)", 0, "PROPOSED"],
      ["Bathroom Countertop", "Quartz", 0, "PROPOSED"],
      ["Backsplash", "Different from countertop (color/pattern TBD)", 0, "PROPOSED"],
      ["Accent wall feature", "Slatted wood panelling / geometric feature wall", 0, "PROPOSED"],
      ["Fireplace", "Electric feature fireplace", 0, "PROPOSED"],
      ["Ceiling", "Smooth, with optional faux beams as accent", 0, "PROPOSED"],
      ["Lighting", "Pot lights + under-cabinet + LED vanity mirrors + sconces + accent", 0, "PROPOSED"],
      ["Electrical rough-in", "EV port rough-in", 0, "APPROVED", 60],
      ["Paint", "Neutral base with dark/bold accent colours", 0, "PROPOSED"],
    ]);
    await addLog(cleggBasement.id, michelle.id, -91, "Design intake form complete. Lindsay leans transitional/luxurious with bold accents. Mixed-wood stained cabinets confirmed direction. Need to mock up two-tone island vs full match in next design meeting. EV port location TBD with electrician — discussed with Lindsay's husband on garage side. Pinterest invite sent.", true);
    await addLog(cleggBasement.id, michelle.id, -10, "Design draft v1 ready for internal review. Sam to render slatted accent wall option vs geometric panel option. Next meeting target: this week.", false);
  }

  const matthewsGarage = await findProject("James Matthews", "22 Bayview Lane — Garage Addition");
  if (matthewsGarage) {
    await addMilestones(matthewsGarage.id, [
      ["Revised drawings to building inspector", "DONE", -125, true],
      ["Backfill inspection scheduled with Mel", "DONE", -125, true],
      ["Backfill inspection complete", "DONE", -125, true],
      ["Truss & lintel details to Glen (engineer)", "DONE", -105, false],
      ["Bayview window updates ordered", "DONE", -85, false],
      ["Schedule 1 form signed by Glen", "IN_PROGRESS", 3, false],
      ["Schedule 1 form resubmitted to permit office", "PENDING", 5, false],
      ["Permit review complete", "PENDING", 30, true],
      ["Permit issued", "PENDING", 45, true],
      ["Construction start", "PENDING", 60, true],
    ]);
    await addLog(matthewsGarage.id, ashley.id, -2, "Followed up with Adam on Schedule 1 — he has it filled out, just needs Glen's signature. Will receive completed form for resubmission. Permit review initiated with original drawings.", false);
    await addLog(matthewsGarage.id, ashley.id, -125, "Backfill inspection done. Building inspector Jon Cunningham received revised drawings with footing changes. $150 review fee possible. Mel coordinating online submission going forward.", false);
    await addLog(matthewsGarage.id, mike.id, -105, "Specced truss & lintel details for second-floor garage windows — windows increased in size during change order, need confirmation that lintels were spec'd accordingly. Sent details to Glen for review.", false);
  }

  const lindaBoathouse = await findProject("Linda Paterson-Bier", "Boathouse — 137 Lightning Point Rd");
  if (lindaBoathouse) {
    await addMilestones(lindaBoathouse.id, [
      ["First intake call", "DONE", -55, true],
      ["Design call #1 — Teams", "DONE", -55, true],
      ["Pinterest board shared", "DONE", -54, true],
      ["Second design meeting (post-Hawaii)", "PENDING", 7, true],
      ["Floor plan draft", "PENDING", 21, true],
      ["Design proposal", "PENDING", 35, true],
      ["Sign design proposal & pay design fee", "PENDING", 42, true],
      ["Construction estimate", "PENDING", 70, true],
    ]);
    await addSelections(lindaBoathouse.id, [
      ["Style direction", "Serena & Lily aesthetic (per Linda)", 0, "PROPOSED"],
      ["Bar layout", "Bar seating on both sides of double door", 0, "PROPOSED"],
      ["Railing — Upper decking", "Style TBD — Linda shared inspiration photos", 0, "PROPOSED"],
    ]);
    await addLog(lindaBoathouse.id, victoria.id, -55, "First Teams design call with Linda + Mark. Strong direction toward Serena & Lily styling. Discussed bar seating layout (both sides of double door), railing styles for upper decking. Linda shared inspiration photos via SMS. Pinterest board invite sent for ongoing collaboration.", true);
    await addLog(lindaBoathouse.id, victoria.id, -1, "Linda back from Hawaii — second meeting requested 'soon' to keep ball rolling on boathouse. Coordinating schedule with Nick.", false);
  }

  const hallas52Mason = await findProject("Lynn & Wayne Hallas-Coulson", "52 Mason Lane");
  if (hallas52Mason) {
    await addMilestones(hallas52Mason.id, [
      ["Survey complete", "DONE", -120, true],
      ["Initial drawings", "DONE", -90, true],
      ["Construction draws begun ($20K Feb 4)", "DONE", -106, false],
      ["Variance application prep", "IN_PROGRESS", 7, true],
      ["Permit application", "PENDING", 28, true],
      ["Site scheduling with Site Supervisor", "PENDING", 35, true],
      ["Onsite work begins", "PENDING", 56, true],
    ]);
    await addLog(hallas52Mason.id, nick.id, -106, "Construction draw $20K Feb 4 toward surveying, drawings, permit prep. Variance application pending. Lyn & Wayne available for builder inspector questions at 705-934-1295 (coulson.lott@gmail.com).", false);
    await addLog(hallas52Mason.id, ashley.id, -5, "Variance application in prep. Building inspector confirmed has copy of revised drawings; may charge $150 to re-review.", false);
  }

  const baileyLakeview = await findProject("Dave Bailey", "85 & 87 Lakeview Cottage Road");
  if (baileyLakeview) {
    await addMilestones(baileyLakeview.id, [
      ["Initial design call setup (Kate & Dave)", "DONE", -118, true],
      ["Design call — Friday review", "DONE", -113, true],
      ["Tree removal quote received from Chris ($6,400)", "DONE", -7, false],
      ["Floor plans draft", "IN_PROGRESS", 21, true],
      ["Site clearing scheduled", "PENDING", 28, false],
      ["Design proposal", "PENDING", 45, true],
    ]);
    await addLog(baileyLakeview.id, nick.id, -118, "Set up design call directly with Aunt Kate & Uncle Dave for Friday Jan 23. Will handle until floor plans drafted then bring in Victoria. Updating BuilderTrend lead.", false);
    await addLog(baileyLakeview.id, nick.id, -7, "Tree removal quote in from Chris: $6,400 for marked trees, excluding stump grinding. Site clearing schedule pending design approval.", false);
  }

  const seanProposal = await findProject("Sean & Sherri Walker", "Walker Family Home Update");
  if (seanProposal) {
    await addMilestones(seanProposal.id, [
      ["First intake (Victoria)", "DONE", -48, true],
      ["Onsite proposal meeting Apr 16 9am", "DONE", -34, true],
      ["Tailored construction proposal — internal draft", "IN_PROGRESS", 7, false],
      ["Proposal presented to Sean & Sherri", "PENDING", 14, true],
      ["Sign proposal & deposit", "PENDING", 21, true],
    ]);
    await addLog(seanProposal.id, nick.id, -34, "Onsite meeting at Walker home. Demo already started by client. Reviewed scope — family home update. Will not send quote by email; tailored in-person walkthrough next. Project important to family; budget conversation deferred to in-person.", false);
  }

  const bryceMarshall = await findProject("Bryce Marshall", "Marshall — Structural review");
  if (bryceMarshall) {
    await addMilestones(bryceMarshall.id, [
      ["Voicemail intake (Victoria)", "DONE", -75, true],
      ["Onsite consultation Mar 23 12:30-1:30", "DONE", -58, true],
      ["Structural assessment notes", "IN_PROGRESS", 7, false],
      ["Quote for structural work", "PENDING", 21, true],
    ]);
    await addLog(bryceMarshall.id, nick.id, -58, "Onsite consult done at Marshall property. Structural issues confirmed — full notes pending. Will follow up with formal quote once scope is clarified.", false);
  }

  console.log("Creating SMS threads + messages from Quo...");
  let threadCount = 0;
  let messageCount = 0;
  let linkedCount = 0;

  for (const conv of CONVERSATIONS) {
    const sorted = [...conv.messages].sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());
    const lastAt = new Date(sorted[sorted.length - 1].ts);
    let clientId: string | null = null;
    if (conv.phone) clientId = clientByPhone.get(normalizePhone(conv.phone)) ?? null;
    if (!clientId && conv.matchSurname) clientId = clientBySurname.get(conv.matchSurname) ?? null;

    const projectId = clientId ? (await prisma.project.findFirst({ where: { clientId } }))?.id ?? null : null;

    const subject = conv.subjectOverride ?? (conv.kind === "NOISE" ? `Unknown · ${formatPhone(conv.phone)}` : conv.fromName);
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

    console.log(`  ${conv.kind.padEnd(6)} ${conv.fromName.padEnd(28)} ${sorted.length} msgs  ${clientId ? "→ linked" : "(unlinked)"}`);
  }

  console.log(`
Real-data seed complete.
  Clients:   ${allClients.length} (${CLIENTS.length} historical + ${NEW_LEADS.length} active leads)
  Projects:  ${allClients.reduce((n, c) => n + c.projects.length, 0)}
  Threads:   ${threadCount} (${linkedCount} linked to clients)
  Messages:  ${messageCount}

Team logins (password: demo)
  CEO    : nick@henleycontracting.com
  CEO    : mike@henleycontracting.com
  OFFICE : ashley@henleycontracting.com  (permits)
  OFFICE : victoria@henleycontracting.com  (client concierge)
  OFFICE : nikki@henleycontracting.com  (quotes)
  OFFICE : michelle@henleycontracting.com  (design)
  FIELD  : site@henleycontracting.com

Client portal logins (password: demo)
  ${CLIENTS.filter((c) => c.createPortalLogin && c.primaryEmail).map((c) => `${c.primaryEmail}  (${c.name})`).join("\n  ")}
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
