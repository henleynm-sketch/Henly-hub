import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import PageHeader from "@/components/PageHeader";
import ThemeToggle from "@/components/ThemeToggle";
import { ROLE_LABELS, type Role } from "@/lib/roles";
import { formatRelative } from "@/lib/utils";
import { revalidatePath } from "next/cache";

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; pw?: string; error?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");
  const sp = await searchParams;

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) redirect("/sign-in");

  const initials = user.name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  async function updateName(formData: FormData) {
    "use server";
    const me = await auth();
    if (!me?.user) return;
    const name = String(formData.get("name") || "").trim();
    if (!name) redirect("/profile?error=Name+cannot+be+empty");
    await prisma.user.update({ where: { id: me.user.id }, data: { name } });
    revalidatePath("/profile");
    redirect("/profile?saved=1");
  }

  async function changePassword(formData: FormData) {
    "use server";
    const me = await auth();
    if (!me?.user) return;
    const current = String(formData.get("current") || "");
    const next = String(formData.get("next") || "");
    const confirm = String(formData.get("confirm") || "");
    if (next.length < 4) redirect("/profile?error=New+password+is+too+short");
    if (next !== confirm) redirect("/profile?error=New+passwords+do+not+match");
    const row = await prisma.user.findUnique({ where: { id: me.user.id } });
    if (!row) return;
    const ok = await bcrypt.compare(current, row.passwordHash);
    if (!ok) redirect("/profile?error=Current+password+is+incorrect");
    const passwordHash = await bcrypt.hash(next, 10);
    await prisma.user.update({ where: { id: me.user.id }, data: { passwordHash } });
    redirect("/profile?pw=1");
  }

  return (
    <>
      <PageHeader title="Profile" subtitle="Your account, password and preferences." />
      <div className="p-6">
        <div className="mx-auto max-w-[720px] space-y-6">
          {sp.saved && (
            <div className="hh-panel p-4 flex items-center gap-3">
              <span className="hh-dot hh-dot--green" />
              <span className="hh-secondary">Name updated.</span>
            </div>
          )}
          {sp.pw && (
            <div className="hh-panel p-4 flex items-center gap-3">
              <span className="hh-dot hh-dot--green" />
              <span className="hh-secondary">Password changed. Use it on your next sign-in.</span>
            </div>
          )}
          {sp.error && (
            <div className="hh-panel p-4 flex items-center gap-3">
              <span className="hh-dot hh-dot--red" />
              <span className="hh-secondary">{sp.error}</span>
            </div>
          )}

          <section className="hh-panel p-6 flex flex-col gap-4">
            <h2 className="hh-label">Account</h2>
            <div className="flex items-center gap-4">
              <div className="grid h-14 w-14 place-items-center rounded-full bg-accent/10 text-accent font-bold text-lg shrink-0">
                {initials}
              </div>
              <div className="min-w-0">
                <div className="hh-primary">{user.name}</div>
                <div className="hh-secondary mt-0.5">{user.email}</div>
              </div>
              <span className="hh-badge">{ROLE_LABELS[user.role as Role] ?? user.role}</span>
            </div>
            <hr className="hh-divider" />
            <form action={updateName} className="flex flex-col md:flex-row gap-3 md:items-end">
              <div className="flex-1">
                <label className="hh-label block mb-1.5">Name</label>
                <input name="name" className="input" defaultValue={user.name} required />
              </div>
              <button className="btn-primary w-full md:w-auto" type="submit">Save</button>
            </form>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <dt className="hh-label">Email</dt>
                <dd className="hh-secondary mt-1">{user.email} <span className="hh-caption">(sign-in id, read-only)</span></dd>
              </div>
              <div>
                <dt className="hh-label">Department</dt>
                <dd className="hh-secondary mt-1">{user.focusArea ?? "—"}</dd>
              </div>
            </dl>
          </section>

          <section className="hh-panel p-6 flex flex-col gap-4">
            <h2 className="hh-label">Password</h2>
            <form action={changePassword} className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="hh-label block mb-1.5">Current password</label>
                <input name="current" type="password" className="input" required autoComplete="current-password" />
              </div>
              <div>
                <label className="hh-label block mb-1.5">New password</label>
                <input name="next" type="password" className="input" required autoComplete="new-password" />
              </div>
              <div>
                <label className="hh-label block mb-1.5">Confirm new</label>
                <input name="confirm" type="password" className="input" required autoComplete="new-password" />
              </div>
              <div className="sm:col-span-3">
                <button className="btn-primary w-full md:w-auto" type="submit">Change password</button>
              </div>
            </form>
          </section>

          <section className="hh-panel p-6 flex flex-col gap-4">
            <h2 className="hh-label">Preferences</h2>
            <div className="flex items-center justify-between">
              <div>
                <div className="hh-primary">Theme</div>
                <div className="hh-secondary mt-0.5">Light or dark — same toggle as the top bar, saved on this device.</div>
              </div>
              <ThemeToggle />
            </div>
            <hr className="hh-divider" />
            <div className="flex items-center justify-between">
              <div>
                <div className="hh-primary">Time zone</div>
                <div className="hh-secondary mt-0.5">Used for schedules and logs.</div>
              </div>
              <span className="hh-chip">America/Toronto</span>
            </div>
          </section>

          <section className="hh-panel p-6 flex flex-col gap-4">
            <h2 className="hh-label">Sessions</h2>
            <div className="hh-row hh-row--flat !items-start">
              <span className="hh-dot hh-dot--green mt-1.5" />
              <div>
                <div className="hh-primary">Signed in via credentials</div>
                <div className="hh-secondary mt-0.5">
                  This device · account created {formatRelative(user.createdAt)}
                </div>
              </div>
            </div>
            <button
              className="btn-secondary w-full md:w-auto"
              disabled
              title="Coming soon — JWT sessions cannot be revoked individually yet"
            >
              Sign out everywhere
            </button>
          </section>
        </div>
      </div>
    </>
  );
}
