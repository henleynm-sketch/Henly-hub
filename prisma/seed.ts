import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Resetting seed data…");
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

  console.log("Creating clients…");
  const clientsData = [
    {
      name: "Rachel & Tom Tomlinson",
      primaryEmail: "rachel.t@example.com",
      primaryPhone: "(919) 555-0144",
      address: "412 Magnolia Ln",
      city: "Chapel Hill",
      state: "NC",
      zip: "27514",
      stage: "ACTIVE",
      source: "Referral · Watson",
      notes: "Loves modern farmhouse style. Allergic to red oak — use white oak only.",
    },
    {
      name: "Vargas Family",
      primaryEmail: "miguel.vargas@example.com",
      primaryPhone: "(919) 555-0182",
      address: "88 Ridgewood Dr",
      city: "Durham",
      state: "NC",
      zip: "27707",
      stage: "ACTIVE",
      source: "Web inquiry",
      notes: "Two-phase project — kitchen first, then primary suite next year.",
    },
    {
      name: "Dr. Anita Patel",
      primaryEmail: "anita.p@example.com",
      primaryPhone: "(919) 555-0117",
      address: "9 Forest Hills Rd",
      city: "Raleigh",
      state: "NC",
      zip: "27609",
      stage: "PROPOSAL",
      source: "Houzz",
      notes: "Estimate sent for screened porch addition. Decision by end of month.",
    },
    {
      name: "Brennan Build-Out (Lake House)",
      primaryEmail: "brennan@example.com",
      primaryPhone: "(919) 555-0163",
      address: "55 Shoreline Way",
      city: "Hillsborough",
      state: "NC",
      zip: "27278",
      stage: "QUALIFIED",
      source: "Past client",
      notes: "Wants budget estimate before architectural plans.",
    },
    {
      name: "Hawthorne Residence",
      primaryEmail: "lisa.h@example.com",
      primaryPhone: "(919) 555-0179",
      address: "201 Orchard Ave",
      city: "Cary",
      state: "NC",
      zip: "27513",
      stage: "LEAD",
      source: "Referral · Patel",
      notes: "Initial call done. Sending follow-up with intake packet.",
    },
    {
      name: "Cooper Family",
      primaryEmail: "j.cooper@example.com",
      primaryPhone: "(919) 555-0193",
      stage: "PAST",
      source: "Referral",
      notes: "Kitchen remodel completed last year. Possible bathroom in 2026.",
    },
  ];
  const clients = await Promise.all(clientsData.map((d) => prisma.client.create({ data: d })));

  const [tomlinson, vargas, patel, brennan, hawthorne, cooper] = clients;

  console.log("Creating users…");
  const kyle = await prisma.user.create({
    data: {
      email: "kyle@henleyhub.com",
      name: "Kyle Henley",
      passwordHash: pw,
      role: "CEO",
      focusArea: "Sales & Vision",
      phone: "(919) 555-0100",
    },
  });
  const morgan = await prisma.user.create({
    data: {
      email: "morgan@henleyhub.com",
      name: "Morgan Reyes",
      passwordHash: pw,
      role: "OFFICE",
      focusArea: "Project Coordination",
    },
  });
  const sam = await prisma.user.create({
    data: {
      email: "sam@henleyhub.com",
      name: "Sam Park",
      passwordHash: pw,
      role: "OFFICE",
      focusArea: "Design & Selections",
    },
  });
  const jess = await prisma.user.create({
    data: {
      email: "jess@henleyhub.com",
      name: "Jess Whitman",
      passwordHash: pw,
      role: "FIELD",
      focusArea: "Lead Carpenter",
    },
  });
  const danny = await prisma.user.create({
    data: {
      email: "danny@henleyhub.com",
      name: "Danny Kruger",
      passwordHash: pw,
      role: "FIELD",
      focusArea: "Production",
    },
  });
  const tilePro = await prisma.user.create({
    data: {
      email: "tile-pro@subs.com",
      name: "Marcus (TilePro)",
      passwordHash: pw,
      role: "SUB",
      focusArea: "Tile / Stone",
    },
  });
  const electricSub = await prisma.user.create({
    data: {
      email: "watt@subs.com",
      name: "Watt Brothers Electric",
      passwordHash: pw,
      role: "SUB",
      focusArea: "Electrical",
    },
  });
  const rachelLogin = await prisma.user.create({
    data: {
      email: "rachel.t@example.com",
      name: "Rachel Tomlinson",
      passwordHash: pw,
      role: "CLIENT",
      clientId: tomlinson.id,
    },
  });
  const vargasLogin = await prisma.user.create({
    data: {
      email: "miguel.vargas@example.com",
      name: "Miguel Vargas",
      passwordHash: pw,
      role: "CLIENT",
      clientId: vargas.id,
    },
  });

  console.log("Creating projects…");
  const tomlinsonKitchen = await prisma.project.create({
    data: {
      clientId: tomlinson.id,
      name: "Tomlinson Kitchen + Pantry Remodel",
      address: "412 Magnolia Ln, Chapel Hill, NC",
      status: "IN_PROGRESS",
      startDate: new Date("2026-03-15"),
      targetEnd: new Date("2026-07-30"),
      contractCents: 14250000,
      budgetCents: 11200000,
      description:
        "Full kitchen remodel: island, white-oak custom cabinets, quartz counters, walk-in pantry conversion.",
    },
  });
  const vargasPrimary = await prisma.project.create({
    data: {
      clientId: vargas.id,
      name: "Vargas Primary Suite Addition",
      address: "88 Ridgewood Dr, Durham, NC",
      status: "IN_PROGRESS",
      startDate: new Date("2026-04-02"),
      targetEnd: new Date("2026-09-15"),
      contractCents: 22800000,
      budgetCents: 18400000,
      description: "320 sf primary suite addition with spa bath and walk-in closet.",
    },
  });
  const patelPorch = await prisma.project.create({
    data: {
      clientId: patel.id,
      name: "Patel Screened Porch",
      address: "9 Forest Hills Rd, Raleigh, NC",
      status: "PLANNING",
      startDate: new Date("2026-06-01"),
      targetEnd: new Date("2026-08-15"),
      contractCents: 8400000,
      budgetCents: 6800000,
      description: "14×16 screened porch with vaulted ceiling and outdoor fireplace.",
    },
  });
  const cooperPast = await prisma.project.create({
    data: {
      clientId: cooper.id,
      name: "Cooper Kitchen (closed)",
      address: "—",
      status: "COMPLETE",
      startDate: new Date("2025-02-01"),
      targetEnd: new Date("2025-06-15"),
      contractCents: 9800000,
      budgetCents: 8500000,
      description: "Kitchen remodel completed 2025.",
    },
  });

  console.log("Assigning team to projects…");
  const assignments: { projectId: string; userId: string; role: string }[] = [
    { projectId: tomlinsonKitchen.id, userId: kyle.id, role: "PM" },
    { projectId: tomlinsonKitchen.id, userId: morgan.id, role: "PM" },
    { projectId: tomlinsonKitchen.id, userId: sam.id, role: "DESIGNER" },
    { projectId: tomlinsonKitchen.id, userId: jess.id, role: "LEAD" },
    { projectId: tomlinsonKitchen.id, userId: tilePro.id, role: "SUB" },
    { projectId: tomlinsonKitchen.id, userId: electricSub.id, role: "SUB" },

    { projectId: vargasPrimary.id, userId: morgan.id, role: "PM" },
    { projectId: vargasPrimary.id, userId: jess.id, role: "LEAD" },
    { projectId: vargasPrimary.id, userId: danny.id, role: "CREW" },
    { projectId: vargasPrimary.id, userId: electricSub.id, role: "SUB" },

    { projectId: patelPorch.id, userId: kyle.id, role: "PM" },
    { projectId: patelPorch.id, userId: sam.id, role: "DESIGNER" },
  ];
  for (const a of assignments) {
    await prisma.projectAssignment.create({ data: a });
  }

  console.log("Creating milestones…");
  const tomlinsonMilestones = [
    ["Demo and disposal", "DONE", -30],
    ["Rough plumbing & electric", "DONE", -14],
    ["Drywall and prime", "IN_PROGRESS", 4],
    ["Cabinet install", "PENDING", 18],
    ["Counter template & install", "PENDING", 32],
    ["Tile backsplash", "PENDING", 38],
    ["Final electrical & plumbing", "PENDING", 45],
    ["Punch list & walkthrough", "PENDING", 60],
  ];
  await Promise.all(
    tomlinsonMilestones.map(([title, status, dayOffset], idx) =>
      prisma.milestone.create({
        data: {
          projectId: tomlinsonKitchen.id,
          title: String(title),
          status: String(status),
          order: idx,
          clientVisible: true,
          dueDate: addDays(new Date(), dayOffset as number),
        },
      })
    )
  );

  const vargasMilestones = [
    ["Permit approval", "DONE", -20],
    ["Foundation & framing", "IN_PROGRESS", 5],
    ["Roof dry-in", "PENDING", 18],
    ["Rough mechanicals", "PENDING", 30],
    ["Insulation & drywall", "PENDING", 45],
    ["Tile & cabinets", "PENDING", 65],
    ["Final finishes", "PENDING", 90],
    ["Closeout & cleaning", "PENDING", 110],
  ];
  await Promise.all(
    vargasMilestones.map(([title, status, dayOffset], idx) =>
      prisma.milestone.create({
        data: {
          projectId: vargasPrimary.id,
          title: String(title),
          status: String(status),
          order: idx,
          clientVisible: true,
          dueDate: addDays(new Date(), dayOffset as number),
        },
      })
    )
  );

  console.log("Creating budget items…");
  const tomlinsonBudget = [
    ["Demolition", "Tear-out & dumpster", 280000, 295500],
    ["Framing", "Header revision over island", 145000, 132000],
    ["Plumbing", "Re-route to island + new pantry sink", 380000, 402000],
    ["Electrical", "Panel upgrade, recessed, undercabinet", 525000, 514000],
    ["HVAC", "Relocate return duct", 165000, 168000],
    ["Drywall", "Drywall + level 4 finish", 220000, 0],
    ["Cabinets", "White oak custom", 4200000, 0],
    ["Countertops", "Quartz", 980000, 0],
    ["Tile", "Backsplash + pantry floor", 320000, 0],
    ["Flooring", "Refinish existing oak", 280000, 0],
    ["Paint", "Whole kitchen + pantry", 240000, 0],
    ["Project management", "PM allocation", 950000, 410000],
  ];
  for (const [cat, desc, est, act] of tomlinsonBudget) {
    await prisma.budgetItem.create({
      data: {
        projectId: tomlinsonKitchen.id,
        category: String(cat),
        description: String(desc),
        estimateCents: Number(est),
        actualCents: Number(act),
      },
    });
  }

  const vargasBudget = [
    ["Permits", "Building + electrical permits", 95000, 95000],
    ["Foundation", "Footings + slab", 1480000, 1495000],
    ["Framing", "Walls, roof, sheathing", 2950000, 1840000],
    ["Roofing", "Architectural shingles", 740000, 0],
    ["Plumbing", "Spa bath rough + fixtures", 1280000, 320000],
    ["Electrical", "New circuits, lighting", 940000, 240000],
    ["HVAC", "New zone for suite", 820000, 0],
    ["Insulation", "Spray foam roof + batt walls", 540000, 0],
    ["Drywall", "Hang, finish, prime", 480000, 0],
    ["Tile", "Bath floor, shower, surround", 880000, 0],
    ["Cabinets", "Walk-in closet + vanity", 1450000, 0],
    ["Project management", "PM allocation", 1500000, 380000],
  ];
  for (const [cat, desc, est, act] of vargasBudget) {
    await prisma.budgetItem.create({
      data: {
        projectId: vargasPrimary.id,
        category: String(cat),
        description: String(desc),
        estimateCents: Number(est),
        actualCents: Number(act),
      },
    });
  }

  console.log("Creating daily logs…");
  await prisma.dailyLog.createMany({
    data: [
      {
        projectId: tomlinsonKitchen.id,
        authorId: jess.id,
        date: addDays(new Date(), -3),
        notes:
          "Drywall hung in kitchen + pantry. Mudders started corners. Pantry door header had to be reframed for new opening — added 2 hrs.",
        weather: "62°F, clear",
        crewOnSite: "Jess + Danny + 2 sub drywallers",
        hoursWorked: 18,
        clientVisible: true,
      },
      {
        projectId: tomlinsonKitchen.id,
        authorId: jess.id,
        date: addDays(new Date(), -2),
        notes:
          "Drywall mud second coat done. Started prep for primer. Need to confirm cabinet delivery date with Sam.",
        weather: "55°F, light rain pm",
        crewOnSite: "Jess + 1",
        hoursWorked: 9,
        clientVisible: true,
      },
      {
        projectId: tomlinsonKitchen.id,
        authorId: morgan.id,
        date: addDays(new Date(), -1),
        notes:
          "Internal: client texted asking about counter sample timing. Sam to bring options Thursday.",
        clientVisible: false,
      },
      {
        projectId: vargasPrimary.id,
        authorId: jess.id,
        date: addDays(new Date(), -1),
        notes:
          "Roof framing 80% complete. Need to set ridge beam tomorrow — crane scheduled 7am. Pulled exterior wall sheathing forward.",
        weather: "70°F, sunny",
        crewOnSite: "Jess + Danny + 3-man framing crew",
        hoursWorked: 28,
        clientVisible: true,
      },
      {
        projectId: vargasPrimary.id,
        authorId: danny.id,
        date: new Date(),
        notes:
          "Ridge beam set. Roof sheathing complete on west side. Will dry-in tomorrow before forecast rain Wednesday.",
        weather: "73°F, sunny",
        crewOnSite: "Jess + Danny + 3",
        hoursWorked: 32,
        clientVisible: true,
      },
    ],
  });

  console.log("Creating selections…");
  await prisma.selection.createMany({
    data: [
      { projectId: tomlinsonKitchen.id, category: "Cabinets", option: "White oak, rift sawn, slab front", priceCents: 4200000, status: "APPROVED", decidedAt: addDays(new Date(), -45) },
      { projectId: tomlinsonKitchen.id, category: "Countertops", option: "Cambria Brittanicca quartz", priceCents: 980000, status: "APPROVED", decidedAt: addDays(new Date(), -30) },
      { projectId: tomlinsonKitchen.id, category: "Backsplash tile", option: "Zellige white 4x4 herringbone", priceCents: 320000, status: "PROPOSED" },
      { projectId: tomlinsonKitchen.id, category: "Hardware", option: "Brushed brass cup pulls + knobs", priceCents: 92000, status: "PROPOSED" },
      { projectId: vargasPrimary.id, category: "Shower tile", option: "Carrara marble subway 3x12", priceCents: 480000, status: "PROPOSED" },
    ],
  });

  console.log("Creating estimates…");
  const patelEstimate = await prisma.estimate.create({
    data: {
      clientId: patel.id,
      authorId: kyle.id,
      number: "EST-1001",
      title: "Patel Screened Porch — Initial Estimate",
      status: "SENT",
      subtotalCents: 8400000,
      taxCents: 0,
      totalCents: 8400000,
      notes: "Includes vaulted T&G ceiling and outdoor masonry fireplace. Excludes electrical fixtures.",
      lineItems: {
        create: [
          { category: "Permits", description: "Building + electrical permits", quantity: 1, unitCents: 95000, totalCents: 95000 },
          { category: "Foundation", description: "Concrete piers and slab", quantity: 1, unitCents: 980000, totalCents: 980000 },
          { category: "Framing", description: "14x16 framing + vaulted ceiling", quantity: 1, unitCents: 2200000, totalCents: 2200000 },
          { category: "Roofing", description: "Match existing shingles", quantity: 1, unitCents: 540000, totalCents: 540000 },
          { category: "Screens", description: "EZ-Breeze panel system", quantity: 8, unitCents: 95000, totalCents: 760000 },
          { category: "Masonry", description: "Outdoor fireplace + chimney", quantity: 1, unitCents: 2400000, totalCents: 2400000 },
          { category: "Electrical", description: "Receptacles, ceiling fan rough, switch", quantity: 1, unitCents: 425000, totalCents: 425000 },
          { category: "Project management", description: "PM and supervision", quantity: 1, unitCents: 1000000, totalCents: 1000000 },
        ],
      },
    },
  });

  await prisma.estimate.create({
    data: {
      clientId: brennan.id,
      authorId: kyle.id,
      number: "EST-1002",
      title: "Brennan Lake House — Budget Estimate",
      status: "DRAFT",
      subtotalCents: 17500000,
      taxCents: 0,
      totalCents: 17500000,
      notes: "Budget-level pricing pre-architectural. Subject to revision after plans.",
      lineItems: {
        create: [
          { category: "Design fees", description: "Architectural coordination", quantity: 1, unitCents: 850000, totalCents: 850000 },
          { category: "Site work", description: "Lakeside grading + retaining", quantity: 1, unitCents: 2400000, totalCents: 2400000 },
          { category: "Foundation", description: "Slab and footings", quantity: 1, unitCents: 1850000, totalCents: 1850000 },
          { category: "Framing", description: "Whole-house addition framing", quantity: 1, unitCents: 4200000, totalCents: 4200000 },
          { category: "Mechanicals", description: "Plumbing, electrical, HVAC rough", quantity: 1, unitCents: 3200000, totalCents: 3200000 },
          { category: "Finishes", description: "Cabinets, tile, paint, flooring", quantity: 1, unitCents: 4000000, totalCents: 4000000 },
          { category: "Project management", description: "PM allocation", quantity: 1, unitCents: 1000000, totalCents: 1000000 },
        ],
      },
    },
  });

  console.log("Creating threads + messages…");
  const t1 = await prisma.thread.create({
    data: {
      clientId: tomlinson.id,
      projectId: tomlinsonKitchen.id,
      subject: "Counter sample timing",
      channel: "SMS",
      lastAt: addDays(new Date(), -1),
    },
  });
  await prisma.message.createMany({
    data: [
      {
        threadId: t1.id,
        direction: "IN",
        body: "Hi! Are we still on for the counter samples Thursday afternoon? Excited to see them in the space.",
        channel: "SMS",
        fromName: "Rachel Tomlinson",
        sentAt: addDays(new Date(), -2),
      },
      {
        threadId: t1.id,
        direction: "OUT",
        body: "Yes — Sam will swing by around 3:30 with the Cambria + a Caesarstone alternate. Bring the runner you mentioned and we'll lay it on the island.",
        channel: "SMS",
        fromName: "Morgan Reyes",
        authorId: morgan.id,
        sentAt: addDays(new Date(), -2),
      },
      {
        threadId: t1.id,
        direction: "IN",
        body: "Perfect. See you then.",
        channel: "SMS",
        fromName: "Rachel Tomlinson",
        sentAt: addDays(new Date(), -1),
      },
    ],
  });

  const t2 = await prisma.thread.create({
    data: {
      clientId: tomlinson.id,
      projectId: tomlinsonKitchen.id,
      subject: "Pantry door header — change order summary",
      channel: "EMAIL",
      lastAt: addDays(new Date(), -3),
      unread: 1,
    },
  });
  await prisma.message.createMany({
    data: [
      {
        threadId: t2.id,
        direction: "OUT",
        body: "Hi Rachel — quick note: when we opened up the pantry wall, the existing header was undersized for the wider opening you approved. We re-framed with a doubled 2x10. Adds about $480 to the framing line. Photo attached. No action needed; just keeping you in the loop.",
        channel: "EMAIL",
        fromName: "Morgan Reyes",
        authorId: morgan.id,
        sentAt: addDays(new Date(), -4),
      },
      {
        threadId: t2.id,
        direction: "IN",
        body: "Got it, thanks for the heads up. Approved.",
        channel: "EMAIL",
        fromName: "Rachel Tomlinson",
        sentAt: addDays(new Date(), -3),
      },
    ],
  });

  const t3 = await prisma.thread.create({
    data: {
      clientId: vargas.id,
      projectId: vargasPrimary.id,
      subject: "Crane day Tuesday",
      channel: "IN_APP",
      lastAt: addDays(new Date(), -1),
    },
  });
  await prisma.message.createMany({
    data: [
      {
        threadId: t3.id,
        direction: "OUT",
        body: "Reminder: crane is on site 7am Tuesday for the ridge beam. Driveway will be blocked from 6:45 to about 9. Two parking spots reserved for you on the street.",
        channel: "IN_APP",
        fromName: "Morgan Reyes",
        authorId: morgan.id,
        sentAt: addDays(new Date(), -1),
      },
      {
        threadId: t3.id,
        direction: "IN",
        body: "Got it. We'll plan around it. Will Jess be on site?",
        channel: "IN_APP",
        fromName: "Miguel Vargas",
        sentAt: addDays(new Date(), -1),
      },
    ],
  });

  const t4 = await prisma.thread.create({
    data: {
      clientId: patel.id,
      subject: "Re: Estimate EST-1001 — porch",
      channel: "EMAIL",
      lastAt: addDays(new Date(), -2),
      unread: 1,
    },
  });
  await prisma.message.createMany({
    data: [
      {
        threadId: t4.id,
        direction: "OUT",
        body: "Dr. Patel — sending the porch estimate. $84k all-in including the masonry fireplace. Happy to walk through line by line whenever works.",
        channel: "EMAIL",
        fromName: "Kyle Henley",
        authorId: kyle.id,
        sentAt: addDays(new Date(), -5),
      },
      {
        threadId: t4.id,
        direction: "IN",
        body: "Thanks Kyle. Reviewing with my husband. Question on the screen system — do other options exist that are more pet-resistant?",
        channel: "EMAIL",
        fromName: "Anita Patel",
        sentAt: addDays(new Date(), -2),
      },
    ],
  });

  const t5 = await prisma.thread.create({
    data: {
      clientId: hawthorne.id,
      subject: "Initial intake call",
      channel: "CALL_NOTE",
      lastAt: addDays(new Date(), -7),
    },
  });
  await prisma.message.create({
    data: {
      threadId: t5.id,
      direction: "OUT",
      body:
        "30 min intro call. Lisa & Mark are looking at a kitchen + open-concept project. Budget range $90-130k. Timing: late spring start. Patel referral. Sending intake packet + scheduling on-site for next week.",
      channel: "CALL_NOTE",
      fromName: "Kyle Henley",
      authorId: kyle.id,
      sentAt: addDays(new Date(), -7),
    },
  });

  console.log("Done.");
  console.log(`
Seeded demo logins (password: demo)
  CEO     : kyle@henleyhub.com
  OFFICE  : morgan@henleyhub.com
  OFFICE  : sam@henleyhub.com  (Design)
  FIELD   : jess@henleyhub.com  (Lead)
  FIELD   : danny@henleyhub.com
  SUB     : tile-pro@subs.com
  SUB     : watt@subs.com
  CLIENT  : rachel.t@example.com
  CLIENT  : miguel.vargas@example.com
`);
}

function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
