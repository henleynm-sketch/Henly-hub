"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import {
  sendTestNotification,
  flushNotificationQueue,
  setNotifyMaster,
} from "@/app/(app)/settings/notifyActions";

export default function NotifyControls({ enabled }: { enabled: boolean }) {
  const [pending, start] = useTransition();
  const [toast, setToast] = useState<string | null>(null);

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 6000);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className={enabled ? "hh-badge hh-badge--success" : "hh-badge hh-badge--danger"}>
        {enabled ? "email delivery on" : "email delivery OFF"}
      </span>
      <button
        className="btn-secondary text-xs inline-flex items-center gap-1.5"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await setNotifyMaster(!enabled);
            flash(r.ok ? (enabled ? "Kill switch ON — all sends halted" : "Email delivery enabled") : r.error ?? "Failed");
          })
        }
      >
        {pending && <Loader2 size={12} className="animate-spin" />}
        {enabled ? "Kill switch" : "Enable delivery"}
      </button>
      <button
        className="btn-secondary text-xs inline-flex items-center gap-1.5"
        disabled={pending || !enabled}
        onClick={() =>
          start(async () => {
            const r = await sendTestNotification();
            flash(r.ok ? "Test email queued — check your inbox (from hello@)" : r.error ?? "Failed");
          })
        }
      >
        {pending && <Loader2 size={12} className="animate-spin" />}
        Send test email
      </button>
      <button
        className="btn-secondary text-xs inline-flex items-center gap-1.5"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await flushNotificationQueue();
            flash(r.ok ? `Flushed — ${r.attempted ?? 0} deliveries attempted` : r.error ?? "Failed");
          })
        }
      >
        {pending && <Loader2 size={12} className="animate-spin" />}
        Flush queue
      </button>
      {toast && <span className="hh-secondary">{toast}</span>}
    </div>
  );
}
