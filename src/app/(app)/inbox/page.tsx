import PageHeader from "@/components/PageHeader";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { formatRelative } from "@/lib/utils";
import type { Role } from "@/lib/roles";
import { revalidatePath } from "next/cache";

const CHANNELS: { value: string; label: string; tone: string }[] = [
  { value: "ALL", label: "All channels", tone: "bg-slate-400" },
  { value: "EMAIL", label: "Email", tone: "bg-blue-500" },
  { value: "SMS", label: "SMS", tone: "bg-emerald-500" },
  { value: "IN_APP", label: "Hub message", tone: "bg-violet-500" },
  { value: "CALL_NOTE", label: "Call notes", tone: "bg-amber-500" },
];

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ threadId?: string; channel?: string; clientId?: string }>;
}) {
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user) redirect("/sign-in");
  const role = session.user.role as Role;
  const userId = session.user.id;
  const myClientId = session.user.clientId;

  const channelFilter = sp.channel && sp.channel !== "ALL" ? sp.channel : undefined;

  const threadWhere =
    role === "CLIENT" && myClientId
      ? { clientId: myClientId, ...(channelFilter ? { channel: channelFilter } : {}) }
      : role === "SUB" || role === "FIELD"
      ? {
          project: { assignments: { some: { userId } } },
          ...(channelFilter ? { channel: channelFilter } : {}),
        }
      : { ...(channelFilter ? { channel: channelFilter } : {}), ...(sp.clientId ? { clientId: sp.clientId } : {}) };

  const threads = await prisma.thread.findMany({
    where: threadWhere,
    orderBy: { lastAt: "desc" },
    include: {
      client: true,
      project: true,
      messages: { take: 1, orderBy: { sentAt: "desc" } },
    },
    take: 80,
  });

  const activeId = sp.threadId ?? threads[0]?.id;
  const activeThread = activeId
    ? await prisma.thread.findUnique({
        where: { id: activeId },
        include: {
          client: true,
          project: true,
          messages: { orderBy: { sentAt: "asc" }, include: { author: true } },
        },
      })
    : null;

  async function send(formData: FormData) {
    "use server";
    const threadId = String(formData.get("threadId") || "");
    const body = String(formData.get("body") || "").trim();
    if (!threadId || !body) return;
    const me = await auth();
    if (!me?.user) return;
    const t = await prisma.thread.findUnique({ where: { id: threadId } });
    if (!t) return;
    await prisma.message.create({
      data: {
        threadId,
        body,
        direction: "OUT",
        channel: t.channel,
        authorId: me.user.id,
        fromName: me.user.name ?? "Henley",
      },
    });
    await prisma.thread.update({
      where: { id: threadId },
      data: { lastAt: new Date(), unread: 0 },
    });
    revalidatePath("/inbox");
  }

  return (
    <>
      <PageHeader
        title="Unified inbox"
        subtitle="Email, SMS, in-app messages, and call notes — one thread per client."
      />
      <div className="grid grid-cols-12 gap-0 border-t border-slate-200">
        <aside className="col-span-12 border-r border-slate-200 bg-white md:col-span-4 lg:col-span-3">
          <div className="flex flex-wrap gap-1 border-b border-slate-200 p-3">
            {CHANNELS.map((c) => {
              const active = (sp.channel ?? "ALL") === c.value;
              return (
                <a
                  key={c.value}
                  href={`/inbox?channel=${c.value}${activeId ? `&threadId=${activeId}` : ""}`}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs ${
                    active ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${c.tone}`} />
                  {c.label}
                </a>
              );
            })}
          </div>
          <ul className="max-h-[calc(100vh-12rem)] overflow-y-auto divide-y divide-slate-100">
            {threads.length === 0 && (
              <li className="p-5 text-sm text-slate-500">No threads in this view.</li>
            )}
            {threads.map((t) => {
              const active = t.id === activeId;
              return (
                <li key={t.id}>
                  <a
                    href={`/inbox?threadId=${t.id}${sp.channel ? `&channel=${sp.channel}` : ""}`}
                    className={`block px-4 py-3 ${active ? "bg-brand-50/60" : "hover:bg-slate-50"}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="truncate text-sm font-medium">
                        {t.client?.name ?? "Internal"}
                      </span>
                      <span className="text-xs text-slate-400">{formatRelative(t.lastAt)}</span>
                    </div>
                    <div className="truncate text-sm text-slate-600">{t.subject}</div>
                    {t.messages[0] && (
                      <div className="truncate text-xs text-slate-500">{t.messages[0].body}</div>
                    )}
                    <div className="mt-1 flex items-center gap-2">
                      <span className="badge-slate text-[10px]">{t.channel.replace("_", " ")}</span>
                      {t.project && (
                        <span className="text-[10px] text-slate-500">· {t.project.name}</span>
                      )}
                      {t.unread > 0 && <span className="badge-blue text-[10px]">{t.unread} new</span>}
                    </div>
                  </a>
                </li>
              );
            })}
          </ul>
        </aside>

        <section className="col-span-12 flex flex-col bg-slate-50 md:col-span-8 lg:col-span-9">
          {!activeThread ? (
            <div className="flex flex-1 items-center justify-center text-sm text-slate-500">
              Select a thread.
            </div>
          ) : (
            <>
              <div className="border-b border-slate-200 bg-white px-6 py-4">
                <div className="text-sm text-slate-500">{activeThread.channel.replace("_", " ")}</div>
                <h2 className="text-base font-semibold">{activeThread.subject}</h2>
                <div className="text-xs text-slate-500">
                  {activeThread.client?.name}
                  {activeThread.project && ` · ${activeThread.project.name}`}
                </div>
              </div>
              <div className="flex-1 space-y-3 overflow-y-auto p-6">
                {activeThread.messages.map((m) => (
                  <div
                    key={m.id}
                    className={`max-w-2xl rounded-2xl px-4 py-2 text-sm ${
                      m.direction === "OUT"
                        ? "ml-auto bg-brand-600 text-white"
                        : "bg-white border border-slate-200 text-slate-800"
                    }`}
                  >
                    <div className={`mb-1 text-[10px] uppercase tracking-wide ${
                      m.direction === "OUT" ? "text-brand-100" : "text-slate-500"
                    }`}>
                      {m.direction === "OUT" ? `${m.author?.name ?? "Henley"} via ${m.channel}` : `${m.fromName} via ${m.channel}`}
                      {" · "}
                      {formatRelative(m.sentAt)}
                    </div>
                    <div className="whitespace-pre-wrap">{m.body}</div>
                  </div>
                ))}
              </div>
              <form action={send} className="border-t border-slate-200 bg-white p-4">
                <input type="hidden" name="threadId" value={activeThread.id} />
                <textarea
                  name="body"
                  rows={2}
                  className="input"
                  placeholder={`Reply via ${activeThread.channel.replace("_", " ").toLowerCase()}...`}
                />
                <div className="mt-2 flex items-center justify-between">
                  <div className="text-xs text-slate-500">
                    Replies go out on the same channel as the thread. Email/SMS gateways are stubbed.
                  </div>
                  <button className="btn-primary" type="submit">Send</button>
                </div>
              </form>
            </>
          )}
        </section>
      </div>
    </>
  );
}
