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
