import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canSeeFinancials, canViewAllProjects } from "@/lib/roles";
import type { Role } from "@/lib/roles";
import { formatDate, formatMoney, formatRelative } from "@/lib/utils";
import { revalidatePath } from "next/cache";

export default async function ProjectDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params;
  const session = await auth();
  if (!session?.user) redirect("/sign-in");
  const role = session.user.role as Role;
  const userId = session.user.id;

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
    await prisma.dailyLog.create({
      data: {
        projectId,
        authorId: me.user.id,
        notes,
        weather: String(formData.get("weather") || "") || null,
        crewOnSite: String(formData.get("crew") || "") || null,
        hoursWorked: Number(formData.get("hours") || 0) || null,
        clientVisible: formData.get("clientVisible") === "on",
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
        subtitle={`${project.client.name} · ${project.address ?? "—"}`}
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

      <div className="grid gap-6 p-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="card">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h2 className="text-sm font-semibold">Milestones</h2>
              <span className="text-xs text-slate-500">
                {project.milestones.filter((m) => m.status === "DONE").length} / {project.milestones.length} done
              </span>
            </div>
            <ul className="divide-y divide-slate-100">
              {project.milestones.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div>
                    <div className="text-sm font-medium">{m.title}</div>
                    {m.dueDate && (
                      <div className="text-xs text-slate-500">Due {formatDate(m.dueDate)}</div>
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
                      <button className="btn-ghost text-xs">Save</button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          </section>

          <section className="card">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h2 className="text-sm font-semibold">Daily logs</h2>
              <span className="text-xs text-slate-500">{project.dailyLogs.length} recent</span>
            </div>
            {(role === "CEO" || role === "OFFICE" || role === "FIELD") && (
              <form action={addLog} className="space-y-2 border-b border-slate-100 px-5 py-4">
                <textarea name="notes" rows={2} className="input" placeholder="What happened on site today?" required />
                <div className="grid grid-cols-3 gap-2">
                  <input name="weather" className="input" placeholder="Weather" />
                  <input name="crew" className="input" placeholder="Crew on site" />
                  <input name="hours" type="number" step="0.5" className="input" placeholder="Crew hours" />
                </div>
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-xs text-slate-600">
                    <input type="checkbox" name="clientVisible" /> Share with client
                  </label>
                  <button className="btn-primary text-xs">Post log</button>
                </div>
              </form>
            )}
            <ul className="divide-y divide-slate-100">
              {project.dailyLogs.length === 0 && (
                <li className="px-5 py-4 text-sm text-slate-500">No logs yet.</li>
              )}
              {project.dailyLogs.map((l) => {
                if (role === "CLIENT" && !l.clientVisible) return null;
                return (
                  <li key={l.id} className="px-5 py-3">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>{l.author.name} · {formatRelative(l.date)}</span>
                      {l.clientVisible && <span className="badge-green">visible to client</span>}
                    </div>
                    <div className="mt-1 text-sm text-slate-700">{l.notes}</div>
                    <div className="mt-1 text-xs text-slate-500 space-x-3">
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
            <section className="card">
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                <h2 className="text-sm font-semibold">Budget vs actual</h2>
                <div className="text-xs text-slate-500">
                  Contract {formatMoney(project.contractCents)} ·
                  <span className={overUnder > 0 ? "text-rose-700" : "text-emerald-700"}>
                    {" "}{overUnder > 0 ? "Over" : "Under"} by {formatMoney(Math.abs(overUnder))}
                  </span>
                </div>
              </div>
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3 text-left font-medium">Category</th>
                    <th className="px-5 py-3 text-left font-medium">Description</th>
                    <th className="px-5 py-3 text-right font-medium">Estimate</th>
                    <th className="px-5 py-3 text-right font-medium">Actual</th>
                    <th className="px-5 py-3 text-right font-medium">Δ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {project.budgetItems.map((b) => {
                    const d = b.actualCents - b.estimateCents;
                    return (
                      <tr key={b.id}>
                        <td className="px-5 py-2">{b.category}</td>
                        <td className="px-5 py-2 text-slate-600">{b.description}</td>
                        <td className="px-5 py-2 text-right">{formatMoney(b.estimateCents)}</td>
                        <td className="px-5 py-2 text-right">{formatMoney(b.actualCents)}</td>
                        <td className={`px-5 py-2 text-right ${d > 0 ? "text-rose-700" : d < 0 ? "text-emerald-700" : "text-slate-500"}`}>
                          {d === 0 ? "—" : `${d > 0 ? "+" : ""}${formatMoney(d)}`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-slate-50 text-sm">
                  <tr>
                    <td className="px-5 py-2 font-medium" colSpan={2}>Total</td>
                    <td className="px-5 py-2 text-right font-medium">{formatMoney(totalEstCents)}</td>
                    <td className="px-5 py-2 text-right font-medium">{formatMoney(totalActCents)}</td>
                    <td className={`px-5 py-2 text-right font-medium ${overUnder > 0 ? "text-rose-700" : "text-emerald-700"}`}>
                      {overUnder === 0 ? "—" : `${overUnder > 0 ? "+" : ""}${formatMoney(overUnder)}`}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </section>
          )}
        </div>

        <div className="space-y-4">
          <section className="card p-5">
            <h2 className="text-sm font-semibold">Project</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <Field k="Status" v={project.status.replace("_", " ").toLowerCase()} />
              <Field k="Start" v={formatDate(project.startDate)} />
              <Field k="Target" v={formatDate(project.targetEnd)} />
              {showFinancials && <Field k="Contract" v={formatMoney(project.contractCents)} />}
              {showFinancials && <Field k="Budget" v={formatMoney(project.budgetCents)} />}
            </dl>
          </section>

          <section className="card p-5">
            <h2 className="text-sm font-semibold">Team</h2>
            <ul className="mt-2 space-y-2 text-sm">
              {project.assignments.map((a) => (
                <li key={a.id} className="flex justify-between">
                  <span>{a.user.name}</span>
                  <span className="text-xs text-slate-500">{a.role}</span>
                </li>
              ))}
            </ul>
          </section>

          {project.selections.length > 0 && (
            <section className="card p-5">
              <h2 className="text-sm font-semibold">Selections</h2>
              <ul className="mt-2 space-y-2 text-sm">
                {project.selections.map((s) => (
                  <li key={s.id} className="flex justify-between gap-2">
                    <div>
                      <div>{s.category}</div>
                      <div className="text-xs text-slate-500">{s.option}</div>
                    </div>
                    <span className={selBadge(s.status)}>{s.status.toLowerCase()}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </>
  );
}

function Field({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-slate-500">{k}</dt>
      <dd className="text-right text-slate-800">{v}</dd>
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
