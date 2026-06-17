import "server-only";

// Service-layer entry point for the existing QuickBooks surface. The underlying
// implementations in src/lib/quickbooks.ts and the time-activity pusher are NOT
// modified (guardrail) — this only re-exports them so future code imports QBO
// through src/lib/services like every other resource.
export { pushTimeActivityToQBO } from "@/app/(app)/integrations/quickbooks/pushTimeActivity";
export * from "@/lib/quickbooks";
