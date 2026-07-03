"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send, Loader2 } from "lucide-react";
import { replyToThread } from "./inboxActions";

export default function ReplyBar({
  threadId,
  channel,
}: {
  threadId: string;
  channel: string;
}) {
  const [body, setBody] = useState("");
  const [pending, start] = useTransition();
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(
    null
  );
  const router = useRouter();

  function flash(ok: boolean, msg: string) {
    setFeedback({ ok, msg });
    setTimeout(() => setFeedback(null), 4000);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() || pending) return;
    const text = body;
    start(async () => {
      const r = await replyToThread(threadId, text);
      if (r.ok) {
        setBody("");
        flash(true, "Sent");
        router.refresh();
      } else {
        flash(false, r.error ?? "Send failed");
      }
    });
  }

  const placeholder =
    channel === "EMAIL"
      ? "Reply via email..."
      : `Reply via ${channel.replace("_", " ").toLowerCase()}...`;

  const hint =
    channel === "EMAIL"
      ? "Replies send via Microsoft 365 as the shared mailbox."
      : "Replies on Quo-linked SMS threads send through Quo.";

  return (
    <div className="border-t border-glass-border bg-row-bg p-4 shrink-0">
      <form onSubmit={onSubmit}>
        <div className="flex items-center gap-3 bg-row-bg border border-glass-border focus-within:border-accent/40 rounded-xl p-2 transition">
          <textarea
            rows={1}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            disabled={pending}
            className="flex-1 bg-transparent border-none outline-none text-[13.5px] text-ink placeholder:text-ink-muted resize-none py-1.5 px-1 font-normal leading-normal disabled:opacity-60"
            placeholder={placeholder}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSubmit(e as unknown as React.FormEvent);
              }
            }}
          />
          <button
            type="submit"
            disabled={!body.trim() || pending}
            className="w-8 h-8 rounded-full bg-accent hover:bg-accent/90 transition flex items-center justify-center text-white shrink-0 shadow-sm disabled:opacity-50 disabled:pointer-events-none"
            title="Send"
          >
            {pending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </form>
      <div className="hh-caption text-center mt-2.5">
        {feedback ? (
          <span
            style={{
              color: feedback.ok
                ? "var(--hh-dot-green)"
                : "var(--hh-dot-red)",
            }}
          >
            {feedback.msg}
          </span>
        ) : (
          hint
        )}
      </div>
    </div>
  );
}
