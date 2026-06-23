import type { Request, Response, NextFunction } from "express";
import { ApiError, statusFor } from "@repo/services";

// Translates anything thrown in the pipeline into the uniform failure envelope:
//   { ok: false, error: { code, message, details? } }
// Mirrors the original failFromError behavior. Must keep the 4-arg signature so
// Express recognizes it as an error handler.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  res.setHeader("Cache-Control", "no-store");

  // Malformed JSON body from express.json().
  if (err && typeof err === "object" && (err as { type?: string }).type === "entity.parse.failed") {
    return res
      .status(400)
      .json({ ok: false, error: { code: "invalid_input", message: "Request body must be valid JSON" } });
  }

  if (err instanceof ApiError) {
    return res.status(statusFor(err.code)).json({
      ok: false,
      error: {
        code: err.code,
        message: err.message,
        ...(err.details !== undefined ? { details: err.details } : {}),
      },
    });
  }

  console.error("[api] unhandled error:", err);
  return res.status(500).json({ ok: false, error: { code: "internal", message: "Something went wrong" } });
}
