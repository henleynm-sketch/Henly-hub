import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canSeeFinancials, canViewAllProjects, isInternal } from "@/lib/roles";
import type { Role } from "@/lib/roles";
import { formatDate, formatMoney, formatRelative } from "@/lib/utils";
import { revalidatePath } from "next/cache";
import DailyLogForm from "@/components/DailyLogForm";
import TimeClockTab from "@/components/TimeClockTab";
import TimeReviewTab from "@/components/TimeReviewTab";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export default async function ProjectDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id: projectId } = await params;
  const { tab = "overview" } = await searchParams;
  const session = await auth();
  if (!session?.user) redirect("/sign-in");
  const role = session.user.role as Role;
  const userId = session.user.id;

  // Guard active tab based on role permissions
  let activeTab = tab;
  if (activeTab === "time-clock" && !isInternal(role)) {
    activeTab = "overview";
  }
  if (activeTab === "time-review" && role !== "CEO" && role !== "OFFICE") {
    activeTab = "overview";
  }

  // Load tab-specific data
  let assignedProjects: any[] = [];
  let activeSession: any = null;
  let recentEntries: any[] = [];
  let reviewEntries: any[] = [];

  if (activeTab === "time-clock") {
    assignedProjects = await prisma.project.findMany({
      where: {
        assignments: {
          some: { userId: session.user.id }
        }
      },
      select: {
        id: true,
        name: true
      }
    });

    activeSession = await prisma.timeEntry.findFirst({
      where: {
        userId: session.user.id,
        clockOut: null
      },
      include: {
        project: {
          select: { name: true }
        }
      }
    });

    recentEntries = await prisma.timeEntry.findMany({
      where: {
        userId: session.user.id,
        projectId
      },
      include: {
        project: {
          select: { name: true }
        }
      },
      orderBy: {
        clockIn: "desc"
      },
      take: 10
    });
  }

  if (activeTab === "time-review") {
    reviewEntries = await prisma.timeEntry.findMany({
      where: {
        projectId
      },
      include: {
        user: {
          select: {
            name: true,
            email: true
          }
        }
      },
      orderBy: {
        clockIn: "desc"
      }
    });
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      client: true,
      milestones: { orderBy: { order: "asc" } },
      dailyLogs: { orderBy: { date: "desc" }, take: 12, include: { author: true } },
      budgetItems: { orderBy: { createdAt: "asc" } },
      assignments: { include: { user: true } },
      selections: true,
    },
  });
  if (!project) notFound();

  const isAssigned = project.assignments.some((a) => a.userId === userId);
  const isClient = role === "CLIENT" && session.user.clientId === project.clientId;
  if (!canViewAllProjects(role) && !isAssigned && !isClient) {
    return <div className="p-8 text-sm text-slate-500">You don't have access to this project.</div>;
  }

  const showFinancials = canSeeFinancials(role);
  const totalEstCents = project.budgetItems.reduce((a, b) => a + b.estimateCents, 0);
  const totalActCents = project.budgetItems.reduce((a, b) => a + b.actualCents, 0);
  const overUnder = totalActCents - totalEstCents;

  async function addLog(formData: FormData) {
    "use server";
    const me = await auth();
    if (!me?.user) return;
    const role = me.user.role as Role;
    if (role === "CLIENT" || role === "SUB") return;
    const notes = String(formData.get("notes") || "").trim();
    if (!notes) return;

    const photos = formData.getAll("photos") as File[];
    const savedUrls: string[] = [];

    if (photos && photos.length > 0) {
      const uploadDir = path.join(process.cwd(), "public", "uploads", "daily-logs");
      await mkdir(uploadDir, { recursive: true });

      for (const file of photos) {
        if (!file || file.size === 0) continue;

        if (!file.type.startsWith("image/")) {
          throw new Error("Only image files are allowed.");
        }

        const uniqueId = crypto.randomUUID();
        const ext = path.extname(file.name) || ".jpg";
        const filename = `${uniqueId}${ext}`;
        const filePath = path.join(uploadDir, filename);

        const buffer = Buffer.from(await file.arrayBuffer());
        await writeFile(filePath, new Uint8Array(buffer));
        savedUrls.push(`/uploads/daily-logs/${filename}`);
      }
    }

    await prisma.dailyLog.create({
      data: {
        projectId,
        authorId: me.user.id,
        notes,
        weather: String(formData.get("weather") || "") || null,
        crewOnSite: String(formData.get("crew") || "") || null,
        hoursWorked: Number(formData.get("hours") || 0) || null,
        clientVisible: formData.get("clientVisible") === "on",
        photos: savedUrls.length > 0 ? JSON.stringify(savedUrls) : null,
      },
    });
    revalidatePath(`/projects/${projectId}`);
  }

  async function updateMilestone(formData: FormData) {
    "use server";
    const me = await auth();
    if (!me?.user) return;
    const r = me.user.role as Role;
    if (r === "CLIENT" || r === "SUB") return;
    const id = String(formData.get("id"));
    const status = String(formData.get("status"));
    await prisma.milestone.update({ where: { id }, data: { status } });
    revalidatePath(`/projects/${projectId}`);
  }

  return (
    <>
      <PageHeader
        title={project.name}
        subtitle={[
          project.client.name,
          project.address,
          project.city,
          project.projectType,
        ].filter(Boolean).join(" · ")}
        actions={
          <>
            <Link href={`/inbox?clientId=${project.clientId}`} className="btn-secondary">Open inbox</Link>
            {showFinancials && (
              <Link href={`/estimates/new?clientId=${project.clientId}&projectId=${project.id}`} className="btn-secondary">
                New estimate
              </Link>
            )}
          </>
        }
      />

      {(project.currentPhase || project.nextStep) && (
        <div className="px-6 pt-6">
          <div className="glass-card border-l-4 border-l-accent p-6">
            <div className="grid gap-4 md:grid-cols-3">
              {project.currentPhase && (
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">Current phase</div>
                  <div className="mt-1.5 text-sm font-semibold text-ink">{project.currentPhase}</div>
                </div>
              )}
              {project.team && (
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">With</div>
                  <div className="mt-1.5 text-sm text-ink-soft">{project.team}</div>
                </div>
              )}
              {project.nextStep && (
                <div className="md:col-span-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">Next step</div>
                  <div className="mt-1.5 text-sm text-ink-soft">{project.nextStep}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {isInternal(role) && (
        <div className="border-b border-glass-border px-6">
          <div className="-mb-px flex gap-6">
            <Link
              href={`/projects/${project.id}?tab=overview`}
              className={`border-b-2 py-3 text-sm font-medium transition-colors ${
                activeTab === "overview"
                  ? "border-accent text-accent font-semibold"
                  : "border-transparent text-ink-muted hover:border-glass-border hover:text-ink"
              }`}
            >
              Overview
            </Link>
            <Link
              href={`/projects/${project.id}?tab=time-clock`}
              className={`border-b-2 py-3 text-sm font-medium transition-colors ${
                activeTab === "time-clock"
                  ? "border-accent text-accent font-semibold"
                  : "border-transparent text-ink-muted hover:border-glass-border hover:text-ink"
              }`}
            >
              Time Clock
            </Link>
            {(role === "CEO" || role === "OFFICE") && (
              <Link
                href={`/projects/${project.id}?tab=time-review`}
                className={`border-b-2 py-3 text-sm font-medium transition-colors ${
                  activeTab === "time-review"
                    ? "border-accent text-accent font-semibold"
                    : "border-transparent text-ink-muted hover:border-glass-border hover:text-ink"
                }`}
              >
                Time Review
              </Link>
            )}
          </div>
        </div>
      )}

      <div className="p-6">
        {activeTab === "overview" ? (
          <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="glass-card p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-glass-border pb-3">
              <h2 className="text-sm font-semibold text-ink">Milestones</h2>
              <span className="text-xs text-ink-muted font-medium">
                {project.milestones.filter((m) => m.status === "DONE").length} / {project.milestones.length} done
              </span>
            </div>
            <ul className="space-y-2">
              {project.milestones.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3 rounded-[10px] px-4 py-3 bg-row-bg hover:bg-row-hover transition-colors">
                  <div>
                    <div className="text-sm font-semibold text-ink">{m.title}</div>
                    {m.dueDate && (
                      <div className="text-xs text-ink-muted mt-0.5">Due {formatDate(m.dueDate)}</div>
                    )}
                  </div>
                  {role === "CLIENT" || role === "SUB" ? (
                    <span className={msBadge(m.status)}>{m.status.replace("_", " ").toLowerCase()}</span>
                  ) : (
                    <form action={updateMilestone} className="flex items-center gap-2">
                      <input type="hidden" name="id" value={m.id} />
                      <select name="status" defaultValue={m.status} className="input py-1 text-xs">
                        <option value="PENDING">Pending</option>
                        <option value="IN_PROGRESS">In progress</option>
                        <option value="DONE">Done</option>
                        <option value="BLOCKED">Blocked</option>
                      </select>
                      <button className="btn-ghost text-xs font-semibold">Save</button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          </section>
          <section className="glass-card p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-glass-border pb-3">
              <h2 className="text-sm font-semibold text-ink">Daily logs</h2>
              <span className="text-xs text-ink-muted font-medium">{project.dailyLogs.length} recent</span>
            </div>
            {(role === "CEO" || role === "OFFICE" || role === "FIELD") && (
              <DailyLogForm addLogAction={addLog} />
            )}
            <ul className="space-y-2">
              {project.dailyLogs.length === 0 && (
                <li className="py-2 text-sm text-ink-soft">No logs yet.</li>
              )}
              {project.dailyLogs.map((l) => {
                if (role === "CLIENT" && !l.clientVisible) return null;
                
                let photoUrls: string[] = [];
                if (l.photos) {
                  try {
                    photoUrls = JSON.parse(l.photos);
                  } catch (e) {
                    // Ignore parsing error
                  }
                }

                return (
                  <li key={l.id} className="flex flex-col gap-1 rounded-[10px] px-4 py-3 bg-row-bg hover:bg-row-hover transition-colors">
                    <div className="flex items-center justify-between text-xs text-ink-muted">
                      <span>{l.author.name} · {formatRelative(l.date)}</span>
                      {l.clientVisible && <span className="badge-green">visible to client</span>}
                    </div>
                    <div className="mt-1 text-sm text-ink-soft">{l.notes}</div>
                    
                    {photoUrls.length > 0 && (
                      <div className="mt-2.5 flex flex-wrap gap-2">
                        {photoUrls.map((url, idx) => (
                          <a
                            key={idx}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group relative block aspect-square w-20 h-20 md:w-24 md:h-24 overflow-hidden rounded-lg border border-glass-border bg-row-bg shadow-sm"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={url}
                              alt={`Attachment ${idx + 1}`}
                              className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                            />
                          </a>
                        ))}
                      </div>
                    )}

                    <div className="mt-2 text-xs text-ink-muted space-x-3">
                      {l.weather && <span>☀ {l.weather}</span>}
                      {l.crewOnSite && <span>👷 {l.crewOnSite}</span>}
                      {l.hoursWorked != null && <span>⏱ {l.hoursWorked}h</span>}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          {showFinancials && (
            <section className="glass-card overflow-hidden flex flex-col">
              <div className="flex items-center justify-between border-b border-glass-border px-6 py-4">
                <h2 className="text-sm font-semibold text-ink">Budget vs actual</h2>
                <div className="text-xs text-ink-soft">
                  Contract {formatMoney(project.contractCents)} ·
                  <span className={overUnder > 0 ? "text-status-error font-semibold" : "text-status-success font-semibold"}>
                    {" "}{overUnder > 0 ? "Over" : "Under"} by {formatMoney(Math.abs(overUnder))}
                  </span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-row-bg border-b border-glass-border text-xs uppercase tracking-wider text-ink-muted">
                    <tr>
                      <th className="px-5 py-3.5 text-left font-medium">Category</th>
                      <th className="px-5 py-3.5 text-left font-medium">Description</th>
                      <th className="px-5 py-3.5 text-right font-medium">Estimate</th>
                      <th className="px-5 py-3.5 text-right font-medium">Actual</th>
                      <th className="px-5 py-3.5 text-right font-medium">Δ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-glass-border">
                    {project.budgetItems.map((b) => {
                      const d = b.actualCents - b.estimateCents;
                      return (
                        <tr key={b.id} className="hover:bg-row-hover transition-colors">
                          <td className="px-5 py-3.5 text-ink font-medium">{b.category}</td>
                          <td className="px-5 py-3.5 text-ink-soft">{b.description}</td>
                          <td className="px-5 py-3.5 text-right text-ink-soft">{formatMoney(b.estimateCents)}</td>
                          <td className="px-5 py-3.5 text-right text-ink-soft">{formatMoney(b.actualCents)}</td>
                          <td className={`px-5 py-3.5 text-right font-semibold ${d > 0 ? "text-status-error" : d < 0 ? "text-status-success" : "text-ink-muted"}`}>
                            {d === 0 ? "—" : `${d > 0 ? "+" : ""}${formatMoney(d)}`}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-row-bg text-sm border-t border-glass-border">
                    <tr>
                      <td className="px-5 py-3.5 font-semibold text-ink" colSpan={2}>Total</td>
                      <td className="px-5 py-3.5 text-right font-semibold text-ink">{formatMoney(totalEstCents)}</td>
                      <td className="px-5 py-3.5 text-right font-semibold text-ink">{formatMoney(totalActCents)}</td>
                      <td className={`px-5 py-3.5 text-right font-bold ${overUnder > 0 ? "text-status-error" : "text-status-success"}`}>
                        {overUnder === 0 ? "—" : `${overUnder > 0 ? "+" : ""}${formatMoney(overUnder)}`}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>
          )}
        </div>

        <div className="space-y-6">
          <section className="glass-card p-6 flex flex-col gap-4">
            <div className="border-b border-glass-border pb-1">
              <h2 className="text-sm font-semibold text-ink">Project</h2>
            </div>
            <dl className="space-y-3.5 text-sm">
              <Field k="Status" v={project.status.replace("_", " ").toLowerCase()} />
              {project.projectType && <Field k="Type" v={project.projectType} />}
              {project.city && <Field k="City" v={project.city} />}
              <Field k="Planned start" v={formatDate(project.startDate)} />
              {project.actualStart && <Field k="Actual start" v={formatDate(project.actualStart)} />}
              <Field k="Target finish" v={formatDate(project.targetEnd)} />
              {project.actualEnd && <Field k="Actual finish" v={formatDate(project.actualEnd)} />}
              {showFinancials && project.contractCents > 0 && <Field k="Contract" v={formatMoney(project.contractCents)} />}
              {showFinancials && project.budgetCents > 0 && <Field k="Budget" v={formatMoney(project.budgetCents)} />}
            </dl>
          </section>

          <section className="glass-card p-6 flex flex-col gap-4">
            <div className="border-b border-glass-border pb-1">
              <h2 className="text-sm font-semibold text-ink">Team</h2>
            </div>
            <ul className="space-y-3 text-sm">
              {project.assignments.map((a) => (
                <li key={a.id} className="flex justify-between">
                  <span className="text-ink font-semibold">{a.user.name}</span>
                  <span className="text-xs text-ink-muted">{a.role}</span>
                </li>
              ))}
            </ul>
          </section>

          {project.selections.length > 0 && (
            <section className="glass-card p-6 flex flex-col gap-4">
              <div className="border-b border-glass-border pb-1">
                <h2 className="text-sm font-semibold text-ink">Selections</h2>
              </div>
              <ul className="space-y-3 text-sm">
                {project.selections.map((s) => (
                  <li key={s.id} className="flex justify-between gap-2">
                    <div>
                      <div className="text-ink font-semibold">{s.category}</div>
                      <div className="text-xs text-ink-muted mt-0.5">{s.option}</div>
                    </div>
                    <span className={selBadge(s.status)}>{s.status.toLowerCase()}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    ) : activeTab === "time-clock" ? (
          <TimeClockTab
            currentProjectId={projectId}
            assignedProjects={assignedProjects}
            activeSession={activeSession}
            recentEntries={recentEntries}
          />
        ) : (
          <TimeReviewTab
            projectId={projectId}
            entries={reviewEntries}
          />
        )}
      </div>
    </>
  );
}

function Field({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-ink-muted font-medium">{k}</dt>
      <dd className="text-right text-ink font-semibold">{v}</dd>
    </div>
  );
}
function msBadge(s: string) {
  if (s === "DONE") return "badge-green";
  if (s === "IN_PROGRESS") return "badge-blue";
  if (s === "BLOCKED") return "badge-red";
  return "badge-slate";
}
function selBadge(s: string) {
  if (s === "APPROVED") return "badge-green";
  if (s === "REJECTED") return "badge-red";
  return "badge-amber";
}
