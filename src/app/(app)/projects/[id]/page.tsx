import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import ApplyTemplateCard from "./ApplyTemplateCard";
import WarrantyPanel from "./WarrantyPanel";
import { prisma } from "@/lib/prisma";
import { createDailyLog } from "@/lib/services/dailyLogService";
import { updateMilestoneStatus } from "@/lib/services/milestoneService";
import { listProjectChangeOrders } from "@/lib/services/changeOrderService";
import ChangeOrders from "@/components/ChangeOrders";
import {
  createChangeOrder,
  sendChangeOrder,
  approveChangeOrder,
  declineChangeOrder,
} from "./changeOrderActions";
import { auth } from "@/auth";
import { canSeeFinancials, canViewAllProjects, isInternal } from "@/lib/roles";
import type { Role } from "@/lib/roles";
import { formatDate, formatMoney, formatRelative } from "@/lib/utils";
import { revalidatePath } from "next/cache";
import DailyLogForm from "@/components/DailyLogForm";
import TimeClockTab from "@/components/TimeClockTab";
import TimeReviewTab from "@/components/TimeReviewTab";
import SendToTasksButton from "./SendToTasksButton";
import ProjectCodeEditor from "@/components/ProjectCodeEditor";
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
    return <div className="p-8 hh-secondary">You don't have access to this project.</div>;
  }

  const showFinancials = canSeeFinancials(role);
  const totalEstCents = project.budgetItems.reduce((a, b) => a + b.estimateCents, 0);
  const totalActCents = project.budgetItems.reduce((a, b) => a + b.actualCents, 0);
  const overUnder = totalActCents - totalEstCents;

  // Change orders: office/CEO manage all; the client sees only client-visible
  // ones. Field/sub never see them.
  const canManageChangeOrders = canSeeFinancials(role);
  const showChangeOrders = canManageChangeOrders || isClient;
  const changeOrderRows = showChangeOrders ? await listProjectChangeOrders(projectId) : [];
  const changeOrderItems = (isClient ? changeOrderRows.filter((c) => c.clientVisible) : changeOrderRows).map((c) => ({
    id: c.id,
    number: c.number,
    title: c.title,
    description: c.description,
    status: c.status,
    amountCents: c.amountCents,
    clientVisible: c.clientVisible,
    decidedByName: c.decidedByName,
    decidedAt: c.decidedAt,
    createdByName: c.createdBy.name,
    createdAt: c.createdAt,
  }));

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

    await createDailyLog({
      projectId,
      authorId: me.user.id,
      notes,
      weather: String(formData.get("weather") || "") || null,
      crewOnSite: String(formData.get("crew") || "") || null,
      hoursWorked: Number(formData.get("hours") || 0) || null,
      clientVisible: formData.get("clientVisible") === "on",
      photos: savedUrls,
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
    await updateMilestoneStatus(id, status);
    revalidatePath(`/projects/${projectId}`);
  }


  // Templates matching this project's job type
  const matchingTemplates = project.jobType
    ? await prisma.jobTemplate.findMany({
        where: { jobType: project.jobType },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      })
    : [];


  // Warranty: role-gated fetch (client sees own visible items only)
  const warrantySession = await auth();
  const warrantyRole = (warrantySession?.user?.role ?? "FIELD") as string;
  const rawWarrantyItems = await prisma.warrantyItem.findMany({
    where: warrantyRole === "CLIENT"
      ? { projectId: project.id, clientVisible: true }
      : { projectId: project.id },
    orderBy: [{ status: "asc" }, { reportedAt: "asc" }],
  });
  const warrantyItems = rawWarrantyItems.map((wi) => ({
    id:            wi.id,
    title:         wi.title,
    description:   wi.description,
    status:        wi.status,
    reportedAt:    wi.reportedAt.toISOString(),
    resolvedAt:    wi.resolvedAt?.toISOString() ?? null,
    clientVisible: wi.clientVisible,
  }));

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
            {isInternal(role) && <SendToTasksButton projectName={project.name} />}
            {showFinancials && (
              <Link href={`/estimates/new?clientId=${project.clientId}&projectId=${project.id}`} className="btn-secondary">
                New estimate
              </Link>
            )}
          </>
        }
      />

      <div className="px-6 pt-4 flex flex-wrap items-center gap-2">
        <span className="hh-caption uppercase tracking-wider">Project code</span>
        <ProjectCodeEditor
          projectId={project.id}
          code={project.code}
          proposeFrom={project.client.name}
          canEdit={role === "CEO" || role === "OFFICE"}
        />
      </div>

      {(project.currentPhase || project.nextStep) && (
        <div className="px-6 pt-6">
          <div className="hh-panel border-l-4 border-l-accent p-6">
            <div className="grid gap-4 md:grid-cols-3">
              {project.currentPhase && (
                <div>
                  <div className="hh-label">Current phase</div>
                  <div className="mt-1.5 hh-primary">{project.currentPhase}</div>
                </div>
              )}
              {project.team && (
                <div>
                  <div className="hh-label">With</div>
                  <div className="mt-1.5 hh-secondary">{project.team}</div>
                </div>
              )}
              {project.nextStep && (
                <div className="md:col-span-1">
                  <div className="hh-label">Next step</div>
                  <div className="mt-1.5 hh-secondary">{project.nextStep}</div>
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
          <section className="hh-panel p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between pb-3">
              <h2 className="hh-label">Milestones</h2>
              <span className="hh-secondary">
                {project.milestones.filter((m) => m.status === "DONE").length} / {project.milestones.length} done
              </span>
            </div>
            <ul className="space-y-2">
              {project.milestones.map((m) => (
                <li key={m.id} className="hh-row justify-between">
                  <div>
                    <div className="hh-primary">{m.title}</div>
                    {m.dueDate && (
                      <div className="hh-secondary mt-0.5">Due {formatDate(m.dueDate)}</div>
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
          <section className="hh-panel p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between pb-3">
              <h2 className="hh-label">Daily logs</h2>
              <span className="hh-secondary">{project.dailyLogs.length} recent</span>
            </div>
            {(role === "CEO" || role === "OFFICE" || role === "FIELD") && (
              <DailyLogForm addLogAction={addLog} />
            )}
            <ul className="space-y-2">
              {project.dailyLogs.length === 0 && (
                <li className="py-2 hh-secondary">No logs yet.</li>
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
                  <li key={l.id} className="hh-row flex-col !items-start !gap-1">
                    <div className="flex items-center justify-between w-full">
                      <span className="hh-secondary">{l.author.name} · {formatRelative(l.date)}</span>
                      {l.clientVisible && <span className="hh-badge hh-badge--success">visible to client</span>}
                    </div>
                    <div className="mt-1 hh-secondary">{l.notes}</div>
                    
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

                    <div className="mt-2 hh-caption space-x-3">
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
            <section className="hh-panel overflow-hidden flex flex-col">
              <div className="flex items-center justify-between border-b border-glass-border px-6 py-4">
                <h2 className="hh-label">Budget vs actual</h2>
                <div className="hh-caption">
                  Contract {formatMoney(project.contractCents)} ·
                  <span className={overUnder > 0 ? "text-status-error font-semibold" : "text-status-success font-semibold"}>
                    {" "}{overUnder > 0 ? "Over" : "Under"} by {formatMoney(Math.abs(overUnder))}
                  </span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="border-b border-glass-border">
                    <tr>
                      <th className="hh-label px-5 py-3.5 text-left">Category</th>
                      <th className="hh-label px-5 py-3.5 text-left">Description</th>
                      <th className="hh-label px-5 py-3.5 text-right">Estimate</th>
                      <th className="hh-label px-5 py-3.5 text-right">Actual</th>
                      <th className="hh-label px-5 py-3.5 text-right">Δ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-glass-border">
                    {project.budgetItems.map((b) => {
                      const d = b.actualCents - b.estimateCents;
                      return (
                        <tr key={b.id} className="hh-row--flat">
                          <td className="px-5 py-3.5 hh-primary">{b.category}</td>
                          <td className="px-5 py-3.5 hh-secondary">{b.description}</td>
                          <td className="px-5 py-3.5 text-right hh-secondary">{formatMoney(b.estimateCents)}</td>
                          <td className="px-5 py-3.5 text-right hh-secondary">{formatMoney(b.actualCents)}</td>
                          <td className={`px-5 py-3.5 text-right font-semibold ${d > 0 ? "text-status-error" : d < 0 ? "text-status-success" : "text-ink-muted"}`}>
                            {d === 0 ? "—" : `${d > 0 ? "+" : ""}${formatMoney(d)}`}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="text-sm border-t border-glass-border">
                    <tr>
                      <td className="px-5 py-3.5 hh-primary" colSpan={2}>Total</td>
                      <td className="px-5 py-3.5 text-right hh-primary">{formatMoney(totalEstCents)}</td>
                      <td className="px-5 py-3.5 text-right hh-primary">{formatMoney(totalActCents)}</td>
                      <td className={`px-5 py-3.5 text-right font-bold ${overUnder > 0 ? "text-status-error" : "text-status-success"}`}>
                        {overUnder === 0 ? "—" : `${overUnder > 0 ? "+" : ""}${formatMoney(overUnder)}`}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>
          )}

          {(canManageChangeOrders || changeOrderItems.length > 0) && (
            <ChangeOrders
              projectId={project.id}
              items={changeOrderItems}
              canManage={canManageChangeOrders}
              canDecide={canManageChangeOrders || isClient}
              createAction={createChangeOrder}
              sendAction={sendChangeOrder}
              approveAction={approveChangeOrder}
              declineAction={declineChangeOrder}
            />
          )}
        </div>

        <div className="space-y-6">
          <section className="hh-panel p-6 flex flex-col gap-4">
            <div className="pb-1">
              <h2 className="hh-label">Project</h2>
            </div>
            <dl className="space-y-3.5 text-sm">
              <Field k="Status" v={project.status.replace("_", " ").toLowerCase()} />
              {project.projectType && <Field k="Type" v={project.projectType} />}
              {project.jobType && <Field k={"Job type"} v={project.jobType} />}
              {project.division && <Field k={"Division"} v={project.division} />}
              {project.pipelineStage && <Field k={"Pipeline stage"} v={project.pipelineStage} />}
              {project.constructionPhase && <Field k={"Phase"} v={project.constructionPhase} />}
              {project.warrantyPhase && <Field k={"Warranty phase"} v={project.warrantyPhase} />}
              {project.projectManager && <Field k={"PM"} v={project.projectManager} />}
              {project.salesRep && <Field k={"Sales rep"} v={project.salesRep} />}
              {project.customerPO && <Field k={"Customer PO"} v={project.customerPO} />}
              {project.city && <Field k="City" v={project.city} />}
              <Field k="Planned start" v={formatDate(project.startDate)} />
              {project.actualStart && <Field k="Actual start" v={formatDate(project.actualStart)} />}
              <Field k="Target finish" v={formatDate(project.targetEnd)} />
              {project.actualEnd && <Field k="Actual finish" v={formatDate(project.actualEnd)} />}
              {showFinancials && project.contractCents > 0 && <Field k="Contract" v={formatMoney(project.contractCents)} />}
              {showFinancials && project.budgetCents > 0 && <Field k="Budget" v={formatMoney(project.budgetCents)} />}
            </dl>
          </section>

          <section className="hh-panel p-6 flex flex-col gap-4">
            <div className="pb-1">
              <h2 className="hh-label">Team</h2>
            </div>
            <ul className="space-y-3 text-sm">
              {project.assignments.map((a) => (
                <li key={a.id} className="flex justify-between">
                  <span className="hh-primary">{a.user.name}</span>
                  <span className="hh-secondary">{a.role}</span>
                </li>
              ))}
            </ul>
          </section>

          {project.selections.length > 0 && (
            <section className="hh-panel p-6 flex flex-col gap-4">
              <div className="pb-1">
                <h2 className="hh-label">Selections</h2>
              </div>
              <ul className="space-y-3 text-sm">
                {project.selections.map((s) => (
                  <li key={s.id} className="flex justify-between gap-2">
                    <div>
                      <div className="hh-primary">{s.category}</div>
                      <div className="hh-secondary mt-0.5">{s.option}</div>
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
      <ApplyTemplateCard
        projectId={project.id}
        jobType={project.jobType ?? null}
        templates={matchingTemplates}
      />
          <WarrantyPanel
        projectId={project.id}
        warrantyPhase={project.warrantyPhase}
        items={warrantyItems}
        role={warrantyRole}
      />
        </>
  );
}

function Field({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="hh-secondary">{k}</dt>
      <dd className="text-right hh-primary">{v}</dd>
    </div>
  );
}
function msBadge(s: string) {
  if (s === "DONE") return "hh-badge hh-badge--success";
  if (s === "IN_PROGRESS") return "hh-badge";
  if (s === "BLOCKED") return "hh-badge hh-badge--danger";
  return "hh-badge";
}
function selBadge(s: string) {
  if (s === "APPROVED") return "hh-badge hh-badge--success";
  if (s === "REJECTED") return "hh-badge hh-badge--danger";
  return "hh-badge hh-badge--warning";
}
