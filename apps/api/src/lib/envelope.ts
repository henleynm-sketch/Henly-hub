// Success envelope: { ok: true, data, ...meta }. Mirrors the shape the original
// Next v1 routes produced via apiRoute. The failure envelope is built by the
// errorHandler middleware from thrown ApiError instances.
export function ok<T>(data: T, meta?: Record<string, unknown>) {
  return { ok: true as const, data, ...(meta ?? {}) };
}
