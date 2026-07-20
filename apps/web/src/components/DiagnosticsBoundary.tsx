"use client";

import { Component, type ReactNode } from "react";
import { logClientError } from "@/lib/actions/diagnostics";

type Props = { children: ReactNode };
type State = { hasError: boolean };

// Catches render/runtime errors from the app tree below it, funnels them to the
// diagnostics logger, and shows a calm branded fallback instead of a raw stack.
export default class DiagnosticsBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: { componentStack?: string }) {
    try {
      const route = typeof window !== "undefined" ? window.location.pathname : undefined;
      // Fire-and-forget; the server action redacts and never rejects.
      void logClientError({
        message: error?.message || "Client render error",
        stack: error?.stack || info?.componentStack || undefined,
        route,
      });
    } catch {
      /* logging must never mask the original error */
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="grid min-h-[60vh] place-items-center p-6">
        <div className="hh-panel max-w-md p-6 text-center">
          <div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-full bg-rose-500/10 text-rose-400 text-lg font-bold">
            !
          </div>
          <h2 className="text-lg font-semibold text-ink">Something went wrong</h2>
          <p className="mt-1 text-sm text-ink-soft">
            This screen hit an error and couldn&apos;t finish loading. The issue has been logged for
            the team.
          </p>
          <button
            type="button"
            onClick={() => {
              if (typeof window !== "undefined") window.location.reload();
            }}
            className="btn-primary mt-4"
          >
            Reload
          </button>
        </div>
      </div>
    );
  }
}
