"use server";

import { signIn } from "@/auth";
import { redirect } from "next/navigation";

// SSO button handlers. If the provider's credentials aren't in .env yet, we
// redirect back to sign-in with a clear notice instead of throwing — the button
// always renders and "fails cleanly" (per the brief). On success, signIn()
// redirects to the provider's consent screen.
export async function startGoogleSignIn(): Promise<void> {
  if (!(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET)) {
    redirect("/?error=google_unconfigured");
  }
  await signIn("google", { redirectTo: "/dashboard" });
}

export async function startMicrosoftSignIn(): Promise<void> {
  if (!(process.env.AUTH_MICROSOFT_ENTRA_ID_ID && process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET)) {
    redirect("/?error=microsoft_unconfigured");
  }
  await signIn("microsoft-entra-id", { redirectTo: "/dashboard" });
}
