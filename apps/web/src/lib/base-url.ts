import "server-only";

// Canonical, externally-reachable origin for absolute URLs the app hands to
// third parties — OAuth 2.1 discovery metadata, MCP protected-resource pointers,
// email links. These must NOT be derived from the incoming request: behind the
// nginx proxy `req.nextUrl.origin` resolves to the internal address
// (https://localhost:3000), which then leaks into client-facing URLs and breaks
// OAuth client registration and MCP connection.
const PINNED = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");

export function canonicalOrigin(requestOrigin?: string): string {
  if (PINNED) return PINNED;
  // Never emit an internal origin in production, even if the env var is missing.
  if (process.env.NODE_ENV === "production") return "https://henleyhub.cloud";
  // Dev / preview: the request origin (localhost) is correct and convenient.
  return (requestOrigin ?? "http://localhost:3000").replace(/\/$/, "");
}
