export const ROLES = ["CEO", "OFFICE", "FIELD", "SUB", "CLIENT"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  CEO: "CEO / Owner",
  OFFICE: "Office / Admin",
  FIELD: "Field Crew",
  SUB: "Subcontractor",
  CLIENT: "Client",
};

export function isInternal(role: Role) {
  return role === "CEO" || role === "OFFICE" || role === "FIELD";
}

export function canSeeFinancials(role: Role) {
  return role === "CEO" || role === "OFFICE";
}

export function canManageTeam(role: Role) {
  return role === "CEO";
}

export function canViewAllProjects(role: Role) {
  return role === "CEO" || role === "OFFICE";
}

// A self-registered account (email/password or SSO) holds PENDING until the CEO
// assigns a real role. PENDING — and any empty or unrecognized value — grants
// zero access anywhere; every permission helper above already returns false for
// it, and the middleware + app shell hold such users on the waiting screen.
export const PENDING_ROLE = "PENDING";

export function hasAppAccess(role: string | null | undefined): boolean {
  return !!role && (ROLES as readonly string[]).includes(role);
}

export function isPending(role: string | null | undefined): boolean {
  return !hasAppAccess(role);
}

// Display label that also covers the PENDING / no-access state.
export function roleLabel(role: string): string {
  return (ROLE_LABELS as Record<string, string>)[role] ?? "Pending — no access";
}
