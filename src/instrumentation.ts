/**
 * Next.js instrumentation — registers the notification dispatcher interval.
 * Dev-safe: hot reloads must not stack intervals, so the handle lives on
 * globalThis and is cleared before re-registering.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const g = globalThis as typeof globalThis & { __henleyNotifyTimer?: NodeJS.Timeout };
  if (g.__henleyNotifyTimer) clearInterval(g.__henleyNotifyTimer);
  const { processQueue } = await import("@/lib/notifications/dispatch");
  g.__henleyNotifyTimer = setInterval(() => {
    processQueue().catch((err) =>
      console.error("[notify] queue sweep failed:", err instanceof Error ? err.message : err),
    );
  }, 60_000);
}
