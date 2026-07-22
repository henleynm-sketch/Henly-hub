"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth, signIn } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canManageTeam, ROLES, ROLE_LABELS, PENDING_ROLE, type Role } from "@/lib/roles";
import {
  ensureOrganization,
  newRawToken,
  hashToken,
  passwordPolicyError,
} from "@/lib/auth-org";
import { emitNotification } from "@/lib/notifications/dispatch";
import { rateLimit } from "@/lib/api/rateLimit";

export type AuthActionResult = { ok: boolean; error?: string };

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const RESET_TTL_MS = 60 * 60 * 1000;
const BCRYPT_COST = 12;

// Self-service registration is limited to the company domain; everyone else
// still needs an invite. Registered accounts start with zero access (PENDING).
const ALLOWED_REGISTER_DOMAIN = "henleycontracting.com";

async function ceo() {
  const me = await auth();
  if (!me?.user || !canManageTeam(me.user.role as Role)) return null;
  return me;
}

// ── Invites (CEO only) ───────────────────────────────────────────────────────

export async function inviteUser(formData: FormData): Promise<AuthActionResult> {
  const me = await ceo();
  if (!me) return { ok: false, error: "Not authorized" };
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const role = String(formData.get("role") || "");
  if (!email || !email.includes("@")) return { ok: false, error: "Valid email required" };
  if (!(ROLES as readonly string[]).includes(role)) return { ok: false, error: "Invalid role" };
  if (await prisma.user.findUnique({ where: { email } })) {
    return { ok: false, error: "A user with this email already exists" };
  }

  const org = await ensureOrganization();
  // Re-invite regenerates and revokes any prior open invite for this email.
  await prisma.invite.updateMany({
    where: { email, acceptedAt: null, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  const raw = newRawToken();
  await prisma.invite.create({
    data: {
      email,
      role,
      organizationId: org.id,
      tokenHash: await hashToken(raw),
      invitedById: me.user.id,
      expiresAt: new Date(Date.now() + INVITE_TTL_MS),
    },
  });
  await emitNotification({
    eventType: "INVITE",
    actorId: me.user.id,
    payload: {
      directEmail: email,
      rawToken: raw,
      roleLabel: ROLE_LABELS[role as Role] ?? role,
      orgName: org.name,
      inviterName: me.user.name ?? "Your administrator",
    },
  });
  await prisma.auditLog.create({
    data: { actorId: me.user.id, action: "auth.invite", target: `${email} (${role})` },
  });
  revalidatePath("/settings");
  return { ok: true };
}

export async function revokeInvite(inviteId: string): Promise<AuthActionResult> {
  const me = await ceo();
  if (!me) return { ok: false, error: "Not authorized" };
  const inv = await prisma.invite.findUnique({ where: { id: inviteId } });
  if (!inv || inv.acceptedAt) return { ok: false, error: "Invite not found or already accepted" };
  await prisma.invite.update({ where: { id: inviteId }, data: { revokedAt: new Date() } });
  await prisma.auditLog.create({
    data: { actorId: me.user.id, action: "auth.invite.revoke", target: inv.email },
  });
  revalidatePath("/settings");
  return { ok: true };
}

export async function resendInvite(inviteId: string): Promise<AuthActionResult> {
  const me = await ceo();
  if (!me) return { ok: false, error: "Not authorized" };
  const inv = await prisma.invite.findUnique({ where: { id: inviteId } });
  if (!inv || inv.acceptedAt) return { ok: false, error: "Invite not found or already accepted" };
  const fd = new FormData();
  fd.set("email", inv.email);
  fd.set("role", inv.role);
  return inviteUser(fd);
}

// ── Accept invite (public) ───────────────────────────────────────────────────

export async function acceptInvite(formData: FormData): Promise<AuthActionResult> {
  const rawToken = String(formData.get("token") || "");
  const name = String(formData.get("name") || "").trim();
  const password = String(formData.get("password") || "");
  const confirm = String(formData.get("confirm") || "");
  if (!name) return { ok: false, error: "Name is required" };
  if (password !== confirm) return { ok: false, error: "Passwords do not match" };
  const policy = passwordPolicyError(password);
  if (policy) return { ok: false, error: policy };

  const inv = await prisma.invite.findUnique({ where: { tokenHash: await hashToken(rawToken) } });
  if (!inv || inv.revokedAt) return { ok: false, error: "This invitation is no longer valid." };
  if (inv.acceptedAt) return { ok: false, error: "This invitation was already used." };
  if (inv.expiresAt < new Date()) return { ok: false, error: "This invitation has expired — ask your administrator for a new one." };
  if (await prisma.user.findUnique({ where: { email: inv.email } })) {
    return { ok: false, error: "An account with this email already exists — try signing in." };
  }

  // Role and org come from the INVITE, never from client input.
  await prisma.user.create({
    data: {
      email: inv.email,
      name,
      passwordHash: await bcrypt.hash(password, BCRYPT_COST),
      role: inv.role,
      organizationId: inv.organizationId,
      emailVerifiedAt: new Date(), // reached via the emailed link
    },
  });
  await prisma.invite.update({ where: { id: inv.id }, data: { acceptedAt: new Date() } });
  await prisma.auditLog.create({
    data: { actorId: inv.invitedById, action: "auth.invite.accepted", target: inv.email },
  });

  await signIn("credentials", { email: inv.email, password, redirect: false });
  redirect("/dashboard");
}

// ── Password reset (public) ──────────────────────────────────────────────────

export async function requestPasswordReset(formData: FormData): Promise<AuthActionResult> {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  // Rate-limit per email; response below is IDENTICAL whether or not the
  // account exists — no user enumeration.
  const rl = rateLimit(`pwreset:${email}`, "write");
  if (!rl.ok) return { ok: true };

  const user = email ? await prisma.user.findUnique({ where: { email } }) : null;
  if (user && user.active) {
    const raw = newRawToken();
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: await hashToken(raw),
        expiresAt: new Date(Date.now() + RESET_TTL_MS),
      },
    });
    await emitNotification({
      eventType: "PASSWORD_RESET",
      payload: { directEmail: email, rawToken: raw },
    });
  }
  return { ok: true };
}

export async function resetPassword(formData: FormData): Promise<AuthActionResult> {
  const rawToken = String(formData.get("token") || "");
  const password = String(formData.get("password") || "");
  const confirm = String(formData.get("confirm") || "");
  if (password !== confirm) return { ok: false, error: "Passwords do not match" };
  const policy = passwordPolicyError(password);
  if (policy) return { ok: false, error: policy };

  const row = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: await hashToken(rawToken) },
  });
  if (!row || row.usedAt) return { ok: false, error: "This reset link is no longer valid." };
  if (row.expiresAt < new Date()) return { ok: false, error: "This reset link has expired — request a new one." };

  await prisma.$transaction([
    prisma.user.update({
      where: { id: row.userId },
      data: { passwordHash: await bcrypt.hash(password, BCRYPT_COST) },
    }),
    // Invalidate every outstanding reset token for this user.
    prisma.passwordResetToken.updateMany({
      where: { userId: row.userId, usedAt: null },
      data: { usedAt: new Date() },
    }),
    prisma.auditLog.create({
      data: { actorId: row.userId, action: "auth.password.reset", target: "self-service" },
    }),
  ]);
  return { ok: true };
}

// ── Self-service registration (public, domain-restricted) ────────────────────
// Creates a PENDING account with zero access. The CEO grants a real role in
// Settings → Team & Access; until then the user only sees the waiting screen.
// This preserves the invite-only access model while allowing staff to sign up.
export async function registerUser(formData: FormData): Promise<AuthActionResult> {
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const confirm = String(formData.get("confirm") || "");

  if (!name) return { ok: false, error: "Name is required" };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Enter a valid email address" };
  }
  if (email.split("@")[1] !== ALLOWED_REGISTER_DOMAIN) {
    return { ok: false, error: `Registration is limited to @${ALLOWED_REGISTER_DOMAIN} email addresses. Ask your administrator for an invite.` };
  }
  if (password !== confirm) return { ok: false, error: "Passwords do not match" };
  const policy = passwordPolicyError(password);
  if (policy) return { ok: false, error: policy };

  // Throttle per email, same token-bucket the login + reset flows use.
  const rl = rateLimit(`register:${email}`, "write");
  if (!rl.ok) return { ok: false, error: "Too many attempts — wait a minute and try again." };

  if (await prisma.user.findUnique({ where: { email } })) {
    return { ok: false, error: "An account with this email already exists — try signing in." };
  }

  const org = await ensureOrganization();
  const user = await prisma.user.create({
    data: {
      email,
      name,
      passwordHash: await bcrypt.hash(password, BCRYPT_COST),
      role: PENDING_ROLE,
      organizationId: org.id,
    },
  });
  await prisma.auditLog.create({
    data: { actorId: user.id, action: "auth.register.pending", target: email },
  });

  // Sign in so they land on the holding screen; access stays zero until a role
  // is assigned. redirect() throws NEXT_REDIRECT, which Next turns into a client
  // navigation — the {ok:false} returns above are the only values callers see.
  await signIn("credentials", { email, password, redirect: false });
  redirect("/pending");
}

// Email/password sign-in for the branded auth page. Errors round-trip back to
// "/" via a query param so the split-screen can show them inline.
export async function signInWithPassword(formData: FormData): Promise<void> {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const rl = rateLimit(`login:${email}`, "write");
  if (!rl.ok) redirect("/?error=rate");
  try {
    await signIn("credentials", { email, password, redirectTo: "/dashboard" });
  } catch (err) {
    if ((err as { digest?: string })?.digest?.startsWith("NEXT_REDIRECT")) throw err;
    redirect("/?error=invalid");
  }
}
