# Henley Hub external API (v1)

A versioned HTTP API at `/api/v1`, separate from Hub's internal server actions.
Both surfaces call the shared services in `src/lib/services/`, so business logic
lives in one place.

## Authentication

Send a per-consumer key as a bearer token:

```
Authorization: Bearer <key>
```

Keys are created and managed in **Settings → API keys** (CEO only). The full key
is shown once at creation and never again — only its sha256 hash is stored.
`GET /api/v1/health` is the one unauthenticated endpoint.

## Scopes vs. permissions

These are two different things:

- **Scopes** gate *what an external application can do*. Each endpoint requires
  one scope (e.g. `clients:write`). A key carries a fixed set of scopes. The
  `admin` scope is a superscope that implies all others.
- **Hub roles** (CEO / OFFICE / FIELD / SUB / CLIENT) gate *what humans can do in
  the UI*. They are enforced inside the service layer for the web app, not at the
  API edge.

A key with `time-entries:approve` can approve any time entry the service permits.
It is operating as a **system user**, not impersonating a human role. Writes that
record an actor (e.g. time-entry approval) store `null` for the human actor.

## Response envelope

Success:

```json
{ "ok": true, "data": ... }
```

List endpoints add a top-level cursor:

```json
{ "ok": true, "data": [ ... ], "nextCursor": "<id|null>" }
```

Failure:

```json
{ "ok": false, "error": { "code": "...", "message": "...", "details": { } } }
```

Codes → HTTP status: `invalid_input` 400, `unauthorized` 401, `forbidden` 403,
`not_found` 404, `conflict` 409, `rate_limited` 429, `internal` 500,
`not_implemented` 501.

## Rate limits

Per key, in-memory token bucket: **60 reads/min**, **20 writes/min**. Exceeding
returns `429` with a `Retry-After` header (seconds). Single-instance only for
now (see the TODO in `rateLimit.ts`).

## Idempotency

Send `Idempotency-Key: <unique>` on a write (POST/PATCH/DELETE). The first call
executes and its response is cached for 10 minutes; repeats with the same key
replay the original response (with `Idempotency-Replayed: true`) without
re-executing. The cache is in-process; the key is also recorded on `ApiCallLog`.

## Pagination

List endpoints accept `?limit=<1..100, default 25>&cursor=<opaque id>`. Use the
returned `nextCursor` as the next `cursor`; `null` means the last page.

## File uploads — storage gap

`POST /api/v1/files` registers **metadata only**. There is no cloud storage
backend yet, so it creates a `Document` row with `url=""` and `pending=true` and
responds `201` with `storageStatus: "pending_no_backend"`. The binary is not
stored anywhere. When storage is configured, a `PUT /api/v1/files/[id]/content`
endpoint will accept the binary.

## Call logging

Every request writes an `ApiCallLog` row (method, path, status, scope, duration,
idempotency key). These surface in Settings → API keys → a key's Activity tab.

## Legacy Door 1

`/api/external/projects` and `/api/external/health` are the older one-way feed
for Henley Tasks, authenticated by the single `HUB_TASKS_API_KEY`. They are
independent of v1 and remain unchanged.
