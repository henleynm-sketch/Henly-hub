// Transport-agnostic error vocabulary for the service layer. Services throw
// these; the HTTP layer (apps/api Express, or apps/web actions) maps them to
// responses. No next/server or express imports here — keep it portable.
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
