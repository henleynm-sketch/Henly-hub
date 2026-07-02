import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/roles";
import PageHeader from "@/components/PageHeader";
import JobTreadCard from "@/components/settings/JobTreadCard";
import { getJobTreadCardData } from "@/lib/jobtreadCardData";
import { canManageTeam } from "@/lib/roles";
import { formatRelative } from "@/lib/utils";

export default async function JobTreadPage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");
  const role = session.user.role as Role;
  if (role !== "CEO" && role !== "OFFICE") redirect("/dashboard");
  const isCeo = canManageTeam(role);

  const data = await getJobTreadCardData();

  const [clients, vendors, projects, dailyLogs, lastLog] = await Promise.all([
    prisma.client.count({ where: { jobtreadAccountId: { not: null } } }).catch(() => 0),
    prisma.vendor.count({ where: { jobtreadAccountId: { not: null } } }).catch(() => 0),
    prisma.project.count({ where: { jobtreadJobId: { not: null } } }).catch(() => 0),
    prisma.dailyLog.count({ where: { jobtreadId: { not: null } } }).catch(() => 0),
    prisma.dailyLog
      .findFirst({ where: { jobtreadId: { not: null } }, orderBy: { date: "desc" } })
      .catch(() => null),
  ]);

  const rows = [
    { label: "Clients linked to JobTread accounts", count: clients, href: "/clients" },
    { label: "Vendors linked to JobTread accounts", count: vendors, href: "/vendors" },
    { label: "Projects linked to JobTread jobs", count: projects, href: "/projects" },
    { label: "Daily logs synced from JobTread", count: dailyLogs, href: "/projects" },
  ];

  return (
    <div>
      <PageHeader
        title="JobTread"
        subtitle="Live connection, sync status, and everything pulled from the JobTread org."
        actions={
          <a
            href="https://app.jobtread.com"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary text-xs"
          >
            Open JobTread ↗
          </a>
        }
      />

      <div className="px-6 pb-8 flex flex-col gap-5 max-w-3xl">
        <section className="hh-panel p-6 flex flex-col gap-5">
          <h2 className="hh-label">Connection</h2>
          <JobTreadCard data={data} isCeo={isCeo} canTest />
        </section>

        <section className="hh-panel p-6 flex flex-col gap-3">
          <h2 className="hh-label">Synced records</h2>
          {data.lastSyncAt ? (
            <>
              {rows.map((r) => (
                <Link key={r.label} href={r.href} className="hh-row hh-row--flat">
                  <span className="hh-primary flex-1">{r.label}</span>
                  <span className="hh-secondary tabular-nums">{r.count}</span>
                </Link>
              ))}
              <span className="hh-caption">
                Last sync {formatRelative(new Date(data.lastSyncAt))}
                {lastLog ? ` · newest synced log ${formatRelative(lastLog.date)}` : ""}
              </span>
            </>
          ) : (
            <span className="hh-secondary">
              Nothing synced yet — run the first sync from the connection card above
              {isCeo ? "" : " (CEO only)"}.
            </span>
          )}
        </section>
      </div>
    </div>
  );
}
