"use server";

import { auth } from "@/auth";
import { logError } from "@/lib/diagnostics";

// Minimal server action the client error boundary posts to. It only forwards a
// message/stack/route into logError (which redacts). Not role-gated: any signed
// -in user whose screen crashes should have that crash captured. The write is
// still redacted and best-effort — it never throws back to the client.
export async function logClientError(input: {
  message: string;
  stack?: string;
  route?: string;
  context?: unknown;
}): Promise<void> {
  let userId: string | null = null;
  try {
    const session = await auth();
    userId = session?.user?.id ?? null;
  } catch {
    /* unauthenticated crash — still worth logging */
  }

  await logError({
    level: "error",
    source: "client",
    message: input?.message || "Client render error",
    stack: input?.stack ?? null,
    route: input?.route ?? null,
    userId,
    context: input?.context,
  });
}
