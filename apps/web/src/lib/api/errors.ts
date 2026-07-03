import { NextResponse } from "next/server";

// Uniform error vocabulary for the v1 API. Each code maps to one HTTP status.
export type ApiErrorCode =
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "invalid_input"
  | "rate_limited"
  | "conflict"
  | "internal"
  | "not_implemented";

const STATUS: Record<ApiErrorCode, number> = {
  invalid_input: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  rate_limited: 429,
  internal: 500,
  not_implemented: 501,
};

export function statusFor(code: ApiErrorCode): number {
  return STATUS[code];
}

// Service-layer errors. Thrown by services (which are HTTP-unaware); the API
// handler translates them into the failure envelope via failFromError.
export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly details?: unknown;
  constructor(code: ApiErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.details = details;
  }
}

export class ValidationError extends ApiError {
  constructor(message = "Invalid input", details?: unknown) {
    super("invalid_input", message, details);
  }
}
export class UnauthorizedError extends ApiError {
  constructor(message = "Unauthorized", details?: unknown) {
    super("unauthorized", message, details);
  }
}
export class ForbiddenError extends ApiError {
  constructor(message = "Forbidden", details?: unknown) {
    super("forbidden", message, details);
  }
}
export class NotFoundError extends ApiError {
  constructor(message = "Not found", details?: unknown) {
    super("not_found", message, details);
  }
}
export class ConflictError extends ApiError {
  constructor(message = "Conflict", details?: unknown) {
    super("conflict", message, details);
  }
}
export class NotImplementedError extends ApiError {
  constructor(message = "Not implemented", details?: unknown) {
    super("not_implemented", message, details);
  }
}

const NO_STORE: Record<string, string> = { "Cache-Control": "no-store" };

// Success envelope: { ok: true, data }
export function ok<T>(
  data: T,
  init?: { status?: number; headers?: Record<string, string> }
): NextResponse {
  return NextResponse.json(
    { ok: true, data },
    { status: init?.status ?? 200, headers: { ...NO_STORE, ...(init?.headers ?? {}) } }
  );
}

// Failure envelope: { ok: false, error: { code, message, details? } }
export function fail(
  code: ApiErrorCode,
  message: string,
  details?: unknown,
  headers?: Record<string, string>
): NextResponse {
  return NextResponse.json(
    { ok: false, error: { code, message, ...(details !== undefined ? { details } : {}) } },
    { status: STATUS[code], headers: { ...NO_STORE, ...(headers ?? {}) } }
  );
}

// Translate any thrown value into the uniform failure response.
export function failFromError(err: unknown): NextResponse {
  if (err instanceof ApiError) {
    return fail(err.code, err.message, err.details);
  }
  console.error("[api] unhandled error:", err);
  return fail("internal", "Something went wrong");
}
