import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { canManageTeam, ROLE_LABELS, type Role } from "@/lib/roles";
import PageHeader from "@/components/PageHeader";
import { isM365Configured, syncInbox } from "@/lib/microsoft365";
import { worksitePing } from "@/lib/worksite";
import { formatRelative } from "@/lib/utils";
import { revalidatePath } from "next/cache";

const SECTIONS = [
  { id: "organization", label: "Organization" },
  { id: "team", label: "Team & access" },
  { id: "departments", label: "Departments" },
  { id: "integrations", label: "Integrations" },
  { id: "apikeys", label: "API keys" },
  { id: "notifications", label: "Notifications" },
  { id: "audit", label: "Audit log" },
  { id: "danger", label: "Danger zone" },
];

const DEFAULT_DEPARTMENTS = [
  "Sales & Marketing",
  "Operations",
  "Design",
  "Pre-Construction",
  "Construction",
  "Warranty & Home Care",
  "Finance & HR",
];

const NOTIFICATION_EVENTS = [
  { key: "DAILY_LOG", label: "Daily log posted" },
  { key: "SELECTION_OVERDUE", label: "Selection overdue" },
  { key: "CONTRACT_SIGNED", label: "Contract signed" },
  { key: "DEPOSIT_PAID", label: "Deposit paid" },
  { key: "TIME_NEEDS_APPROVAL", label: "Time entry needs approval" },
];

async function getSetting(key: string): Promise<string | null> {
  try {
    const row = await prisma.setting.findUnique({ where: { key } });
    return row?.value ?? null;
  } catch {
    return null;
  }
}

async function setSetting(key: string, value: string) {
  await prisma.setting.upsert({ where: { key }, update: { value }, create: { key, value } });
}

function maskKey(key: string | null): string {
  if (!key) return "not set";
  return `${key.slice(0, 6)}••••••`;
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{
    synced?: string;
    syncError?: string;
    ws?: string;
    wsError?: string;
    reveal?: string;
    notice?: string;
  }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");
  const role = session.user.role as Role;
  if (role !== "CEO" && role !== "OFFICE") redirect("/dashboard");
  const isCeo = canManageTeam(role);
  const sp = await searchParams;

  const visibleSections = isCeo
    ? SECTIONS
    : SECTIONS.filter((s) => ["organization", "team", "integrations"].includes(s.id));

  const [users, departments, qboToken] = await Promise.all([
    prisma.user.findMany({ orderBy: { createdAt: "asc" }, include: { client: true, reportsTo: true } }),
    prisma.department.findMany({ orderBy: { name: "asc" } }).catch(() => []),
    prisma.qBOToken.findUnique({ where: { id: "global" } }).catch(() => null),
  ]);

  const [orgName, orgAddress, orgTz, orgFiscal, hubKey, worksiteLastOk, m365LastSync] =
    await Promise.all([
      getSetting("org.name"),
      getSetting("org.address"),
      getSetting("org.timezone"),
      getSetting("org.fiscalYearStart"),
      getSetting("HUB_TASKS_API_KEY"),
      getSetting("worksiteLastOk"),
      getSetting("m365LastSync"),
    ]);

  const activeHubKey = hubKey ?? process.env.HUB_TASKS_API_KEY ?? null;
  const m365Ready = isM365Configured();
  const worksiteUrlSet = Boolean(process.env.WORKSITE_API_URL);
  const worksiteKeySet = Boolean(
    process.env.WORKSITE_API_KEY && process.env.WORKSITE_API_KEY !== "PLACEHOLDER_UNTIL_AYANDIP_SHIPS"
  );

  const myPrefs = await prisma.userNotificationPref
    .findMany({ where: { userId: session.user.id } })
    .catch(() => []);
  const prefMap = new Map(myPrefs.map((p) => [p.event, p]));

  const auditRows = isCeo
    ? await Promise.all([
        prisma.settingAudit.findMany({ orderBy: { ts: "desc" }, take: 25 }).catch(() => []),
        prisma.auditLog.findMany({ orderBy: { ts: "desc" }, take: 25 }).catch(() => []),
      ])
    : [[], []];
  const userName = new Map(users.map((u) => [u.id, u.name]));
  const mergedAudit = [
    ...auditRows[0].map((r) => ({ id: r.id, ts: r.ts, actor: r.userId, action: r.action, target: r.key })),
    ...auditRows[1].map((r) => ({ id: r.id, ts: r.ts, actor: r.actorId, action: r.action, target: r.target })),
  ]
    .sort((a, b) => b.ts.getTime() - a.ts.getTime())
    .slice(0, 50);

  /* ---------------- server actions ---------------- */

  async function requireCeo() {
    const me = await auth();
    if (!me?.user || !canManageTeam(me.user.role as Role)) return null;
    return me;
  }

  async function saveOrganization(formData: FormData) {
    "use server";
    const me = await requireCeo();
    if (!me) return;
    await setSetting("org.name", String(formData.get("name") || ""));
    await setSetting("org.address", String(formData.get("address") || ""));
    await setSetting("org.timezone", String(formData.get("timezone") || "America/Toronto"));
    await setSetting("org.fiscalYearStart", String(formData.get("fiscal") || "January"));
    revalidatePath("/settings");
    redirect("/settings?notice=Organization+saved#organization");
  }

  async function inviteUser(formData: FormData) {
    "use server";
    const me = await requireCeo();
    if (!me) return;
    const name = String(formData.get("name") || "").trim();
    const email = String(formData.get("email") || "").trim().toLowerCase();
    const newRole = String(formData.get("role") || "FIELD");
    if (!name || !email) redirect("/settings?notice=Name+and+email+required#team");
    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) redirect("/settings?notice=Email+already+has+a+login#team");
    const passwordHash = await bcrypt.hash("demo", 10);
    await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role: ["CEO", "OFFICE", "FIELD", "SUB", "CLIENT"].includes(newRole) ? newRole : "FIELD",
        department: String(formData.get("department") || "") || null,
        reportsToId: String(formData.get("reportsTo") || "") || null,
      },
    });
    await prisma.auditLog.create({
      data: { actorId: me.user.id, action: "user.invite", target: email },
    });
    revalidatePath("/settings");
    redirect("/settings?notice=User+invited+with+temporary+password+demo#team");
  }

  async function updateUser(formData: FormData) {
    "use server";
    const me = await requireCeo();
    if (!me) return;
    const id = String(formData.get("id") || "");
    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) return;
    const newRole = String(formData.get("role") || target.role);
    await prisma.user.update({
      where: { id },
      data: {
        role: ["CEO", "OFFICE", "FIELD", "SUB", "CLIENT"].includes(newRole) ? newRole : target.role,
        department: String(formData.get("department") || "") || null,
        reportsToId: String(formData.get("reportsTo") || "") || null,
      },
    });
    if (newRole !== target.role) {
      await prisma.auditLog.create({
        data: { actorId: me.user.id, action: `role.change ${target.role}->${newRole}`, target: target.email },
      });
    }
    revalidatePath("/settings");
    redirect("/settings?notice=User+updated#team");
  }

  async function toggleActive(formData: FormData) {
    "use server";
    const me = await requireCeo();
    if (!me) return;
    const id = String(formData.get("id") || "");
    const target = await prisma.user.findUnique({ where: { id } });
    if (!target || target.id === me.user.id) return;
    await prisma.user.update({ where: { id }, data: { active: !target.active } });
    await prisma.auditLog.create({
      data: {
        actorId: me.user.id,
        action: target.active ? "user.deactivate" : "user.reactivate",
        target: target.email,
      },
    });
    revalidatePath("/settings");
    redirect("/settings#team");
  }

  async function seedDepartments() {
    "use server";
    const me = await requireCeo();
    if (!me) return;
    for (const name of DEFAULT_DEPARTMENTS) {
      await prisma.department.upsert({ where: { name }, update: {}, create: { name } });
    }
    revalidatePath("/settings");
    redirect("/settings#departments");
  }

  async function renameDepartment(formData: FormData) {
    "use server";
    const me = await requireCeo();
    if (!me) return;
    const id = String(formData.get("id") || "");
    const name = String(formData.get("name") || "").trim();
    if (!name) return;
    await prisma.department.update({ where: { id }, data: { name } }).catch(() => {});
    revalidatePath("/settings");
    redirect("/settings#departments");
  }

  async function syncNow() {
    "use server";
    const me = await requireCeo();
    if (!me || !isM365Configured()) return;
    try {
      const result = await syncInbox();
      await setSetting("m365LastSync", new Date().toISOString());
      revalidatePath("/settings");
      revalidatePath("/inbox");
      redirect(`/settings?synced=${result.fetched}-${result.created}#integrations`);
    } catch (err) {
      if ((err as Error).message?.includes("NEXT_REDIRECT")) throw err;
      redirect(`/settings?syncError=${encodeURIComponent((err as Error).message ?? "Sync failed")}#integrations`);
    }
  }

  async function testWorksite() {
    "use server";
    const me = await requireCeo();
    if (!me) return;
    try {
      const ping = await worksitePing();
      await setSetting("worksiteLastOk", new Date().toISOString());
      const enums = [...(ping.enums?.status ?? []), ...(ping.enums?.priority ?? [])].join(", ");
      revalidatePath("/settings");
      redirect(`/settings?ws=${encodeURIComponent(enums || "ok")}#integrations`);
    } catch (err) {
      if ((err as Error).message?.includes("NEXT_REDIRECT")) throw err;
      redirect(`/settings?wsError=${encodeURIComponent((err as Error).message ?? "Unreachable")}#integrations`);
    }
  }

  async function rotateHubKey() {
    "use server";
    const me = await requireCeo();
    if (!me) return;
    // The active Door 1 key lives in the Setting table, NOT in .env —
    // a running server must never rewrite its own .env. The
    // /api/external/projects route reads Setting first and falls back
    // to process.env for fresh installs.
    const newKey = randomBytes(32).toString("hex");
    await setSetting("HUB_TASKS_API_KEY", newKey);
    await prisma.settingAudit.create({
      data: { key: "HUB_TASKS_API_KEY", action: "rotate", userId: me.user.id },
    });
    await prisma.auditLog.create({
      data: { actorId: me.user.id, action: "apikey.rotate", target: "HUB_TASKS_API_KEY" },
    });
    revalidatePath("/settings");
    redirect("/settings?reveal=1#apikeys");
  }

  async function savePrefs(formData: FormData) {
    "use server";
    const me = await auth();
    if (!me?.user) return;
    for (const ev of NOTIFICATION_EVENTS) {
      const email = formData.get(`${ev.key}.email`) === "on";
      const sms = formData.get(`${ev.key}.sms`) === "on";
      await prisma.userNotificationPref.upsert({
        where: { userId_event: { userId: me.user.id, event: ev.key } },
        update: { email, sms },
        create: { userId: me.user.id, event: ev.key, email, sms },
      });
    }
    revalidatePath("/settings");
    redirect("/settings?notice=Notification+preferences+saved#notifications");
  }

  /* ---------------- render ---------------- */

  return (
    <>
      <PageHeader
        title="Settings"
        subtitle={isCeo ? "Company, team, integrations and keys." : "Company and team overview (read-only)."}
      />
      <div className="p-6">
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          <nav className="lg:sticky lg:top-24 w-full lg:w-52 shrink-0">
            <ul className="flex lg:flex-col gap-1 overflow-x-auto pb-2 lg:pb-0" style={{ WebkitOverflowScrolling: "touch" }}>
              {visibleSections.map((s) => (
                <li key={s.id} className="shrink-0">
                  <a href={`#${s.id}`} className="hh-row hh-row--flat !gap-2 whitespace-nowrap">
                    <span className="hh-secondary">{s.label}</span>
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="min-w-0 flex-1 space-y-6 max-w-3xl">
            {sp.notice && (
              <div className="hh-panel p-4 flex items-center gap-3">
                <span className="hh-dot hh-dot--green" />
                <span className="hh-secondary">{sp.notice}</span>
              </div>
            )}

            {/* 1 — Organization */}
            <section id="organization" className="hh-panel p-6 flex flex-col gap-4 scroll-mt-24">
              <h2 className="hh-label">Organization</h2>
              <form action={saveOrganization} className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="hh-label block mb-1.5">Company name</label>
                  <input name="name" className="input" defaultValue={orgName ?? "Henley Contracting Ltd."} disabled={!isCeo} />
                </div>
                <div>
                  <label className="hh-label block mb-1.5">Default time zone</label>
                  <input name="timezone" className="input" defaultValue={orgTz ?? "America/Toronto"} disabled={!isCeo} />
                </div>
                <div className="sm:col-span-2">
                  <label className="hh-label block mb-1.5">Address</label>
                  <input name="address" className="input" defaultValue={orgAddress ?? ""} disabled={!isCeo} />
                </div>
                <div>
                  <label className="hh-label block mb-1.5">Fiscal year start</label>
                  <input name="fiscal" className="input" defaultValue={orgFiscal ?? "January"} disabled={!isCeo} />
                </div>
                <div>
                  <label className="hh-label block mb-1.5">Logo</label>
                  <input className="input" disabled placeholder="Coming soon" title="Logo storage lands with the files backend (R2/S3)" />
                </div>
                {isCeo && (
                  <div className="sm:col-span-2">
                    <button className="btn-primary w-full sm:w-auto" type="submit">Save organization</button>
                  </div>
                )}
              </form>
            </section>

            {/* 2 — Team & access */}
            <section id="team" className="hh-panel p-6 flex flex-col gap-4 scroll-mt-24">
              <h2 className="hh-label">Team & access</h2>
              <div className="overflow-x-auto -mx-2 px-2">
                <table className="min-w-full text-sm">
                  <thead className="border-b border-glass-border">
                    <tr>
                      <th className="hh-label px-3 py-3 text-left">Name</th>
                      <th className="hh-label px-3 py-3 text-left">Role</th>
                      <th className="hh-label px-3 py-3 text-left">Department</th>
                      <th className="hh-label px-3 py-3 text-left">Reports to</th>
                      <th className="hh-label px-3 py-3 text-left">Status</th>
                      {isCeo && <th className="hh-label px-3 py-3 text-right">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-glass-border">
                    {users.map((u) => (
                      <tr key={u.id} className="hh-row--flat align-top">
                        <td className="px-3 py-3">
                          <div className="hh-primary">{u.name}</div>
                          <div className="hh-secondary">{u.email}</div>
                        </td>
                        <td className="px-3 py-3 hh-secondary">{ROLE_LABELS[u.role as Role] ?? u.role}</td>
                        <td className="px-3 py-3 hh-secondary">{u.department ?? u.focusArea ?? "—"}</td>
                        <td className="px-3 py-3 hh-secondary">{u.reportsTo?.name ?? "—"}</td>
                        <td className="px-3 py-3">
                          {u.active ? (
                            <span className="hh-badge hh-badge--success !ml-0">active</span>
                          ) : (
                            <span className="hh-badge hh-badge--danger !ml-0">inactive</span>
                          )}
                        </td>
                        {isCeo && (
                          <td className="px-3 py-3 text-right">
                            <details>
                              <summary className="btn-ghost text-xs cursor-pointer inline-flex">Edit</summary>
                              <form action={updateUser} className="mt-2 grid gap-2 text-left min-w-[220px]">
                                <input type="hidden" name="id" value={u.id} />
                                <select name="role" className="input" defaultValue={u.role}>
                                  {Object.keys(ROLE_LABELS).map((r) => (
                                    <option key={r} value={r}>{ROLE_LABELS[r as Role]}</option>
                                  ))}
                                </select>
                                <select name="department" className="input" defaultValue={u.department ?? ""}>
                                  <option value="">No department</option>
                                  {departments.map((d) => (
                                    <option key={d.id} value={d.name}>{d.name}</option>
                                  ))}
                                </select>
                                <select name="reportsTo" className="input" defaultValue={u.reportsToId ?? ""}>
                                  <option value="">Reports to no one</option>
                                  {users.filter((x) => x.id !== u.id).map((x) => (
                                    <option key={x.id} value={x.id}>{x.name}</option>
                                  ))}
                                </select>
                                <button className="btn-secondary" type="submit">Save</button>
                              </form>
                              <form action={toggleActive} className="mt-1">
                                <input type="hidden" name="id" value={u.id} />
                                <button className="btn-ghost text-xs w-full" type="submit">
                                  {u.active ? "Deactivate" : "Reactivate"}
                                </button>
                              </form>
                            </details>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {isCeo && (
                <>
                  <hr className="hh-divider" />
                  <h3 className="hh-label">Invite user</h3>
                  <form action={inviteUser} className="grid gap-3 sm:grid-cols-2">
                    <input name="name" className="input" placeholder="Full name" required />
                    <input name="email" type="email" className="input" placeholder="Work email" required />
                    <select name="role" className="input" defaultValue="FIELD">
                      {Object.keys(ROLE_LABELS).map((r) => (
                        <option key={r} value={r}>{ROLE_LABELS[r as Role]}</option>
                      ))}
                    </select>
                    <select name="department" className="input" defaultValue="">
                      <option value="">No department</option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.name}>{d.name}</option>
                      ))}
                    </select>
                    <select name="reportsTo" className="input" defaultValue="">
                      <option value="">Reports to no one</option>
                      {users.map((x) => (
                        <option key={x.id} value={x.id}>{x.name}</option>
                      ))}
                    </select>
                    <button className="btn-primary" type="submit">Invite user</button>
                  </form>
                  <p className="hh-caption">
                    Creates the login immediately with temporary password <code className="hh-chip">demo</code> — no email is sent yet.
                  </p>
                </>
              )}
            </section>

            {/* 3 — Departments */}
            {isCeo && (
              <section id="departments" className="hh-panel p-6 flex flex-col gap-4 scroll-mt-24">
                <h2 className="hh-label">Departments</h2>
                {departments.length === 0 ? (
                  <>
                    <p className="hh-secondary">No departments yet. Seed the accountability chart to start.</p>
                    <form action={seedDepartments}>
                      <button className="btn-primary w-full sm:w-auto" type="submit">Add the seven defaults</button>
                    </form>
                  </>
                ) : (
                  <ul className="space-y-2">
                    {departments.map((d) => (
                      <li key={d.id}>
                        <form action={renameDepartment} className="hh-row !gap-2">
                          <input type="hidden" name="id" value={d.id} />
                          <input name="name" className="input flex-1" defaultValue={d.name} />
                          <button className="btn-ghost text-xs shrink-0" type="submit">Rename</button>
                        </form>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}

            {/* 4 — Integrations */}
            <section id="integrations" className="hh-panel p-6 flex flex-col gap-5 scroll-mt-24">
              <h2 className="hh-label">Integrations</h2>

              <div className="hh-row hh-row--flat flex-col !items-start !gap-2">
                <div className="flex items-center justify-between w-full">
                  <span className="hh-primary">QuickBooks Online</span>
                  {qboToken ? (
                    <span className="hh-badge hh-badge--success">connected</span>
                  ) : (
                    <span className="hh-badge hh-badge--warning">not connected</span>
                  )}
                </div>
                <span className="hh-secondary">
                  {qboToken
                    ? `Realm ${qboToken.realmId} · token refreshed ${formatRelative(qboToken.updatedAt)}`
                    : "Push invoices and pull actuals once connected."}
                </span>
                <span className="flex flex-wrap gap-2 mt-1">
                  <Link href="/integrations/quickbooks" className="btn-secondary text-xs">Manage</Link>
                  <Link href="/integrations/quickbooks/employees" className="btn-secondary text-xs">Employee mapping</Link>
                </span>
              </div>

              <div className="hh-row hh-row--flat flex-col !items-start !gap-2">
                <div className="flex items-center justify-between w-full">
                  <span className="hh-primary">Microsoft 365</span>
                  {m365Ready ? (
                    <span className="hh-badge hh-badge--success">connected</span>
                  ) : (
                    <span className="hh-badge hh-badge--warning">not configured</span>
                  )}
                </div>
                {sp.synced && (
                  <span className="hh-secondary">
                    Synced — {sp.synced.split("-")[0]} fetched, {sp.synced.split("-")[1]} new.
                  </span>
                )}
                {sp.syncError && <span className="hh-secondary">Sync failed: {sp.syncError}</span>}
                {m365Ready ? (
                  <>
                    <span className="hh-secondary">
                      Shared mailbox feeds the unified inbox. {m365LastSync ? `Last sync ${formatRelative(new Date(m365LastSync))}.` : "Last sync: never."}
                    </span>
                    {isCeo && (
                      <form action={syncNow}>
                        <button className="btn-secondary text-xs" type="submit">Sync inbox now</button>
                      </form>
                    )}
                  </>
                ) : (
                  <span className="hh-secondary">
                    Needs <code className="hh-chip">M365_TENANT_ID</code> <code className="hh-chip">M365_CLIENT_ID</code>{" "}
                    <code className="hh-chip">M365_CLIENT_SECRET</code> <code className="hh-chip">M365_MAILBOX</code> in .env
                    (Azure app registration with Mail.Read + admin consent).
                  </span>
                )}
              </div>

              <div className="hh-row hh-row--flat flex-col !items-start !gap-2">
                <div className="flex items-center justify-between w-full">
                  <span className="hh-primary">Henley Tasks (Worksite)</span>
                  {worksiteUrlSet && worksiteKeySet ? (
                    <span className="hh-badge hh-badge--success">configured</span>
                  ) : (
                    <span className="hh-badge hh-badge--warning">waiting on keys</span>
                  )}
                </div>
                <span className="hh-secondary">
                  Door 1 (Hub → Tasks): key {activeHubKey ? "configured" : "missing"} · {maskKey(activeHubKey)} —
                  Tasks polls <code className="hh-chip">GET /api/external/projects</code> with{" "}
                  <code className="hh-chip">Authorization: Bearer &lt;key&gt;</code>
                </span>
                <span className="hh-secondary">
                  Door 2 (Tasks → Hub): URL {worksiteUrlSet ? "configured" : "missing"} · key{" "}
                  {worksiteKeySet ? "configured" : "placeholder"} · last successful call:{" "}
                  {worksiteLastOk ? formatRelative(new Date(worksiteLastOk)) : "never"}
                </span>
                {sp.ws && <span className="hh-secondary">Connection OK — enums: {sp.ws}</span>}
                {sp.wsError && <span className="hh-secondary">Test failed: {sp.wsError}</span>}
                {isCeo && (
                  <form action={testWorksite}>
                    <button className="btn-secondary text-xs" type="submit">Test connection</button>
                  </form>
                )}
              </div>
            </section>

            {/* 5 — API keys */}
            {isCeo && (
              <section id="apikeys" className="hh-panel p-6 flex flex-col gap-4 scroll-mt-24">
                <h2 className="hh-label">API keys</h2>
                <div className="hh-row hh-row--flat flex-col !items-start !gap-2">
                  <div className="flex items-center justify-between w-full">
                    <span className="hh-primary">HUB_TASKS_API_KEY</span>
                    <form action={rotateHubKey}>
                      <button className="btn-secondary text-xs" type="submit">Rotate</button>
                    </form>
                  </div>
                  {sp.reveal === "1" && hubKey ? (
                    <>
                      <code className="hh-chip break-all">{hubKey}</code>
                      <span className="hh-caption">
                        Copy it now and hand it to Ayandip through a secure channel — it masks after you leave this page.
                      </span>
                    </>
                  ) : (
                    <code className="hh-chip">{maskKey(activeHubKey)}</code>
                  )}
                  <span className="hh-caption">
                    The active key lives in the database (Setting table); the projects feed reads it there first and
                    falls back to .env. Rotation takes effect immediately — the old key gets 401.
                  </span>
                </div>
              </section>
            )}

            {/* 6 — Notifications */}
            {isCeo && (
              <section id="notifications" className="hh-panel p-6 flex flex-col gap-4 scroll-mt-24">
                <h2 className="hh-label">Notifications</h2>
                <p className="hh-caption">Delivery is not wired yet — preferences are saved for when it is.</p>
                <form action={savePrefs} className="flex flex-col gap-2">
                  <div className="grid grid-cols-[1fr_60px_60px] gap-2 items-center">
                    <span className="hh-label">Event</span>
                    <span className="hh-label text-center">Email</span>
                    <span className="hh-label text-center">SMS</span>
                  </div>
                  {NOTIFICATION_EVENTS.map((ev) => {
                    const p = prefMap.get(ev.key);
                    return (
                      <div key={ev.key} className="grid grid-cols-[1fr_60px_60px] gap-2 items-center hh-row hh-row--flat !gap-2">
                        <span className="hh-secondary">{ev.label}</span>
                        <span className="text-center">
                          <input type="checkbox" name={`${ev.key}.email`} defaultChecked={p?.email ?? false} className="h-5 w-5" />
                        </span>
                        <span className="text-center">
                          <input type="checkbox" name={`${ev.key}.sms`} defaultChecked={p?.sms ?? false} className="h-5 w-5" />
                        </span>
                      </div>
                    );
                  })}
                  <button className="btn-primary w-full sm:w-auto mt-2" type="submit">Save preferences</button>
                </form>
              </section>
            )}

            {/* 7 — Audit log */}
            {isCeo && (
              <section id="audit" className="hh-panel p-6 flex flex-col gap-4 scroll-mt-24">
                <h2 className="hh-label">Audit log</h2>
                {mergedAudit.length === 0 ? (
                  <p className="hh-secondary">Nothing yet. Role changes, key rotations and invites land here.</p>
                ) : (
                  <ul className="space-y-1">
                    {mergedAudit.map((r) => (
                      <li key={r.id} className="hh-row hh-row--flat !gap-3">
                        <span className="hh-secondary flex-1">
                          <span className="hh-primary">{userName.get(r.actor) ?? r.actor}</span> · {r.action} · {r.target}
                        </span>
                        <span className="hh-caption whitespace-nowrap">{formatRelative(r.ts)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}

            {/* 8 — Danger zone */}
            {isCeo && (
              <section id="danger" className="hh-panel p-6 flex flex-col gap-4 scroll-mt-24">
                <h2 className="hh-label">Danger zone</h2>
                <div className="flex flex-col sm:flex-row gap-3">
                  <a href="/api/admin/export" className="btn-secondary w-full sm:w-auto">Export all data</a>
                  <button className="btn-secondary w-full sm:w-auto" disabled title="Coming soon">
                    Transfer ownership
                  </button>
                </div>
                <p className="hh-caption">
                  Export streams a JSON snapshot of every non-secret table — no password hashes, tokens or API keys.
                </p>
              </section>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
