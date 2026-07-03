"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Loader2, Plus, Send, Sparkles, X, Info } from "lucide-react";
import { cn } from "@/lib/utils";

type ChatMsg =
  | { kind: "user"; text: string }
  | { kind: "assistant"; text: string }
  | { kind: "status"; text: string }
  | { kind: "error"; text: string }
  | { kind: "confirm"; proposal: string; tool: string; resolved?: "approved" | "declined" };

// Renders tool-result links like /jobs/abc inline as Hub links.
function Linkify({ text }: { text: string }) {
  const parts = text.split(/(\/(?:jobs|projects|clients|estimates|contracts|tasks|vendors)(?:\/[A-Za-z0-9_-]+)*)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("/") ? (
          <Link key={i} href={p} className="text-accent hover:underline">
            {p}
          </Link>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

export default function AssistantPanel({ assistantName = "Claude" }: { assistantName?: string }) {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [msgs, open]);

  useEffect(() => {
    if (!open || loaded) return;
    (async () => {
      try {
        const r = await fetch("/api/assistant/chat");
        const d = await r.json();
        if (d.enabled) {
          setThreadId(d.threadId);
          setMsgs(
            (d.messages ?? []).map((m: { role: string; text: string }) =>
              m.role === "user"
                ? { kind: "user" as const, text: m.text }
                : { kind: "assistant" as const, text: m.text },
            ),
          );
          setPendingConfirm(Boolean(d.pendingAction));
          if (d.pendingAction) {
            setMsgs((cur) => [
              ...cur,
              { kind: "confirm", proposal: d.pendingAction.proposal, tool: d.pendingAction.tool },
            ]);
          }
        }
      } catch {
        // panel still usable; first send will surface errors
      }
      setLoaded(true);
    })();
  }, [open, loaded]);

  const run = useCallback(
    async (payload: Record<string, unknown>) => {
      setBusy(true);
      try {
        const res = await fetch("/api/assistant/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ threadId, ...payload }),
        });
        if (!res.ok || !res.body) {
          const d = await res.json().catch(() => null);
          setMsgs((c) => [...c, { kind: "error", text: d?.error ?? `HTTP ${res.status}` }]);
          return;
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const events = buf.split("\n\n");
          buf = events.pop() ?? "";
          for (const ev of events) {
            const line = ev.split("\n").find((l) => l.startsWith("data: "));
            if (!line) continue;
            const d = JSON.parse(line.slice(6));
            if (d.type === "text") setMsgs((c) => [...c, { kind: "assistant", text: d.text }]);
            else if (d.type === "status") setMsgs((c) => [...c, { kind: "status", text: d.text }]);
            else if (d.type === "error") setMsgs((c) => [...c, { kind: "error", text: d.text }]);
            else if (d.type === "confirm") {
              setPendingConfirm(true);
              setMsgs((c) => [...c, { kind: "confirm", proposal: d.proposal, tool: d.tool }]);
            } else if (d.type === "done" && d.threadId) {
              setThreadId(d.threadId);
            }
          }
        }
      } catch (err) {
        setMsgs((c) => [
          ...c,
          { kind: "error", text: err instanceof Error ? err.message : "Connection failed" },
        ]);
      } finally {
        setBusy(false);
      }
    },
    [threadId],
  );

  function sendMessage() {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setPendingConfirm(false);
    setMsgs((c) => [...c.map(resolveConfirms("declined")), { kind: "user", text }]);
    void run({ message: text });
  }

  const resolveConfirms =
    (how: "approved" | "declined") =>
    (m: ChatMsg): ChatMsg =>
      m.kind === "confirm" && !m.resolved ? { ...m, resolved: how } : m;

  function confirm(approve: boolean) {
    if (busy) return;
    setPendingConfirm(false);
    setMsgs((c) => c.map(resolveConfirms(approve ? "approved" : "declined")));
    void run({ confirm: { approve } });
  }

  function newChat() {
    setMsgs([]);
    setThreadId(null);
    setPendingConfirm(false);
    void run({ newThread: true, message: "Hi" });
  }

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close assistant" : `Ask ${assistantName}`}
        className="fixed bottom-4 right-4 z-[75] flex items-center gap-1.5 rounded-full bg-accent px-4 py-2.5 text-xs font-bold text-white shadow-lg hover:bg-accent-hover transition-all active:scale-95"
        style={{ boxShadow: "var(--accent-glow)" }}
      >
        {open ? <X size={15} /> : <Sparkles size={15} />}
        <span>{open ? "Close" : `Ask ${assistantName}`}</span>
      </button>

      {open &&
        createPortal(
          <div className="!fixed bottom-16 right-4 z-[75] w-[380px] max-w-[calc(100vw-2rem)] h-[540px] max-h-[70vh] hh-panel !p-0 flex flex-col overflow-hidden">
            <div className="flex items-center gap-2 border-b border-glass-border px-4 py-3">
              <span className="hh-primary flex-1">{assistantName} · Henley Hub</span>
              <button className="btn-ghost !p-1.5" onClick={() => setInfoOpen((v) => !v)} aria-label="About the assistant">
                <Info size={14} />
              </button>
              <button className="btn-ghost !p-1.5" onClick={newChat} aria-label="New chat" disabled={busy}>
                <Plus size={14} />
              </button>
            </div>

            {infoOpen && (
              <div className="border-b border-glass-border px-4 py-3 hh-caption">
                Runs as you — same role limits as the UI; every change asks first and is
                audit-logged. External agents (OpenClaw/Charlie) connect via v1 API keys
                with scopes under Settings → API keys, not through this chat.
              </div>
            )}

            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
              {msgs.length === 0 && !busy && (
                <p className="hh-secondary">
                  Ask about jobs, clients, estimates — or tell me to do something and
                  I&apos;ll ask before changing anything.
                </p>
              )}
              {msgs.map((m, i) => {
                if (m.kind === "user")
                  return (
                    <div key={i} className="flex justify-end">
                      <div className="max-w-[85%] rounded-2xl bg-accent/15 border border-accent/30 px-3 py-2 text-sm text-ink whitespace-pre-wrap">
                        {m.text}
                      </div>
                    </div>
                  );
                if (m.kind === "assistant")
                  return (
                    <div key={i} className="max-w-[92%] text-sm hh-primary whitespace-pre-wrap">
                      <Linkify text={m.text} />
                    </div>
                  );
                if (m.kind === "status")
                  return (
                    <div key={i} className="hh-caption italic">
                      {m.text}
                    </div>
                  );
                if (m.kind === "error")
                  return (
                    <div key={i} className="flex items-start gap-2">
                      <span className="hh-dot hh-dot--red mt-1" />
                      <span className="hh-secondary break-all text-sm">{m.text}</span>
                    </div>
                  );
                return (
                  <div key={i} className="hh-panel !p-3 border border-glass-border-strong">
                    <div className="hh-label mb-1">Confirm action</div>
                    <p className="hh-secondary text-sm">{m.proposal}</p>
                    {m.resolved ? (
                      <p className="hh-caption mt-2">{m.resolved === "approved" ? "Approved" : "Declined"}</p>
                    ) : (
                      <div className="flex gap-2 mt-2">
                        <button className="btn-primary text-xs" disabled={busy} onClick={() => confirm(true)}>
                          Confirm
                        </button>
                        <button className="btn-secondary text-xs" disabled={busy} onClick={() => confirm(false)}>
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
              {busy && (
                <div className="flex items-center gap-2 hh-caption">
                  <Loader2 size={12} className="animate-spin" /> thinking…
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            <div className="border-t border-glass-border p-3 flex items-end gap-2">
              <textarea
                className="input flex-1 !py-2 text-sm resize-none"
                rows={2}
                placeholder={pendingConfirm ? "Confirm above, or type to move on…" : `Message ${assistantName}…`}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                disabled={busy}
              />
              <button
                className="btn-primary !p-2.5"
                onClick={sendMessage}
                disabled={busy || !input.trim()}
                aria-label="Send"
              >
                <Send size={15} />
              </button>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
