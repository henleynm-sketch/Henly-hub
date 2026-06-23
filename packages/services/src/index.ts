// Shared business-logic + API primitives for the whole monorepo.
// apps/web (server actions, RSC) and apps/api (Express) both import from here.

// Resource services
export * from "./projectService";
export * from "./clientService";
export * from "./estimateService";
export * from "./dailyLogService";
export * from "./timeEntryService";
export * from "./milestoneService";
export * from "./fileService";
export * from "./threadService";
export * from "./userService";
export * from "./qboService";

// Cross-cutting primitives
export * from "./errors";
export * from "./scopes";
export * from "./pagination";
