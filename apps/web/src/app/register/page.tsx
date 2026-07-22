"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { registerUser } from "@/lib/actions/auth";

// Functional self-service registration. Agent B restyles this into the branded
// split-screen; the wiring (validation + registerUser action) stays.
export default function RegisterPage() {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
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
      // On success the action signs in and redirects to /pending; only failures
      // return a value here.
      if (res && !res.ok) setError(res.error ?? "Registration failed.");
    });
  }

  return (
    <div className="min-h-screen grid place-items-center p-6">
      <div className="hh-panel w-full max-w-sm p-7 flex flex-col gap-4">
        <div className="flex flex-col items-center gap-2 pb-1">
          <div className="hh-brand-logo" role="img" aria-label="Henley Contracting" />
          <h1 className="hh-display text-lg font-bold text-ink">Create your account</h1>
          <p className="hh-caption text-center">Request access to Henley Hub.</p>
        </div>

        {error && (
          <div className="flex items-start gap-2">
            <span className="hh-dot hh-dot--red mt-1" />
            <span className="hh-secondary">{error}</span>
          </div>
        )}

        <form onSubmit={onSubmit} className="flex flex-col gap-3" noValidate>
          <div>
            <label className="hh-label block mb-1.5">Name</label>
            <input name="name" className="input" autoComplete="name" required disabled={pending} />
          </div>
          <div>
            <label className="hh-label block mb-1.5">Work email</label>
            <input
              name="email"
              type="email"
              className="input"
              autoComplete="email"
              placeholder="you@henleycontracting.com"
              required
              disabled={pending}
            />
          </div>
          <div>
            <label className="hh-label block mb-1.5">Password</label>
            <input
              name="password"
              type="password"
              className="input"
              autoComplete="new-password"
              required
              disabled={pending}
            />
          </div>
          <div>
            <label className="hh-label block mb-1.5">Confirm password</label>
            <input
              name="confirm"
              type="password"
              className="input"
              autoComplete="new-password"
              required
              disabled={pending}
            />
          </div>
          <button className="btn-primary w-full" type="submit" disabled={pending}>
            {pending ? "Creating…" : "Create account"}
          </button>
        </form>

        <p className="hh-caption">
          New accounts have no access until an administrator assigns your role.
        </p>
        <div className="flex items-center justify-between">
          <Link href="/sign-in" className="hh-secondary text-sm hover:underline">
            Sign in instead
          </Link>
          <Link href="/forgot-password" className="hh-secondary text-sm hover:underline">
            Forgot password?
          </Link>
        </div>
      </div>
    </div>
  );
}
