// The complete set of per-endpoint scopes for the external v1 API.
// "admin" is a superscope that implies every other scope.
// Shared by apps/api (auth middleware) and apps/web (API-key manager UI).
export const SCOPES = [
  "projects:read",
  "projects:write",
  "projects:archive",
  "clients:read",
  "clients:write",
  "estimates:read",
  "estimates:write",
  "estimates:status",
  "daily-logs:read",
  "daily-logs:write",
  "time-entries:read",
  "time-entries:write",
  "time-entries:approve",
  "milestones:read",
  "milestones:write",
  "milestones:complete",
  "files:read",
  "files:write",
  "threads:read",
  "threads:write",
  "messages:read",
  "messages:write",
  "users:read",
  "admin",
] as const;

export type Scope = (typeof SCOPES)[number];

// Grouped for the Settings key-creation UI (multi-select by resource).
export const SCOPE_GROUPS: { resource: string; scopes: Scope[] }[] = [
  { resource: "projects", scopes: ["projects:read", "projects:write", "projects:archive"] },
  { resource: "clients", scopes: ["clients:read", "clients:write"] },
  { resource: "estimates", scopes: ["estimates:read", "estimates:write", "estimates:status"] },
  { resource: "daily-logs", scopes: ["daily-logs:read", "daily-logs:write"] },
  { resource: "time-entries", scopes: ["time-entries:read", "time-entries:write", "time-entries:approve"] },
  { resource: "milestones", scopes: ["milestones:read", "milestones:write", "milestones:complete"] },
  { resource: "files", scopes: ["files:read", "files:write"] },
  { resource: "threads", scopes: ["threads:read", "threads:write"] },
  { resource: "messages", scopes: ["messages:read", "messages:write"] },
  { resource: "users", scopes: ["users:read"] },
  { resource: "admin", scopes: ["admin"] },
];

export function isScope(value: string): value is Scope {
  return (SCOPES as readonly string[]).includes(value);
}

// Parse the comma-separated string stored on ApiKey.scopes into valid scopes.
export function parseScopes(stored: string): Scope[] {
  return stored
    .split(",")
    .map((s) => s.trim())
    .filter(isScope);
}

export function serializeScopes(scopes: Scope[]): string {
  return Array.from(new Set(scopes)).join(",");
}

// admin implies all; otherwise the exact required scope must be present.
export function hasScope(granted: Scope[], required: Scope): boolean {
  return granted.includes("admin") || granted.includes(required);
}
