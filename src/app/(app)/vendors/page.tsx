import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/PageHeader";
import type { Role } from "@/lib/roles";
import VendorsClient from "./VendorsClient";
import { VENDOR_TRADE, VENDOR_TYPE, DIVISION } from "@/lib/taxonomy";

export default async function VendorsPage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");

  const role = session.user.role as Role;
  if (role !== "CEO" && role !== "OFFICE") redirect("/dashboard");

  const now = new Date();
  const cutoff30 = new Date();
  cutoff30.setDate(now.getDate() + 30);

  const vendors = await prisma.vendor.findMany({
    where: { archivedAt: null },
    orderBy: [{ name: "asc" }],
  });

  // Serialize DateTime fields for client component
  const serialized = vendors.map((v) => ({
    id:           v.id,
    name:         v.name,
    trade:        v.trade,
    type:         v.type,
    email:        v.email,
    officePhone:  v.officePhone,
    fax:          v.fax,
    division:     v.division,
    w9OnFile:     v.w9OnFile,
    coiExpiresAt: v.coiExpiresAt?.toISOString() ?? null,
    notes:        v.notes,
    createdAt:    v.createdAt.toISOString(),
    updatedAt:    v.updatedAt.toISOString(),
  }));

  // Compliance summary counts
  const expiredCount  = vendors.filter((v) => v.coiExpiresAt && v.coiExpiresAt < now).length;
  const expiringCount = vendors.filter(
    (v) => v.coiExpiresAt && v.coiExpiresAt >= now && v.coiExpiresAt <= cutoff30
  ).length;
  const missingW9Count = vendors.filter((v) => !v.w9OnFile).length;

  return (
    <>
      <PageHeader
        title="Vendors"
        subtitle={`${vendors.length} vendor${vendors.length !== 1 ? "s" : ""} · W-9 and COI compliance`}
      />
      <div className="p-6">
        <VendorsClient
          vendors={serialized}
          vendorTrades={[...VENDOR_TRADE]}
          vendorTypes={[...VENDOR_TYPE]}
          divisions={[...DIVISION]}
          complianceSummary={{ expiredCount, expiringCount, missingW9Count }}
        />
      </div>
    </>
  );
}
