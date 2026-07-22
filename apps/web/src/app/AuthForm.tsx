"use client";

import { useState, useTransition } from "react";
import { signInWithPassword, registerUser } from "@/lib/actions/auth";
import { startGoogleSignIn, startMicrosoftSignIn } from "@/lib/actions/oauth";

type Mode = "signin" | "register";

const INPUT =
  "w-full rounded-lg border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 outline-none transition focus:border-accent focus:ring-1 focus:ring-accent";
const LABEL = "mb-1.5 block text-sm font-medium text-neutral-900";
const SSO_BTN =
  "w-full rounded-lg border border-neutral-300 bg-white py-2.5 text-sm font-semibold text-neutral-900 transition hover:bg-neutral-50";

// Left-panel auth form for the branded landing. Sign-in / Create-account toggle,
// Google + Microsoft, forgot-password — all wired to the Agent A server actions.
export default function AuthForm({
  initialError,
  initialNotice,
}: {
  initialError?: string;
  initialNotice?: string;
}) {
  const [mode, setMode] = useState<Mode>("signin");
  const [error, setError] = useState<string | null>(mapError(initialError));
  const [pending, start] = useTransition();

  function switchMode(m: Mode) {
    setMode(m);
    setError(null);
  }

  function onRegister(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get("name") || "").trim();
    const email = String(fd.get("email") || "").trim().toLowerCase();
    const password = String(fd.get("password") || "");
    const confirm = String(fd.get("confirm") || "");
    if (!name) return setError("Name is required.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setError("Enter a valid email address.");
    if (password.length < 10) return setError("Password must be at least 10 characters.");
    if (password !== confirm) return setError("Passwords do not match.");
    setError(null);
    start(async () => {
      const res = await registerUser(fd);
      if (res && !res.ok) setError(res.error ?? "Registration failed.");
    });
  }

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
        {mode === "signin" ? "Sign in to Henley Hub" : "Create your account"}
      </h1>
      <p className="mt-1.5 text-sm text-neutral-500">
        {mode === "signin" ? "Welcome back." : "Request access to Henley Hub."}
      </p>

      {initialNotice === "signed-out" && <Notice>You&apos;re signed out.</Notice>}
      {initialNotice === "reset-done" && <Notice>Password updated — sign in with your new one.</Notice>}
      {error && (
        <div
          role="alert"
          className="mt-5 flex items-start gap-2 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2.5 text-sm text-rose-700"
        >
          <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-rose-500" aria-hidden />
          <span>{error}</span>
        </div>
      )}

      {mode === "signin" ? (
        <form action={signInWithPassword} className="mt-6 space-y-4">
          <div>
            <label className={LABEL}>Work email</label>
            <input name="email" type="email" required autoComplete="email" placeholder="you@henleycontracting.com" className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>Password</label>
            <input name="password" type="password" required autoComplete="current-password" className={INPUT} />
          </div>
          <button
            type="submit"
            className="w-full rounded-lg bg-accent py-2.5 text-sm font-semibold text-white transition hover:bg-accent-hover"
          >
            Sign in
          </button>
        </form>
      ) : (
        <form onSubmit={onRegister} noValidate className="mt-6 space-y-4">
          <div>
            <label className={LABEL}>Name</label>
            <input name="name" required autoComplete="name" className={INPUT} disabled={pending} />
          </div>
          <div>
            <label className={LABEL}>Work email</label>
            <input name="email" type="email" required autoComplete="email" placeholder="you@henleycontracting.com" className={INPUT} disabled={pending} />
          </div>
          <div>
            <label className={LABEL}>Password</label>
            <input name="password" type="password" required autoComplete="new-password" className={INPUT} disabled={pending} />
          </div>
          <div>
            <label className={LABEL}>Confirm password</label>
            <input name="confirm" type="password" required autoComplete="new-password" className={INPUT} disabled={pending} />
          </div>
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-accent py-2.5 text-sm font-semibold text-white transition hover:bg-accent-hover disabled:opacity-60"
          >
            {pending ? "Creating…" : "Create account"}
          </button>
          <p className="text-xs text-neutral-500">
            New accounts have no access until an administrator assigns your role.
          </p>
        </form>
      )}

      <div className="my-5 flex items-center gap-3">
        <div className="h-px flex-1 bg-neutral-200" />
        <span className="text-xs uppercase tracking-wider text-neutral-400">or</span>
        <div className="h-px flex-1 bg-neutral-200" />
      </div>

      <div className="space-y-2.5">
        <form action={startGoogleSignIn}>
          <button type="submit" className={SSO_BTN}>Continue with Google</button>
        </form>
        <form action={startMicrosoftSignIn}>
          <button type="submit" className={SSO_BTN}>Continue with Microsoft</button>
        </form>
      </div>

      <div className="mt-6 flex items-center justify-between text-sm">
        {mode === "signin" ? (
          <>
            <button type="button" onClick={() => switchMode("register")} className="font-medium text-accent hover:underline">
              Create account
            </button>
            <a href="/forgot-password" className="text-neutral-500 hover:underline">
              Forgot password?
            </a>
          </>
        ) : (
          <button type="button" onClick={() => switchMode("signin")} className="font-medium text-accent hover:underline">
            ← Back to sign in
          </button>
        )}
      </div>
    </div>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-5 flex items-start gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-700">
      <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-emerald-500" aria-hidden />
      <span>{children}</span>
    </div>
  );
}

function mapError(code?: string): string | null {
  switch (code) {
    case "rate":
      return "Too many attempts — wait a minute and try again.";
    case "invalid":
      return "That email and password combination didn't work.";
    case "google_unconfigured":
      return "Google sign-in isn't set up yet — use your email and password for now.";
    case "microsoft_unconfigured":
      return "Microsoft sign-in isn't set up yet — use your email and password for now.";
    default:
      return null;
  }
}
