import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { type Role } from "@/lib/roles";
import { redirect } from "next/navigation";
import OfficeDashboard from "./OfficeDashboard";
import FieldDashboard from "./FieldDashboard";
import SubDashboard from "./SubDashboard";
import ClientDashboard from "./ClientDashboard";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ activity?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");
  const role = session.user.role as Role;
  const userId = session.user.id;
  const clientId = session.user.clientId;
  const sp = await searchParams;

  if (role === "CEO" || role === "OFFICE") {
    return <OfficeDashboard role={role} activity={sp.activity ?? "all"} />;
  }

  if (role === "FIELD") {
    const myProjects = await prisma.project.findMany({
      where: { assignments: { some: { userId } } },
      include: { client: true, milestones: { take: 5, orderBy: { order: "asc" } } },
      take: 6,
    });
    return <FieldDashboard projects={myProjects} userName={session.user.name ?? ""} />;
  }

  if (role === "SUB") {
    const myProjects = await prisma.project.findMany({
      where: { assignments: { some: { userId } } },
      include: { client: true },
      take: 6,
    });
    return <SubDashboard projects={myProjects} userName={session.user.name ?? ""} />;
  }

  if (role === "CLIENT" && clientId) {
    const project = await prisma.project.findFirst({
      where: { clientId },
      include: {
        client: true,
        milestones: { where: { clientVisible: true }, orderBy: { order: "asc" } },
        dailyLogs: {
          where: { clientVisible: true },
          orderBy: { date: "desc" },
          take: 4,
          include: { author: true },
        },
      },
    });
    return <ClientDashboard project={project} userName={session.user.name ?? ""} />;
  }

  return <div className="p-8">No dashboard for this role yet.</div>;
}
