import "server-only";
import { NextResponse } from "next/server";
import type { ApiKey } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { type Scope } from "./scopes";
import { requireScope, isAuthFailure } from "./auth";
import { rateLimit, rateKindForMethod } from "./rateLimit";
import { readIdempotencyKey, getIdempotent, setIdempotent } from "./idempotency";
import { ValidationError, fail, failFromError } from "./errors";

// A handler returns plain data (wrapped in the success envelope), optionally
// with a custom status, or a Response it built itself (escape hatch).
export type ApiResult = { data: unknown; status?: number } | Response;

export type ApiCtx<P extends Record<string, string> = Record<string, string>> = {
  apiKey: ApiKey;
  scopes: Scope[];
  req: Request;
  url: URL;
  params: P;
  body: () => Promise<unknown>;
};

type NextRouteCtx<P> = { params: Promise<P> };

// Fire-and-forget call log; never blocks or fails the response.
function logCall(
  apiKeyId: string | null,
  method: string,
  path: string,
  status: number,
  scopeUsed: string | null,
  idempotencyKey: string | null,
  durationMs: number
): void {
  prisma.apiCallLog
    .create({
      data: {
        apiKeyId: apiKeyId ?? undefined,
        method,
        path,
        status,
        scopeUsed: scopeUsed ?? undefined,
        idempotencyKey: idempotencyKey ?? undefined,
        durationMs,
      },
    })
    .catch(() => {});
}

// Wrap a v1 route: auth + scope, rate limit, idempotency (writes), input via
// ctx.body(), uniform error translation, and ApiCallLog. Routes stay thin.
export function apiRoute<P extends Record<string, string> = Record<string, string>>(
  scope: Scope,
  fn: (ctx: ApiCtx<P>) => Promise<ApiResult>
) {
  return async (req: Request, nextCtx: NextRouteCtx<P>): Promise<Response> => {
    const start = Date.now();
    const method = req.method.toUpperCase();
    const url = new URL(req.url);
    const path = url.pathname;

    const auth = await requireScope(req, scope);
    if (isAuthFailure(auth)) {
      logCall(null, method, path, auth.status, scope, null, Date.now() - start);
      return auth;
    }
    const { apiKey, scopes } = auth;

    const rl = rateLimit(apiKey.id, rateKindForMethod(method));
    if (!rl.ok) {
      const res = fail("rate_limited", "Rate limit exceeded", undefined, {
        "Retry-After": String(rl.retryAfterSec),
      });
      logCall(apiKey.id, method, path, res.status, scope, null, Date.now() - start);
      return res;
    }

    const idemKey = method === "GET" ? null : readIdempotencyKey(req);
    if (idemKey) {
      const cached = getIdempotent(apiKey.id, idemKey);
      if (cached) {
        logCall(apiKey.id, method, path, cached.status, scope, idemKey, Date.now() - start);
        return NextResponse.json(cached.body, {
          status: cached.status,
          headers: { "Cache-Control": "no-store", "Idempotency-Replayed": "true" },
        });
      }
    }

    try {
      const params = ((await nextCtx?.params) ?? {}) as P;
      const body = async () => {
        try {
          return await req.json();
        } catch {
          throw new ValidationError("Request body must be valid JSON");
        }
      };

      const result = await fn({ apiKey, scopes, req, url, params, body });

      if (result instanceof Response) {
        logCall(apiKey.id, method, path, result.status, scope, idemKey, Date.now() - start);
        return result;
      }

      const status = result.status ?? 200;
      const envelope = { ok: true, data: result.data };
      // Only cache successful responses for idempotent replay.
      if (idemKey && status >= 200 && status < 300) {
        setIdempotent(apiKey.id, idemKey, status, envelope);
      }
      logCall(apiKey.id, method, path, status, scope, idemKey, Date.now() - start);
      return NextResponse.json(envelope, { status, headers: { "Cache-Control": "no-store" } });
    } catch (err) {
      const res = failFromError(err);
      logCall(apiKey.id, method, path, res.status, scope, idemKey, Date.now() - start);
      return res;
    }
  };
}
