import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { newToken, parseRedirectUris, CODE_TTL_MS } from "@/lib/oauth";
import type { Role } from "@/lib/roles";
import { ROLE_LABELS } from "@/lib/roles";

/**
 * OAuth 2.1 authorization endpoint: rides the existing NextAuth session and
 * shows a consent screen. PKCE S256 required; redirect_uri must exactly match
 * a registered URI (we never redirect to anything unvalidated).
 */

type SP = {
  client_id?: string;
  redirect_uri?: string;
  response_type?: string;
  state?: string;
  code_challenge?: string;
  code_challenge_method?: string;
  scope?: string;
};

function ErrorPanel({ msg }: { msg: string }) {
  return (
    <div className="min-h-screen grid place-items-center p-6">
      <div className="hh-panel max-w-md p-6">
        <h1 className="hh-label">Authorization error</h1>
        <p className="hh-secondary mt-2">{msg}</p>
      </div>
    </div>
  );
}

export default async function AuthorizePage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user) {
    const qs = new URLSearchParams(
      Object.entries(sp).filter(([, v]) => typeof v === "string") as [string, string][],
    ).toString();
    redirect(`/sign-in?callbackUrl=${encodeURIComponent(`/oauth/authorize?${qs}`)}`);
  }

  const clientId = sp.client_id ?? "";
  const redirectUri = sp.redirect_uri ?? "";
  const state = sp.state ?? "";
  const challenge = sp.code_challenge ?? "";

  const client = clientId
    ? await prisma.oAuthClient.findUnique({ where: { clientId } })
    : null;
  if (!client) return <ErrorPanel msg="Unknown client_id." />;

  const registered = parseRedirectUris(client.redirectUris);
  if (!registered.includes(redirectUri)) {
    // Exact match failed — refuse without redirecting anywhere.
    return <ErrorPanel msg="redirect_uri is not registered for this client." />;
  }

  const back = (params: Record<string, string>) => {
    const u = new URL(redirectUri);
    for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
    if (state) u.searchParams.set("state", state);
    return u.toString();
  };

  if (sp.response_type !== "code") redirect(back({ error: "unsupported_response_type" }));
  if (!challenge || sp.code_challenge_method !== "S256") {
    redirect(back({ error: "invalid_request", error_description: "PKCE S256 required" }));
  }

  const user = session.user;
  const role = user.role as Role;

  async function approve() {
    "use server";
    const me = await auth();
    if (!me?.user || me.user.id !== user.id) redirect("/sign-in");
    const code = newToken("hubcode");
    await prisma.oAuthCode.create({
      data: {
        code,
        clientDbId: client!.id,
        userId: me.user.id,
        redirectUri,
        codeChallenge: challenge,
        scopes: "hub:tools",
        expiresAt: new Date(Date.now() + CODE_TTL_MS),
      },
    });
    await prisma.auditLog.create({
      data: { actorId: me.user.id, action: "oauth.grant", target: client!.name },
    });
    redirect(back({ code }));
  }

  async function deny() {
    "use server";
    redirect(back({ error: "access_denied" }));
  }

  return (
    <div className="min-h-screen grid place-items-center p-6">
      <div className="hh-panel max-w-md w-full p-6 flex flex-col gap-4">
        <div>
          <h1 className="hh-display text-xl font-bold text-ink">Connect to Henley Hub</h1>
          <p className="hh-secondary mt-1">
            <span className="hh-primary">{client.name}</span> is asking to use the Hub as
            your account.
          </p>
        </div>
        <div className="hh-row hh-row--flat flex-col !items-start !gap-1">
          <span className="hh-primary">{user.name}</span>
          <span className="hh-secondary">
            {user.email} · {ROLE_LABELS[role] ?? role}
          </span>
        </div>
        <div className="hh-caption">
          It will be able to search and act in the Hub exactly as your role allows — the
          same limits as when you use the Hub yourself. Every action is audit-logged. You
          can revoke this any time in Settings → Connect from Claude.
        </div>
        <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
          <form action={deny}>
            <button className="btn-secondary w-full sm:w-auto" type="submit">
              Deny
            </button>
          </form>
          <form action={approve}>
            <button className="btn-primary w-full sm:w-auto" type="submit">
              Allow access
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
