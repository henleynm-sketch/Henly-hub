"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { dismissThread } from "./inboxActions";

// Hub-side dismiss control. Removes the thread from the Hub inbox only — the
// underlying Quo SMS / M365 email is left untouched.
export default function DismissButton({
  threadId,
  channel,
}: {
  threadId: string;
  channel: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState(false);

  if (confirm) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <span className="hh-caption">Dismiss from Hub?</span>
        <button
          type="button"
          className="btn-destructive text-xs"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await dismissThread(threadId);
              if (r.ok) router.push(`/inbox?channel=${channel}`);
              else setConfirm(false);
            })
          }
        >
          {pending ? "Dismissing…" : "Dismiss"}
        </button>
        <button type="button" className="btn-secondary text-xs" onClick={() => setConfirm(false)}>
          Cancel
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      className="btn-ghost text-xs inline-flex items-center gap-1"
      onClick={() => setConfirm(true)}
      title="Remove from Hub inbox (does not delete from Quo or the mailbox)"
    >
      <Trash2 className="h-3.5 w-3.5" />
      Dismiss
    </button>
  );
}
