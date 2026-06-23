import { SCOPES } from "@repo/services";
import { env } from "@repo/env";

// Hand-generated OpenAPI 3.1 spec for the v1 API. Ported verbatim from the
// original Next route (no zod-to-openapi dependency). The only change vs the
// Next version: `servers` points at API_ORIGIN so Swagger "Try it out" targets
// the Express host (:3001), not the page origin (:3000).

type Json = Record<string, unknown>;

const errorEnvelope = {
  type: "object",
  required: ["ok", "error"],
  properties: {
    ok: { const: false },
    error: {
      type: "object",
      required: ["code", "message"],
      properties: {
        code: {
          type: "string",
          enum: [
            "unauthorized",
            "forbidden",
            "not_found",
            "invalid_input",
            "rate_limited",
            "conflict",
            "internal",
            "not_implemented",
          ],
        },
        message: { type: "string" },
        details: { type: "object" },
      },
    },
  },
} as const;

function dataEnvelope(data: Json): Json {
  return { type: "object", required: ["ok", "data"], properties: { ok: { const: true }, data } };
}
function listEnvelope(item: Json): Json {
  return {
    type: "object",
    required: ["ok", "data"],
    properties: {
      ok: { const: true },
      data: { type: "array", items: item },
      nextCursor: { type: ["string", "null"] },
    },
  };
}

const idParam = { name: "id", in: "path", required: true, schema: { type: "string" } };
const paginationParams = [
  { name: "limit", in: "query", required: false, schema: { type: "integer", minimum: 1, maximum: 100, default: 25 } },
  { name: "cursor", in: "query", required: false, schema: { type: "string" } },
];

const ERRORS = (scoped: boolean): Json => {
  const base: Json = {
    "400": err("Invalid input"),
    "404": err("Not found"),
    "429": err("Rate limit exceeded (Retry-After header)"),
    "500": err("Server error"),
  };
  if (scoped) {
    base["401"] = err("Missing or invalid key");
    base["403"] = err("Key missing the required scope");
  }
  return base;
};
function err(description: string): Json {
  return { description, content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } } };
}

function op(args: {
  tag: string;
  summary: string;
  scope: string | null;
  params?: Json[];
  body?: Json;
  successStatus: string;
  success: Json;
  description?: string;
}): Json {
  const responses: Json = {
    [args.successStatus]: { description: "Success", content: { "application/json": { schema: args.success } } },
    ...ERRORS(Boolean(args.scope)),
  };
  const desc =
    args.description ?? (args.scope ? `Required scope: \`${args.scope}\`` : "No authentication required.");
  return {
    tags: [args.tag],
    summary: args.summary,
    description: desc,
    ...(args.scope ? { security: [{ bearerAuth: [] }] } : {}),
    ...(args.params ? { parameters: args.params } : {}),
    ...(args.body
      ? { requestBody: { required: true, content: { "application/json": { schema: args.body } } } }
      : {}),
    responses,
  };
}

const obj = (props: Json, required: string[] = []): Json => ({ type: "object", properties: props, required });
const str = { type: "string" };
const strNull = { type: ["string", "null"] };
const int = { type: "integer" };
const bool = { type: "boolean" };
const genericObject = { type: "object", additionalProperties: true };

export function buildSpec() {
  return {
    openapi: "3.1.0",
    info: {
      title: "Henley Hub API",
      version: "v1",
      description:
        "External HTTP API for Henley Hub. Authenticate with a per-consumer key as a bearer token. " +
        "Scopes gate what an application can do; see the scope list in components. The file upload " +
        "endpoint registers metadata only — binary storage is not yet wired.",
    },
    servers: [{ url: env.API_ORIGIN, description: "Henley Hub API" }],
    security: [{ bearerAuth: [] }],
    tags: [
      "projects",
      "clients",
      "estimates",
      "daily-logs",
      "time-entries",
      "milestones",
      "files",
      "threads",
      "messages",
      "users",
      "system",
    ].map((name) => ({ name })),
    components: {
      securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", description: "Authorization: Bearer <key>" } },
      schemas: {
        ErrorEnvelope: errorEnvelope as unknown as Json,
        Scopes: { type: "string", enum: [...SCOPES], description: "All available scopes. `admin` implies every scope." },
      },
    },
    paths: {
      "/api/v1/health": {
        get: op({
          tag: "system",
          summary: "Service health (no auth)",
          scope: null,
          successStatus: "200",
          success: dataEnvelope(obj({ service: str, version: str, time: str }, ["service", "version", "time"])),
        }),
      },

      "/api/v1/projects": {
        get: op({ tag: "projects", summary: "List projects", scope: "projects:read", params: paginationParams, successStatus: "200", success: listEnvelope(genericObject) }),
        post: op({
          tag: "projects",
          summary: "Create a project",
          scope: "projects:write",
          successStatus: "201",
          success: dataEnvelope(genericObject),
          body: obj(
            { name: str, clientId: str, address: strNull, contractCents: int, budgetCents: int, description: strNull, status: str },
            ["name", "clientId"]
          ),
        }),
      },
      "/api/v1/projects/{id}": {
        get: op({ tag: "projects", summary: "Get a project", scope: "projects:read", params: [idParam], successStatus: "200", success: dataEnvelope(genericObject) }),
        patch: op({
          tag: "projects",
          summary: "Update a project",
          scope: "projects:write",
          params: [idParam],
          successStatus: "200",
          success: dataEnvelope(genericObject),
          body: obj({ name: str, address: strNull, city: strNull, status: str, currentPhase: strNull, nextStep: strNull, team: strNull, contractCents: int, budgetCents: int, description: strNull }),
        }),
      },
      "/api/v1/projects/{id}/archive": {
        post: op({ tag: "projects", summary: "Archive a project (soft)", scope: "projects:archive", params: [idParam], successStatus: "200", success: dataEnvelope(genericObject) }),
      },
      "/api/v1/projects/{id}/daily-logs": {
        get: op({ tag: "daily-logs", summary: "List a project's daily logs", scope: "daily-logs:read", params: [idParam, ...paginationParams], successStatus: "200", success: listEnvelope(genericObject) }),
      },
      "/api/v1/projects/{id}/milestones": {
        get: op({ tag: "milestones", summary: "List a project's milestones", scope: "milestones:read", params: [idParam], successStatus: "200", success: dataEnvelope({ type: "array", items: genericObject }) }),
      },
      "/api/v1/projects/{id}/files": {
        get: op({ tag: "files", summary: "List a project's files", scope: "files:read", params: [idParam], successStatus: "200", success: dataEnvelope({ type: "array", items: genericObject }) }),
      },

      "/api/v1/clients": {
        get: op({ tag: "clients", summary: "List clients", scope: "clients:read", params: paginationParams, successStatus: "200", success: listEnvelope(genericObject) }),
        post: op({
          tag: "clients",
          summary: "Create a client",
          scope: "clients:write",
          successStatus: "201",
          success: dataEnvelope(genericObject),
          body: obj({ name: str, primaryEmail: strNull, primaryPhone: strNull, address: strNull, city: strNull, state: strNull, zip: strNull, source: strNull, stage: str, notes: strNull }, ["name"]),
        }),
      },
      "/api/v1/clients/{id}": {
        get: op({ tag: "clients", summary: "Get a client", scope: "clients:read", params: [idParam], successStatus: "200", success: dataEnvelope(genericObject) }),
        patch: op({ tag: "clients", summary: "Update a client", scope: "clients:write", params: [idParam], successStatus: "200", success: dataEnvelope(genericObject), body: obj({ name: str, primaryEmail: strNull, primaryPhone: strNull, address: strNull, city: strNull, state: strNull, zip: strNull, source: strNull, stage: str, notes: strNull }) }),
      },

      "/api/v1/estimates": {
        get: op({ tag: "estimates", summary: "List estimates", scope: "estimates:read", params: paginationParams, successStatus: "200", success: listEnvelope(genericObject) }),
        post: op({
          tag: "estimates",
          summary: "Create an estimate",
          scope: "estimates:write",
          successStatus: "201",
          success: dataEnvelope(genericObject),
          body: obj(
            {
              clientId: str,
              authorId: str,
              title: str,
              notes: strNull,
              taxRate: { type: "number" },
              lines: { type: "array", items: obj({ category: strNull, description: str, quantity: { type: "number" }, unitCents: int }, ["description", "quantity", "unitCents"]) },
            },
            ["clientId", "authorId", "title"]
          ),
        }),
      },
      "/api/v1/estimates/{id}": {
        get: op({ tag: "estimates", summary: "Get an estimate", scope: "estimates:read", params: [idParam], successStatus: "200", success: dataEnvelope(genericObject) }),
        patch: op({ tag: "estimates", summary: "Update an estimate", scope: "estimates:write", params: [idParam], successStatus: "200", success: dataEnvelope(genericObject), body: obj({ title: str, notes: strNull }) }),
      },
      "/api/v1/estimates/{id}/status": {
        post: op({ tag: "estimates", summary: "Set estimate status", scope: "estimates:status", params: [idParam], successStatus: "200", success: dataEnvelope(genericObject), body: obj({ status: { type: "string", enum: ["DRAFT", "SENT", "ACCEPTED", "DECLINED"] } }, ["status"]) }),
      },

      "/api/v1/daily-logs": {
        post: op({ tag: "daily-logs", summary: "Create a daily log", scope: "daily-logs:write", successStatus: "201", success: dataEnvelope(genericObject), body: obj({ projectId: str, authorId: str, notes: str, weather: strNull, crewOnSite: strNull, hoursWorked: { type: ["number", "null"] }, clientVisible: bool, photos: { type: "array", items: str } }, ["projectId", "authorId", "notes"]) }),
      },
      "/api/v1/daily-logs/{id}": {
        get: op({ tag: "daily-logs", summary: "Get a daily log", scope: "daily-logs:read", params: [idParam], successStatus: "200", success: dataEnvelope(genericObject) }),
      },

      "/api/v1/time-entries": {
        get: op({
          tag: "time-entries",
          summary: "List time entries",
          scope: "time-entries:read",
          params: [
            ...paginationParams,
            { name: "projectId", in: "query", required: false, schema: str },
            { name: "userId", in: "query", required: false, schema: str },
            { name: "approved", in: "query", required: false, schema: bool },
          ],
          successStatus: "200",
          success: listEnvelope(genericObject),
        }),
        post: op({ tag: "time-entries", summary: "Create a time entry", scope: "time-entries:write", successStatus: "201", success: dataEnvelope(genericObject), body: obj({ userId: str, projectId: str, costCode: str, clockIn: str, clockOut: strNull, hours: { type: ["number", "null"] } }, ["userId", "projectId", "costCode"]) }),
      },
      "/api/v1/time-entries/{id}/approve": {
        post: op({
          tag: "time-entries",
          summary: "Approve a time entry",
          scope: "time-entries:approve",
          params: [idParam],
          successStatus: "200",
          success: dataEnvelope(genericObject),
          description:
            "Required scope: `time-entries:approve`. Approves the entry (sets approved + qbReady). " +
            "The QuickBooks push is NOT invoked from the API in v1 — the in-app approve flow continues " +
            "to push via pushTimeActivity. External consumers must not assume API-approve = QBO-pushed.",
        }),
      },

      "/api/v1/milestones": {
        post: op({ tag: "milestones", summary: "Create a milestone", scope: "milestones:write", successStatus: "201", success: dataEnvelope(genericObject), body: obj({ projectId: str, title: str, description: strNull, dueDate: strNull, clientVisible: bool, order: int }, ["projectId", "title"]) }),
      },
      "/api/v1/milestones/{id}/complete": {
        post: op({ tag: "milestones", summary: "Complete a milestone", scope: "milestones:complete", params: [idParam], successStatus: "200", success: dataEnvelope(genericObject) }),
      },

      "/api/v1/files": {
        post: op({
          tag: "files",
          summary: "Register file metadata (no binary storage yet)",
          scope: "files:write",
          successStatus: "201",
          success: dataEnvelope(obj({ storageStatus: { type: "string", enum: ["pending_no_backend"] } })),
          body: obj({ projectId: str, kind: { type: "string", enum: ["CONTRACT", "PLAN", "PERMIT", "INVOICE", "PHOTO", "OTHER"] }, name: str, sizeBytes: int, mimeType: strNull, visibleToClient: bool }, ["projectId", "kind", "name"]),
        }),
      },
      "/api/v1/files/{id}": {
        get: op({ tag: "files", summary: "Get a file", scope: "files:read", params: [idParam], successStatus: "200", success: dataEnvelope(genericObject) }),
      },

      "/api/v1/threads": {
        get: op({
          tag: "threads",
          summary: "List threads",
          scope: "threads:read",
          params: [...paginationParams, { name: "clientId", in: "query", required: false, schema: str }, { name: "channel", in: "query", required: false, schema: str }],
          successStatus: "200",
          success: listEnvelope(genericObject),
        }),
      },
      "/api/v1/threads/{id}/messages": {
        get: op({ tag: "messages", summary: "List a thread's messages", scope: "messages:read", params: [idParam, ...paginationParams], successStatus: "200", success: listEnvelope(genericObject) }),
      },
      "/api/v1/messages": {
        post: op({ tag: "messages", summary: "Create a message on a thread", scope: "messages:write", successStatus: "201", success: dataEnvelope(genericObject), body: obj({ threadId: str, body: str, authorId: strNull, fromName: str, direction: { type: "string", enum: ["IN", "OUT"] }, channel: str }, ["threadId", "body"]) }),
      },

      "/api/v1/users": {
        get: op({ tag: "users", summary: "List users (no password hashes)", scope: "users:read", params: paginationParams, successStatus: "200", success: listEnvelope(genericObject) }),
      },
      "/api/v1/users/{id}": {
        get: op({ tag: "users", summary: "Get a user", scope: "users:read", params: [idParam], successStatus: "200", success: dataEnvelope(genericObject) }),
      },
    },
  };
}
