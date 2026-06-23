import PageHeader from "@/components/PageHeader";
import { prisma } from "@/lib/prisma";
import { createMessage } from "@/lib/services/threadService";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { formatRelative } from "@/lib/utils";
import type { Role } from "@/lib/roles";
import { revalidatePath } from "next/cache";
import { Send, MessageSquare, Mail, MessageCircle, Phone } from "lucide-react";
import type { ElementType } from "react";

// ─── Tab definitions ──────────────────────────────────────────────────────────

type TabChannel = "EMAIL" | "SMS" | "CALL_NOTE";

interface TabDef {
  channel: TabChannel;
  label: string;
  emptyTitle: string;
  emptyBody: string;
  Icon: ElementType;
}

const TABS: TabDef[] = [
  {
    channel: "EMAIL",
    label: "Email",
    emptyTitle: "Mailbox not connected yet",
    emptyBody: "Email sync will appear here once the M365 mail connector is active.",
    Icon: Mail,
  },
  {
    channel: "SMS",
    label: "SMS",
    emptyTitle: "No SMS conversations yet",
    emptyBody: "Quo-linked SMS threads will appear here.",
    Icon: MessageCircle,
  },
  {
    channel: "CALL_NOTE",
    label: "Voice",
    emptyTitle: "No call notes yet",
    emptyBody: "Voice call notes will appear here once recorded.",
    Icon: Phone,
  },
];

// ─── Per-thread channel icon ───────────────────────────────────────────────────

function ChannelIcon({ channel }: { channel: string }) {
  const c = channel.toUpperCase();
  if (c === "SMS") return <MessageCircle className="h-3.5 w-3.5 text-ink-soft shrink-0" />;
  if (c === "CALL_NOTE") return <Phone className="h-3.5 w-3.5 text-ink-soft shrink-0" />;
  return <Mail className="h-3.5 w-3.5 text-ink-soft shrink-0" />;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

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

  // Active tab — default to SMS (first channel with live data).
  // Falls back to SMS for unrecognised or missing ?channel= values (e.g. old "ALL" bookmarks).
  const activeChannel: TabChannel =
    TABS.find((t) => t.channel === sp.channel?.toUpperCase())?.channel ?? "SMS";

  // ── Role-gated where clause ───────────────────────────────────────────────────
  // Builds a Prisma ThreadWhereInput scoped by role + a specific channel.
  // Defined here (not inside each query) to keep the role logic in one place.
  function buildWhere(channel: TabChannel) {
    if (role === "CLIENT" && myClientId) {
      return { clientId: myClientId, channel };
    }
    if (role === "SUB" || role === "FIELD") {
      return { project: { assignments: { some: { userId } } }, channel };
    }
    // CEO / OFFICE — optional clientId scoping from query string
    return { ...(sp.clientId ? { clientId: sp.clientId } : {}), channel };
  }

  // ── Per-channel counts for tab badges ────────────────────────────────────────
  const [emailCount, smsCount, callCount] = await Promise.all([
    prisma.thread.count({ where: buildWhere("EMAIL") }),
    prisma.thread.count({ where: buildWhere("SMS") }),
    prisma.thread.count({ where: buildWhere("CALL_NOTE") }),
  ]);
  const countMap: Record<TabChannel, number> = {
    EMAIL: emailCount,
    SMS: smsCount,
    CALL_NOTE: callCount,
  };

  // ── Threads for the active tab ───────────────────────────────────────────────
  const threads = await prisma.thread.findMany({
    where: buildWhere(activeChannel),
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

  // ── Server action (unchanged from original) ───────────────────────────────────
  async function send(formData: FormData) {
    "use server";
    const threadId = String(formData.get("threadId") || "");
    const body = String(formData.get("body") || "").trim();
    if (!threadId || !body) return;
    const me = await auth();
    if (!me?.user) return;
    await createMessage({
      threadId,
      body,
      authorId: me.user.id,
      fromName: me.user.name ?? "Henley",
      direction: "OUT",
    });
    revalidatePath("/inbox");
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────

  const getChannelTagClass = (channel: string) => {
    switch (channel.toUpperCase()) {
      case "SMS":
        return "hh-badge hh-badge--success";
      case "CALL_NOTE":
        return "hh-badge hh-badge--warning";
      default:
        return "hh-badge";
    }
  };

  const getInitials = (name: string | null) => {
    if (!name) return "?";
    return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
  };

  const activeTab = TABS.find((t) => t.channel === activeChannel)!;
  const EmptyIcon = activeTab.Icon;

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <>
      <PageHeader
        title="Inbox"
        subtitle="Email, SMS, and Voice — each channel in its own view."
      />
      <div className="p-6">
        <div className="hh-panel !p-0 grid grid-cols-12 overflow-hidden">

          {/* ── Thread List Column ─────────────────────────────────────────────── */}
          <aside className="col-span-12 md:col-span-5 lg:col-span-4 border-r border-glass-border flex flex-col h-[calc(100vh-13rem)] md:h-[calc(100vh-11rem)] overflow-hidden">

            {/* Per-source tabs */}
            <div className="flex border-b border-glass-border bg-row-bg shrink-0">
              {TABS.map((tab) => {
                const isActive = tab.channel === activeChannel;
                const count = countMap[tab.channel];
                const TabIcon = tab.Icon;
                return (
                  <a
                    key={tab.channel}
                    href={`/inbox?channel=${tab.channel}`}
                    className={[
                      "flex flex-1 items-center justify-center gap-1.5 px-3 py-3 text-xs font-semibold uppercase tracking-wider border-b-2 transition-colors",
                      isActive
                        ? "border-accent text-accent bg-accent/5"
                        : "border-transparent text-ink-soft hover:text-ink hover:bg-row-hover",
                    ].join(" ")}
                  >
                    <TabIcon className="h-3.5 w-3.5 shrink-0" />
                    <span>{tab.label}</span>
                    {count > 0 && (
                      <span
                        className={[
                          "rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none",
                          isActive
                            ? "bg-accent/20 text-accent"
                            : "bg-glass-bg border border-glass-border text-ink-soft",
                        ].join(" ")}
                      >
                        {count}
                      </span>
                    )}
                  </a>
                );
              })}
            </div>

            {/* Thread list */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {threads.length === 0 ? (
                <div className="p-6 text-center">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <EmptyIcon className="h-8 w-8 text-ink-muted" />
                    <p className="hh-primary">{activeTab.emptyTitle}</p>
                    <p className="hh-secondary">{activeTab.emptyBody}</p>
                  </div>
                </div>
              ) : (
                threads.map((t) => {
                  const isActive = t.id === activeId;
                  return (
                    <a
                      key={t.id}
                      href={`/inbox?threadId=${t.id}&channel=${activeChannel}`}
                      className={`hh-row hh-row--flat flex-col !items-stretch !gap-0 relative ${
                        isActive ? "hh-row--active" : ""
                      }`}
                    >
                      {isActive && (
                        <span className="absolute left-0 top-2.5 bottom-2.5 w-[3px] bg-accent rounded-r-md" />
                      )}
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5 min-w-0">
                          <ChannelIcon channel={t.channel} />
                          <span className="hh-primary truncate">
                            {t.client?.name ?? t.subject}
                          </span>
                        </span>
                        <span className="hh-caption shrink-0">{formatRelative(t.lastAt)}</span>
                      </div>
                      {t.messages[0] && (
                        <div className="hh-secondary truncate mt-0.5">{t.messages[0].body}</div>
                      )}
                      <div className="mt-2.5 flex items-center gap-2 flex-wrap">
                        <span className={`!ml-0 ${getChannelTagClass(t.channel)}`}>
                          {t.channel.replace("_", " ")}
                        </span>
                        {t.project && (
                          <span className="hh-caption truncate max-w-[120px]">
                            &middot; {t.project.name}
                          </span>
                        )}
                        {t.unread > 0 && (
                          <span className="hh-badge shrink-0">{t.unread} new</span>
                        )}
                      </div>
                    </a>
                  );
                })
              )}
            </div>
          </aside>

          {/* ── Conversation Pane Column ───────────────────────────────────────── */}
          <section className="col-span-12 md:col-span-7 lg:col-span-8 flex flex-col h-[calc(100vh-13rem)] md:h-[calc(100vh-11rem)] overflow-hidden bg-row-bg">
            {!activeThread ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-2">
                <MessageSquare className="h-10 w-10 text-ink-muted animate-pulse" />
                <p className="hh-primary">Select a thread</p>
                <p className="hh-secondary">Choose a conversation from the sidebar to start reading.</p>
              </div>
            ) : (
              <>
                {/* Convo Header */}
                <div className="border-b border-glass-border bg-row-bg px-6 py-4 flex items-center gap-3 shrink-0">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent font-semibold text-sm">
                    {getInitials(activeThread.client?.name ?? "I")}
                  </div>
                  <div>
                    <h2 className="hh-primary leading-tight">{activeThread.subject}</h2>
                    <div className="hh-secondary mt-0.5">
                      {activeThread.client?.name ?? "Internal Info"}
                      {activeThread.project && ` · ${activeThread.project.name}`}
                    </div>
                  </div>
                  <span className="hh-badge shrink-0">
                    {activeThread.channel.replace("_", " ")}
                  </span>
                </div>

                {/* Messages Stream */}
                <div id="messages-area" className="flex-1 overflow-y-auto p-6 space-y-4 flex flex-col">
                  <div className="text-center my-2 shrink-0">
                    <span className="hh-chip uppercase tracking-wider">
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
                        <div className="mb-1 hh-caption uppercase tracking-wider px-1 flex items-center gap-1.5">
                          <span>
                            {isSent
                              ? `${m.author?.name ?? "Henley"} via ${m.channel.replace("_", " ")}`
                              : `${m.fromName} via ${m.channel.replace("_", " ")}`}
                          </span>
                          <span>&middot;</span>
                          <span>{formatRelative(m.sentAt)}</span>
                        </div>
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

                {/* Reply Bar — unchanged from original */}
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
                  <div className="hh-caption text-center mt-2.5">
                    Replies on Quo-linked SMS threads send through Quo. Email gateway is stubbed.
                  </div>
                </form>

                {/* Auto-scroll to bottom */}
                <script
                  dangerouslySetInnerHTML={{
                    __html: `(function(){var el=document.getElementById('messages-area');if(el)el.scrollTop=el.scrollHeight;})();`,
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
