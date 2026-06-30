import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/PageHeader";
import type { Role } from "@/lib/roles";
import TemplatesClient from "./TemplatesClient";
import { JOB_TYPE } from "@/lib/taxonomy";

export default async function TemplatesPage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");

  const role = session.user.role as Role;
  if (role !== "CEO" && role !== "OFFICE") redirect("/dashboard");

  const templates = await prisma.jobTemplate.findMany({
    include: {
      scheduleItems: { orderBy: { order: "asc" } },
      budgetItems:   true,
    },
    orderBy: [{ jobType: "asc" }, { name: "asc" }],
  });

  // Serialise for client component
  const serialised = templates.map((t) => ({
    id:        t.id,
    name:      t.name,
    jobType:   t.jobType,
    createdAt: t.createdAt.toISOString(),
    scheduleItems: t.scheduleItems.map((i) => ({
      id:              i.id,
      name:            i.name,
      offsetStartDays: i.offsetStartDays,
      durationDays:    i.durationDays,
      order:           i.order,
    })),
    budgetItems: t.budgetItems.map((i) => ({
      id:          i.id,
      category:    i.category,
      budgetCents: i.budgetCents,
    })),
  }));

  return (
    <>
      <PageHeader
        title="Job Templates"
        subtitle="Pre-load schedule and budget skeletons when starting a new job"
      />
      <div className="p-6">
        <TemplatesClient templates={serialised} jobTypes={[...JOB_TYPE]} isCeo={role === "CEO"} />
      </div>
    </>
  );
}
