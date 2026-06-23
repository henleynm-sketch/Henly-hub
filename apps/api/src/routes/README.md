# apps/api route pattern

Every v1 endpoint was ported 1:1 from the old Next.js `app/api/v1/**/route.ts`
files into Express routers here. The translation is mechanical and uniform.

## The pattern

Old (Next, `apiRoute` wrapper carried auth + rate limit + idempotency + logging
+ envelope + error translation):

```ts
export const GET = apiRoute("projects:read", async ({ url }) => {
  const { items, nextCursor } = await listProjects(parsePagination(url));
  return { data: items, meta: { nextCursor } };
});
```

New (Express, the same cross-cutting concerns are middleware):

```ts
projectsRouter.get(
  "/",
  requireScope("projects:read"), // auth + scope (throws ApiError on failure)
  rateLimit,                     // per-key token bucket (60 read / 20 write per min)
  /* idempotency, */             // writes only: Idempotency-Key replay
  asyncHandler(async (req, res) => {
    const { items, nextCursor } = await listProjects(parsePagination(reqUrl(req)));
    res.json(ok(items, { nextCursor })); // { ok:true, data:items, nextCursor }
  })
);
```

## Rules

- **Reads**: `requireScope(scope), rateLimit, asyncHandler(...)`.
- **Writes** (POST/PATCH): add `idempotency` after `rateLimit`.
- Build the success body with `ok(data, meta?)` → `{ ok: true, data, ...meta }`.
- Never build error responses by hand — `throw` a typed error from
  `@repo/services` (`NotFoundError`, `ValidationError`, `ConflictError`, ...);
  `errorHandler` maps it to the `{ ok:false, error:{ code, message, details? } }`
  envelope with the right status.
- Validate bodies with `parseBody(schema, req.body)`; read query/pagination with
  `parsePagination(reqUrl(req))`.
- `Cache-Control: no-store` is set globally for `/api/v1` in `app.ts`.
- Request logging (`ApiCallLog`) is global via `callLogger` in `app.ts`.

## Behavior parity vs the old Next routes

Same status codes, same `{ ok, ... }` envelopes, same scopes, same rate limits
(60 read / 20 write per key per minute), same idempotency semantics
(`Idempotency-Key` request header → `Idempotency-Replayed: true` on replay,
10-minute in-memory window), same `429` with `Retry-After`. Only the host/port
changes: the API now lives on `:3001` instead of being mounted in Next on `:3000`.
