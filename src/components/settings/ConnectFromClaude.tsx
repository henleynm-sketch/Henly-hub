"use client";

import { useState, useTransition } from "react";
import { Copy, Loader2, Trash2 } from "lucide-react";
import { revokeGrant, type GrantRow } from "@/app/(app)/settings/oauthGrantActions";

function relative(iso: string | null): string {
  if (!iso) return "never";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export default function ConnectFromClaude({
  connectorUrl,
  isPublicHost,
  grants,
}: {
  connectorUrl: string;
  isPublicHost: boolean;
  grants: GrantRow[];
}) {
  const [pending, start] = useTransition();
  const [toast, setToast] = useState<string | null>(null);
  const [rows, setRows] = useState(grants);

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(connectorUrl);
      flash("Connector URL copied");
    } catch {
      flash("Copy failed");
    }
  }

  function onRevoke(id: string) {
    start(async () => {
      const r = await revokeGrant(id);
      if (r.ok) {
        setRows((c) => c.filter((g) => g.id !== id));
        flash("Access revoked");
      } else {
        flash(r.error ?? "Revoke failed");
      }
    });
  }

  return (
    <div className="hh-row hh-row--flat flex-col !items-start !gap-2">
      <div className="flex items-center justify-between w-full">
        <span className="hh-primary">Connect from Claude</span>
        {isPublicHost ? (
          <span className="hh-badge hh-badge--success">available</span>
        ) : (
          <span className="hh-badge hh-badge--warning">needs public hosting</span>
        )}
      </div>

      {toast && (
        <div className="flex items-center gap-2">
          <span className="hh-dot hh-dot--green" />
          <span className="hh-secondary">{toast}</span>
        </div>
      )}

      <span className="hh-secondary">
        Use the Hub from your own Claude app (web, desktop, phone): add it as a custom
        connector, sign in once with your Hub account, and your Claude subscription
        covers the usage. Your Hub role limits every action, server-side.
      </span>

      <div className="flex items-center gap-2 w-full">
        <code className="hh-chip flex-1 min-w-0 truncate">{connectorUrl}</code>
        <button className="btn-ghost !p-1.5" onClick={copyUrl} aria-label="Copy connector URL">
          <Copy size={13} />
        </button>
      </div>

      {!isPublicHost && (
        <span className="hh-caption">
          Claude&apos;s apps require a public HTTPS URL — this unlocks when the Hub is
          deployed (hub.henleycontracting.com). The endpoint is live in code and works
          the moment hosting lands.
        </span>
      )}
      <span className="hh-caption">
        In Claude: Settings → Connectors → Add custom connector → paste the URL above →
        your browser opens the Hub sign-in + consent. External agents (OpenClaw/Charlie)
        use the same connector with their own scoped Hub user.
      </span>

      {rows.length > 0 && (
        <div className="w-full flex flex-col gap-1 mt-1">
          <span className="hh-label">Active grants</span>
          {rows.map((g) => (
            <div key={g.id} className="flex items-center justify-between w-full gap-2">
              <span className="hh-secondary flex-1 min-w-0 truncate">
                {g.clientName} · granted {relative(g.createdAt)} · last used {relative(g.lastUsedAt)}
              </span>
              <button
                className="btn-ghost !p-1.5"
                disabled={pending}
                onClick={() => onRevoke(g.id)}
                aria-label={`Revoke ${g.clientName}`}
              >
                {pending ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
