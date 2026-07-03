import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canManageTeam } from "@/lib/roles";
import type { Role } from "@/lib/roles";

export async function GET() {
  const session = await auth();
  if (!session?.user || !canManageTeam(session.user.role as Role)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const [clients, projects, milestones, dailyLogs, budgetItems, documents, threads, messages, estimates, estimateLines, contracts, selections, assignments, timeEntries, users, departments, auditLog] =
    await Promise.all([
      prisma.client.findMany(),
      prisma.project.findMany(),
      prisma.milestone.findMany(),
      prisma.dailyLog.findMany(),
      prisma.budgetItem.findMany(),
      prisma.document.findMany(),
      prisma.thread.findMany(),
      prisma.message.findMany(),
      prisma.estimate.findMany(),
      prisma.estimateLine.findMany(),
      prisma.contract.findMany(),
      prisma.selection.findMany(),
      prisma.projectAssignment.findMany(),
      prisma.timeEntry.findMany(),
      prisma.user.findMany({
        select: {
          id: true, email: true, name: true, role: true, focusArea: true,
          department: true, reportsToId: true, active: true, createdAt: true,
        },
      }),
      prisma.department.findMany().catch(() => []),
      prisma.auditLog.findMany().catch(() => []),
    ]);

  const payload = {
    exportedAt: new Date().toISOString(),
    exportedBy: session.user.email,
    clients, projects, milestones, dailyLogs, budgetItems, documents,
    threads, messages, estimates, estimateLines, contracts, selections,
    assignments, timeEntries, users, departments, auditLog,
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="henley-hub-export-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
