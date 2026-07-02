import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/roles";
import PageHeader from "@/components/PageHeader";
import { formatDate } from "@/lib/utils";

export default async function JobsDailyLogsPage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");
  const role = session.user.role as Role;
  if (role !== "CEO" && role !== "OFFICE") redirect("/dashboard");

  const logs = await prisma.dailyLog.findMany({
    where: { jobtreadId: { not: null } },
    orderBy: { date: "desc" },
    take: 100,
    include: { project: { select: { id: true, name: true, code: true } } },
  });

  return (
    <div>
      <PageHeader
        title="Daily Logs"
        subtitle="Synced from JobTread — internal-only until shared from the project page."
      />
      <div className="px-6 pb-8">
        <div className="hh-panel p-6 flex flex-col gap-2">
          {logs.length === 0 ? (
            <>
              <span className="hh-secondary">No synced daily logs yet.</span>
              <Link href="/jobs/connection" className="btn-secondary text-xs self-start mt-2">
                Run a sync
              </Link>
            </>
          ) : (
            logs.map((l) => (
              <Link key={l.id} href={`/projects/${l.project.id}`} className="hh-row hh-row--flat !items-start flex-col sm:flex-row">
                <div className="flex-1 min-w-0">
                  <span className="hh-primary">
                    {l.project.name}
                    {l.project.code ? ` · ${l.project.code}` : ""}
                  </span>
                  <p className="hh-secondary mt-1 line-clamp-2">
                    {l.notes.replace(/^Synced from JobTread[^\n]*\n?\n?/, "") || "—"}
                  </p>
                </div>
                <span className="hh-secondary shrink-0">{formatDate(l.date)}</span>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
