import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/roles";
import PageHeader from "@/components/PageHeader";
import CatalogTabs from "@/components/catalog/CatalogTabs";

export default async function JobsCatalogPage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");
  const role = session.user.role as Role;
  if (role !== "CEO" && role !== "OFFICE") redirect("/dashboard");

  const [items, codes, types] = await Promise.all([
    prisma.costItem.findMany({ orderBy: { name: "asc" } }).catch(() => []),
    prisma.costCode.findMany({ orderBy: { number: "asc" } }).catch(() => []),
    prisma.costType.findMany({ orderBy: { name: "asc" } }).catch(() => []),
  ]);

  return (
    <div>
      <PageHeader
        title="Catalog"
        subtitle="Cost items, codes and types — synced from JobTread, usable in Estimates."
      />
      <div className="px-6 pb-8">
        <CatalogTabs
          items={items.map((i) => ({
            id: i.id,
            name: i.name,
            description: i.description,
            unit: i.unit,
            unitCostCents: i.unitCostCents,
            unitPriceCents: i.unitPriceCents,
            taxable: i.taxable,
            active: i.active,
            costTypeId: i.costTypeId,
            costCodeId: i.costCodeId,
          }))}
          codes={codes.map((c) => ({
            id: c.id,
            number: c.number,
            name: c.name,
            parentId: c.parentId,
            active: c.active,
          }))}
          types={types.map((t) => ({
            id: t.id,
            name: t.name,
            defaultMarginPct: t.defaultMarginPct,
            defaultMarkupPct: t.defaultMarkupPct,
            taxable: t.taxable,
          }))}
          canEdit
        />
      </div>
    </div>
  );
}
