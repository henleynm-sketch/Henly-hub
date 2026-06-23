// QBO extraction placeholder — DELIBERATELY a no-op.
//
// The real QuickBooks logic (quickbooks.ts, pushTimeActivity.ts) is on the
// HENLEY_HUB_CONTEXT.md do-not-touch guardrail list and stays inside apps/web
// until the QBO sandbox round-trip test passes. apps/web/timeActions.ts still
// imports the QBO push directly from its original location; nothing in the API
// path calls QBO (API approve sets approved+qbReady but does NOT push).
//
// When the sandbox test passes, lift quickbooks.ts + pushTimeActivity.ts into
// this package and re-export them here, then point apps/web at @repo/services.
export const QBO_EXTRACTION_PENDING = true;
