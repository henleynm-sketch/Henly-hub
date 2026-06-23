import type { Request, Response, NextFunction, RequestHandler } from "express";

// Wrap an async route handler so rejected promises reach the Express error
// handler instead of hanging the request.
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Build a WHATWG URL from the request so service helpers (parsePagination) can
// read query params the same way they did from the Next Request.url.
export function reqUrl(req: Request): URL {
  return new URL(req.originalUrl, "http://localhost");
}
