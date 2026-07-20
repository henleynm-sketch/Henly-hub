/**
 * Next.js instrumentation.
 *
 * register()       — starts the notification dispatcher interval and registers a
 *                    process-level unhandled-rejection handler (diagnostics).
 * onRequestError() — Next 15 hook: fires for errors thrown in server actions,
 *                    RSC render, and route handlers. Funnels them to the
 *                    diagnostics logger (which redacts) as an ErrorLog row.
 *
 * Both are Node-runtime only and fully guarded — diagnostics must never take
 * down the request or the process.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const g = globalThis as typeof globalThis & {
    __henleyNotifyTimer?: NodeJS.Timeout;
    __henleyDiagRejection?: boolean;
  };

  if (g.__henleyNotifyTimer) clearInterval(g.__henleyNotifyTimer);
  const { processQueue } = await import("@/lib/notifications/dispatch");
  g.__henleyNotifyTimer = setInterval(() => {
    processQueue().catch((err) =>
      console.error("[notify] queue sweep failed:", err instanceof Error ? err.message : err),
    );
  }, 60_000);

  // Register once — hot reloads re-run register(), so guard on globalThis.
  if (!g.__henleyDiagRejection) {
    g.__henleyDiagRejection = true;
    process.on("unhandledRejection", (reason) => {
      import("@/lib/diagnostics")
        .then(({ logError, errorParts }) => {
          const { message, stack } = errorParts(reason);
          return logError({
            level: "error",
            source: "server-action",
            message: `Unhandled promise rejection: ${message}`,
            stack,
            context: { kind: "unhandledRejection" },
          });
        })
        .catch(() => {});
    });
  }
}

// Next passes (error, request, context). Types are kept loose so this stays
// valid across minor Next revisions; we only read a few fields.
export async function onRequestError(
  error: unknown,
  request: { path?: string; method?: string },
  context: { routerKind?: string; routePath?: string; renderSource?: string; revalidateReason?: string },
) {
  try {
    if (process.env.NEXT_RUNTIME !== "nodejs") return;
    const { logError, errorParts } = await import("@/lib/diagnostics");
    const { message, stack } = errorParts(error);
    const path = typeof request?.path === "string" ? request.path : undefined;
    const isApi = !!path && path.startsWith("/api/");
    await logError({
      level: "error",
      source: isApi ? "api" : "server-action",
      message,
      stack,
      route: path ? `${request?.method ?? ""} ${path}`.trim() : undefined,
      context: {
        routerKind: context?.routerKind,
        routePath: context?.routePath,
        renderSource: context?.renderSource,
        revalidateReason: context?.revalidateReason,
      },
    });
  } catch {
    /* diagnostics must never break a request */
  }
}
