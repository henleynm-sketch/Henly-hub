import PageHeader from "@/components/PageHeader";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { formatRelative } from "@/lib/utils";
import type { Role } from "@/lib/roles";
import { revalidatePath } from "next/cache";
import { Send, MessageSquare } from "lucide-react";

const CHANNELS: { value: string; label: string; color: string }[] = [
  { value: "ALL", label: "All channels", color: "#a29ef8" },
  { value: "EMAIL", label: "Email", color: "#0a84ff" },
  { value: "SMS", label: "SMS", color: "#30d158" },
  { value: "IN_APP", label: "Hub message", color: "#5e5ce6" },
  { value: "CALL_NOTE", label: "Call notes", color: "#ff9f0a" },
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

  const getChannelTagClass = (channel: string) => {
    switch (channel.toUpperCase()) {
      case "IN_APP":
        return "badge-violet";
      case "SMS":
        return "badge-green";
      case "EMAIL":
        return "badge-blue";
      case "CALL_NOTE":
        return "badge-amber";
      default:
        return "badge-slate";
    }
  };

  const getChannelBadge = (channel: string) => {
    return channel.replace("_", " ").toUpperCase();
  };

  const getInitials = (name: string | null) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  };

  return (
    <>
      <PageHeader
        title="Unified Inbox"
        subtitle="Email, SMS, in-app messages, and call notes — one thread per client."
      />

      <div className="mx-auto max-w-7xl p-6">
        <div
          className="glass-card grid grid-cols-12 overflow-hidden border border-glass-border"
        >
          {/* Thread List Column */}
          <aside className="col-span-12 md:col-span-5 lg:col-span-4 border-r border-glass-border flex flex-col h-[calc(100vh-16rem)] md:h-[calc(100vh-14rem)] overflow-hidden">
            {/* Channel Filters */}
            <div className="flex flex-wrap gap-1.5 border-b border-glass-border p-3.5 bg-row-bg shrink-0">
              {CHANNELS.map((c) => {
                const active = (sp.channel ?? "ALL") === c.value;
                return (
                  <a
                    key={c.value}
                    href={`/inbox?channel=${c.value}${activeId ? `&threadId=${activeId}` : ""}`}
                    className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider transition-all border ${
                      active
                        ? "border-accent bg-accent/10 text-accent"
                        : "bg-row-bg text-ink-soft border-glass-border hover:bg-row-hover hover:text-ink"
                    }`}
                  >
                    <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                    {c.label}
                  </a>
                );
              })}
            </div>

            {/* Threads List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {threads.length === 0 && (
                <div className="p-6 text-center text-sm text-ink-soft">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <MessageSquare className="h-8 w-8 text-ink-muted" />
                    <p className="font-semibold text-ink">No threads found</p>
                    <p className="text-xs text-ink-muted">There are no messages matching this channel filter.</p>
                  </div>
                </div>
              )}
              {threads.map((t) => {
                const active = t.id === activeId;
                return (
                  <a
                    key={t.id}
                    href={`/inbox?threadId=${t.id}${sp.channel ? `&channel=${sp.channel}` : ""}`}
                    className={`block rounded-[10px] px-4 py-3 bg-row-bg hover:bg-row-hover transition-colors relative ${
                      active ? "bg-row-active font-semibold" : ""
                    }`}
                  >
                    {/* Active Left Hairline Indicator */}
                    {active && (
                      <span className="absolute left-0 top-2.5 bottom-2.5 w-[3px] bg-accent rounded-r-md" />
                    )}
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs font-semibold text-ink">
                        {t.client?.name ?? "Internal Info"}
                      </span>
                      <span className="text-[10px] text-ink-muted shrink-0 font-medium">{formatRelative(t.lastAt)}</span>
                    </div>
                    <div className="truncate text-sm font-semibold text-ink mt-1">{t.subject}</div>
                    {t.messages[0] && (
                      <div className="truncate text-xs text-ink-soft mt-0.5 font-normal leading-normal">{t.messages[0].body}</div>
                    )}
                    <div className="mt-2.5 flex items-center gap-2 flex-wrap">
                      <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${getChannelTagClass(t.channel)}`}>
                        {t.channel.replace("_", " ")}
                      </span>
                      {t.project && (
                        <span className="text-[10px] text-ink-muted truncate max-w-[120px]">
                          · {t.project.name}
                        </span>
                      )}
                      {t.unread > 0 && (
                        <span className="ml-auto badge-blue text-[9px] font-bold tracking-wider px-2 py-0.5 rounded-full shrink-0">
                          {t.unread} new
                        </span>
                      )}
                    </div>
                  </a>
                );
              })}
            </div>
          </aside>

          {/* Conversation Pane Column */}
          <section className="col-span-12 md:col-span-7 lg:col-span-8 flex flex-col h-[calc(100vh-16rem)] md:h-[calc(100vh-14rem)] overflow-hidden bg-row-bg">
            {!activeThread ? (
              <div className="flex flex-1 flex-col items-center justify-center text-ink-soft gap-2">
                <MessageSquare className="h-10 w-10 text-ink-muted animate-pulse" />
                <p className="font-semibold text-ink">Select a thread</p>
                <p className="text-xs text-ink-muted">Choose a conversation from the sidebar to start reading.</p>
              </div>
            ) : (
              <>
                {/* Convo Header */}
                <div className="border-b border-glass-border bg-row-bg px-6 py-4 flex items-center gap-3 shrink-0">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent font-semibold text-sm">
                    {getInitials(activeThread.client?.name ?? "I")}
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-ink leading-tight">{activeThread.subject}</h2>
                    <div className="text-xs text-ink-soft mt-0.5 font-medium leading-normal">
                      {activeThread.client?.name ?? "Internal Info"}
                      {activeThread.project && ` · ${activeThread.project.name}`}
                    </div>
                  </div>
                  <span className="ml-auto text-[10px] font-bold tracking-wider uppercase bg-row-bg text-ink-soft px-2.5 py-1 rounded border border-glass-border shrink-0">
                    {getChannelBadge(activeThread.channel)}
                  </span>
                </div>

                {/* Messages Stream */}
                <div id="messages-area" className="flex-1 overflow-y-auto p-6 space-y-4 flex flex-col">
                  <div className="text-center my-2 shrink-0">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-ink-soft/45 px-2.5 py-1 bg-row-bg rounded-md border border-glass-border">
                      {activeThread.channel.replace("_", " ")} Thread
                    </span>
                  </div>

                  {activeThread.messages.map((m) => {
                    const isSent = m.direction === "OUT";
                    return (
                      <div
                        key={m.id}
                        className={`flex flex-col max-w-[75%] ${isSent ? "ml-auto items-end" : "mr-auto items-start"}`}
                      >
                        {/* Message Sender & Time */}
                        <div className="mb-1 text-[10px] text-ink-muted uppercase tracking-wider font-semibold px-1 flex items-center gap-1.5">
                          <span>
                            {isSent ? `${m.author?.name ?? "Henley"} via ${m.channel.replace("_", " ")}` : `${m.fromName} via ${m.channel.replace("_", " ")}`}
                          </span>
                          <span>·</span>
                          <span>{formatRelative(m.sentAt)}</span>
                        </div>

                        {/* Message Bubble with macOS custom corners */}
                        <div
                          className={`px-4 py-2.5 text-[13.5px] leading-relaxed shadow-sm transition-transform ${
                            isSent
                              ? "bg-accent text-white rounded-2xl rounded-br-sm animate-pulse-once"
                              : "bg-row-bg border border-glass-border text-ink rounded-2xl rounded-bl-sm"
                          }`}
                        >
                          <div className="whitespace-pre-wrap">{m.body}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Reply Bar */}
                <form action={send} className="border-t border-glass-border bg-row-bg p-4 shrink-0">
                  <input type="hidden" name="threadId" value={activeThread.id} />
                  <div className="flex items-center gap-3 bg-row-bg border border-glass-border focus-within:border-accent/40 rounded-xl p-2 transition">
                    <textarea
                      name="body"
                      rows={1}
                      className="flex-1 bg-transparent border-none outline-none text-[13.5px] text-ink placeholder:text-ink-muted resize-none py-1.5 px-1 font-normal leading-normal"
                      placeholder={`Reply via ${activeThread.channel.replace("_", " ").toLowerCase()}...`}
                    />
                    <button
                      type="submit"
                      className="w-8 h-8 rounded-full bg-accent hover:bg-accent/90 transition flex items-center justify-center text-white shrink-0 shadow-sm"
                      title="Send Message"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="text-[10px] text-ink-muted text-center mt-2.5 font-medium">
                    Replies go out on the same channel as the thread. Email/SMS gateways are stubbed.
                  </div>
                </form>

                {/* Auto-scroll to bottom script */}
                <script
                  dangerouslySetInnerHTML={{
                    __html: `
                      (function() {
                        const el = document.getElementById('messages-area');
                        if (el) el.scrollTop = el.scrollHeight;
                      })();
                    `,
                  }}
                />
              </>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
