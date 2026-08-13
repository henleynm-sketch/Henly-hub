// Seeds the SOP Checklist Engine from Henley's Project SOP workbook.
// Source data: packages/db/prisma/data/henley-sop.json (extracted from
// ADDRESS__Project_Checklists.xlsx). Idempotent: upserts each SOP step by its
// `step` id and rebuilds that step's checklist items.
//
//   npm run db:seed:sop -w @repo/db
import { readFileSync } from "fs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type SopItem = { section: string | null; task: string };
type SopStep = {
  stage: string;
  step: string;
  title: string;
  ownerRole: string | null;
  targetDays: string | null;
  items: SopItem[];
  gate: string | null;
};

async function main() {
  const raw = readFileSync(new URL("./data/henley-sop.json", import.meta.url), "utf8");
  const sop = JSON.parse(raw) as { steps: SopStep[] };

  let order = 0;
  let itemCount = 0;
  for (const s of sop.steps) {
    const tpl = await prisma.checklistTemplate.upsert({
      where: { step: s.step },
      update: {
        stage: s.stage,
        title: s.title,
        ownerRole: s.ownerRole ?? null,
        target: s.targetDays ?? null,
        gateTitle: s.gate ?? null,
        orderIndex: order,
        isGate: true,
      },
      create: {
        step: s.step,
        stage: s.stage,
        title: s.title,
        ownerRole: s.ownerRole ?? null,
        target: s.targetDays ?? null,
        gateTitle: s.gate ?? null,
        orderIndex: order,
        isGate: true,
      },
    });

    // Rebuild this step's items so re-seeding stays clean.
    await prisma.checklistTemplateItem.deleteMany({ where: { templateId: tpl.id } });
    let i = 0;
    for (const it of s.items) {
      await prisma.checklistTemplateItem.create({
        data: { templateId: tpl.id, section: it.section ?? null, task: it.task, orderIndex: i++ },
      });
      itemCount++;
    }
    order++;
  }

  const stages = await prisma.checklistTemplate.groupBy({ by: ["stage"], _count: true });
  console.log(`Seeded ${order} SOP steps, ${itemCount} checklist items across ${stages.length} stages:`);
  for (const g of stages) console.log(`  ${g._count} steps · ${g.stage}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
