# B1 monorepo restructure — execution runbook

This is the half of Brief B1 that requires `git`, `npm`, `tsc`, a dev server,
`curl`, and a browser — none of which Cowork can run. Cowork authored all the
**new** files (the skeleton, `packages/*`, the full `apps/api` Express service,
and the two new `apps/web` config files). Everything below — moves, deletions,
in-place edits, installs, commits, and verification — is yours to run. Nothing
is "shipped" until its commit is in `git log` and `tsc`/`curl` pass (per
HENLEY_HUB_CONTEXT.md §7/§10).

- **Working branch:** `claude/henley-hub-platform-2wIAN`
- **Safety anchor / checkpoint:** `36c13ec` ("checkpoint before monorepo
  restructure"). Reference `checkpoint: 36c13ec` in every commit body.
- **Guardrails honored by design:** no QBO/Door-1 file is modified. The three
  untouchable QBO files and Door 1 import only `@/lib/prisma`, which becomes a
  one-line re-export of `@repo/db`, so they keep working untouched.

> Cowork wrote new files into the working tree already. They are all **untracked**,
> so `git stash -u` cleanly shelves them for a pristine preflight (Step P).

---

## What Cowork already authored (new, untracked — do not recreate)

```
turbo.json
tsconfig.base.json
packages/typescript-config/{package.json,base.json,node.json,nextjs.json}
packages/eslint-config/{package.json,base.js}
packages/db/{package.json,tsconfig.json,src/index.ts,scripts/load-env.cjs}
packages/env/{package.json,tsconfig.json,src/index.ts}
packages/services/{package.json,tsconfig.json,src/*}   # errors, scopes, pagination, 10 services, qbo placeholder, index
apps/api/{package.json,tsconfig.json,src/**}           # full Express v1 service
apps/web/{package.json,tsconfig.json}                  # web workspace configs (src/ moves under here in Step 2)
```

Deviations from the brief (all deliberate, all to protect guardrails / reduce blast radius):

1. **`@/lib/prisma` and `@/lib/services/*` stay as thin re-export shims** in
   `apps/web` instead of rewriting ~50 importers. This avoids editing the
   untouchable QBO files (they import `@/lib/prisma`) and shrinks the change.
2. **QBO is NOT extracted.** `packages/services/src/qboService.ts` is a no-op
   placeholder; `apps/web` keeps the original QBO files and imports them directly.
   (Brief §"out of scope" + QBO sandbox guardrail.)
3. **`apps/api` `build`/`start` use `tsc --noEmit` / `tsx`**, not a compiled
   `dist`. Production bundling of workspace TS is deferred (deploy is out of
   scope). Dev (`tsx watch`) is the supported path.
4. **No separate `controllers/` or `validation/` dirs in `apps/api`** — handlers
   and Zod schemas are inline in each router, matching the original thin-route
   style. See `apps/api/src/routes/README.md`.
5. **OpenAPI `servers` points at `API_ORIGIN`** so Swagger "Try it out" hits
   `:3001`.

---

## Step 0 — backup branch (Phase 0)

```bash
cd ~/Documents/henley-hub
git stash -u                      # shelve Cowork's new untracked files
git checkout -b pre-restructure-backup
git push -u origin pre-restructure-backup
git checkout claude/henley-hub-platform-2wIAN
git stash pop                     # restore the new files
```

## Step P — preflight baseline (capture BEFORE applying the rest)

Run the preflight on the *clean* tree so you have a known-good baseline.

```bash
git stash -u                      # clean working tree at 36c13ec
git status                        # must be clean
npx tsc --noEmit                  # must exit 0
npm run dev                       # :3000 — log in as Kyle, walk the sidebar
                                  # (both themes), hit /api/v1/health and
                                  # /api/external/projects with a bearer key
```

Create a temp key in Settings → API keys (`projects:read`, `clients:write`) and:

```bash
KEY=hh_xxx   # the key you just created
curl -s -H "Authorization: Bearer $KEY" http://localhost:3000/api/v1/projects | head -c 500
curl -s -X POST -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -H "Idempotency-Key: preflight-1" \
  -d '{"name":"Preflight test client"}' http://localhost:3000/api/v1/clients
```

Save both responses in `RESTRUCTURE_PREFLIGHT.md` (gitignored — do not commit).
Stop the dev server, then restore the new files:

```bash
git stash pop
```

If any preflight step fails, STOP — do not restructure on a broken baseline.

---

## Step 1 — commit the skeleton (Phase 1)

```bash
git add turbo.json tsconfig.base.json packages/typescript-config packages/eslint-config
git commit -m "chore(monorepo): add turborepo skeleton and shared configs

checkpoint: 36c13ec"
```

> The new root `package.json` is swapped in Step 2 (it changes how dev/build run,
> so it must land together with the app move).

---

## Step 2 — move the Next.js app into apps/web (Phase 2)

```bash
git mv src apps/web/src
git mv public apps/web/public
git mv next.config.mjs apps/web/next.config.mjs
git mv postcss.config.* apps/web/ 2>/dev/null || true
git mv tailwind.config.* apps/web/ 2>/dev/null || true
git mv next-env.d.ts apps/web/ 2>/dev/null || true
git mv .eslintrc* apps/web/ 2>/dev/null || true
git rm tsconfig.json            # replaced by apps/web/tsconfig.json (already authored)
```

Replace the **root `package.json`** with:

```json
{
  "name": "henley-hub",
  "private": true,
  "version": "0.0.0",
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "dev": "turbo run dev",
    "dev:web": "turbo run dev --filter=@henley/web",
    "dev:api": "turbo run dev --filter=@henley/api",
    "build": "turbo run build",
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck",
    "db:generate": "npm run -w @repo/db generate",
    "db:push": "npm run -w @repo/db push",
    "db:seed": "npm run -w @repo/db seed",
    "db:studio": "npm run -w @repo/db studio",
    "postinstall": "prisma generate --schema packages/db/prisma/schema.prisma"
  },
  "devDependencies": {
    "turbo": "^2.3.0",
    "typescript": "^5.6.3"
  },
  "packageManager": "npm@10.9.0"
}
```

Edit `apps/web/next.config.mjs` — add the root-env load (top) and
`transpilePackages`:

```js
import path from "node:path";
import { config as loadEnv } from "dotenv";

// Monorepo: Next only auto-loads app-local .env, so load the repo-root one.
loadEnv({ path: path.resolve(process.cwd(), "../../.env") });

/** @type {import('next').NextConfig} */
const allowedOrigins = ["*.app.github.dev", "*.github.dev", "localhost:3000"];

if (process.env.CODESPACE_NAME) {
  const domain = process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN || "app.github.dev";
  allowedOrigins.push(`${process.env.CODESPACE_NAME}-3000.${domain}`);
}
if (process.env.VERCEL_URL) allowedOrigins.push(process.env.VERCEL_URL);
if (process.env.VERCEL_BRANCH_URL) allowedOrigins.push(process.env.VERCEL_BRANCH_URL);

const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@repo/db", "@repo/services", "@repo/env"],
  experimental: { serverActions: { allowedOrigins } },
};

export default nextConfig;
```

```bash
npm install                      # links workspaces, hoists deps, runs prisma generate
cd apps/web && npm run typecheck # NOTE: will fail until Steps 3–4 (db + services) land
cd ..
git add -A
git commit -m "chore(monorepo): move next.js app into apps/web verbatim

App moved unchanged; root package.json split; next.config loads root .env and
transpiles @repo/* packages. Typecheck completes after db+services extraction.
checkpoint: 36c13ec"
```

---

## Step 3 — extract packages/db (Phase 3)

```bash
git mv apps/web/prisma packages/db/prisma     # schema.prisma + seed*.ts (tracked)
mv packages/db/prisma/dev.db packages/db/prisma/ 2>/dev/null || true   # dev.db is gitignored; ensure it sits beside schema
ls packages/db/prisma/dev.db                  # confirm the LIVE db moved (Quo cfg, API keys, demo data)
```

> If `git mv apps/web/prisma packages/db/prisma` already carried `dev.db` on
> disk (it usually does, via directory rename), the `mv` above is a no-op — just
> confirm `dev.db` is at `packages/db/prisma/dev.db`. Never regenerate it.

Overwrite `apps/web/src/lib/prisma.ts` with the shim:

```ts
// Re-export the shared client so existing `@/lib/prisma` imports — including the
// untouchable QBO files (quickbooks.ts, pushTimeActivity.ts, timeActions.ts) —
// keep working unchanged after the monorepo move. See @repo/db.
export { prisma } from "@repo/db";
```

Update `.gitignore` (dev.db moved):

```
# replace the prisma/dev.db lines with:
packages/db/prisma/dev.db
packages/db/prisma/dev.db-journal
.turbo/
dist/
```

```bash
npm install
npm run db:generate
cd apps/web && npm run typecheck && cd ..
git add -A
git commit -m "feat(db): extract prisma into packages/db with shared client

dev.db, schema, and seeds moved to packages/db/prisma; apps/web keeps a one-line
re-export shim at src/lib/prisma.ts so untouchable QBO/Door-1 imports are intact.
checkpoint: 36c13ec"
```

---

## Step 4 — extract packages/services (Phase 4)

The real service code now lives in `packages/services/src/*` (authored by Cowork,
with `server-only` removed and imports pointed at `@repo/db` / `./errors` /
`./pagination`). Replace the moved `apps/web` copies with shims and remove the
v1 API plumbing that the Express app replaces.

Write the 9 service shims (leave `qboService.ts` as its original — nothing imports
it, and it references the untouchable QBO file directly):

```bash
cd apps/web/src/lib/services
for s in projectService clientService estimateService dailyLogService \
         timeEntryService milestoneService fileService threadService userService; do
  printf 'export * from "@repo/services";\n' > "$s.ts"
done
cd ~/Documents/henley-hub
```

Overwrite `apps/web/src/lib/api/scopes.ts` with a shim (the API-key UI imports
`SCOPES`/`SCOPE_GROUPS` from here):

```ts
export { SCOPES, SCOPE_GROUPS, isScope, parseScopes, serializeScopes, hasScope } from "@repo/services";
export type { Scope } from "@repo/services";
```

Delete the v1 plumbing now living only in the deleted routes + moved services,
and the old Next v1 routes (replaced by apps/api):

```bash
git rm apps/web/src/lib/api/auth.ts apps/web/src/lib/api/handler.ts \
       apps/web/src/lib/api/rateLimit.ts apps/web/src/lib/api/idempotency.ts \
       apps/web/src/lib/api/errors.ts apps/web/src/lib/api/validation.ts
git rm -r apps/web/src/app/api/v1
```

Safety check — confirm nothing kept still imports the deleted modules:

```bash
grep -rn "@/lib/api/\(errors\|validation\|handler\|auth\|rateLimit\|idempotency\)" apps/web/src
# expect: no matches. (scopes is kept as a shim.)
```

```bash
npm install
cd apps/web && npm run typecheck && cd ..
git add -A
git commit -m "feat(services): extract resource services into packages/services

Real services live in packages/services; apps/web keeps re-export shims so page
and server-action imports are unchanged. v1 Next routes + API plumbing removed
(replaced by apps/api). QBO files untouched.
checkpoint: 36c13ec"
```

---

## Step 5 — packages/env + .env (Phase 5)

Append to the repo-root `.env` (and mirror the non-secret ones into `.env.example`):

```
# Monorepo ports & origins (B1 restructure)
API_PORT=3001
WEB_PORT=3000
WEB_ORIGIN="http://localhost:3000"
API_ORIGIN="http://localhost:3001"
```

```bash
cd packages/env && npm run typecheck && cd ../..
git add .env.example packages/env
git commit -m "feat(env): centralize env loading and validation in packages/env

checkpoint: 36c13ec"
```

---

## Step 6 — apps/api + docs wiring (Phase 6)

The Express service is authored. Point the in-app Swagger viewer at the API origin.

Overwrite `apps/web/src/components/SwaggerDocs.tsx`:

```tsx
"use client";

import { useEffect, useRef } from "react";

const CSS = "https://unpkg.com/swagger-ui-dist@5/swagger-ui.css";
const JS = "https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js";

export default function SwaggerDocs({ specUrl = "/api/v1/openapi.json" }: { specUrl?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!document.querySelector(`link[href="${CSS}"]`)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = CSS;
      document.head.appendChild(link);
    }
    const init = () => {
      const w = window as unknown as { SwaggerUIBundle?: (opts: Record<string, unknown>) => void };
      if (w.SwaggerUIBundle && ref.current) {
        w.SwaggerUIBundle({ url: specUrl, domNode: ref.current, deepLinking: true });
      }
    };
    const existing = document.querySelector(`script[src="${JS}"]`);
    if (existing) init();
    else {
      const script = document.createElement("script");
      script.src = JS;
      script.onload = init;
      document.body.appendChild(script);
    }
  }, [specUrl]);
  return <div ref={ref} className="bg-white rounded-lg overflow-hidden" />;
}
```

In `apps/web/src/app/(app)/settings/api/docs/page.tsx`, pass the API origin
(server component reads it from process.env, loaded by next.config):

```tsx
const apiOrigin = process.env.API_ORIGIN ?? "http://localhost:3001";
// ...
<SwaggerDocs specUrl={`${apiOrigin}/api/v1/openapi.json`} />
```

```bash
npm install
cd apps/api && npm run typecheck && cd ..
git add -A
git commit -m "feat(api): extract v1 endpoints into apps/api express service

All 25 v1 endpoints (+ health, openapi, docs) rewritten as Express routers on
:3001 with behavior parity (envelopes, scopes, 60/20 rate limits, idempotency,
error codes, ApiCallLog). Door 1 stays in apps/web. Swagger points at API origin.
checkpoint: 36c13ec"
```

---

## Step 7 — turbo orchestration (Phase 7)

Already wired via `turbo.json` + the root `package.json` scripts from Step 2.

```bash
npm run dev          # boots BOTH: web :3000, api :3001 (Ctrl-C stops both)
# or individually:
npm run dev:web
npm run dev:api
```

```bash
git commit --allow-empty -m "chore(monorepo): turbo orchestrates web and api dev together

checkpoint: 36c13ec"
```

---

## Step 8 — final verification + context doc (Phase 8)

```bash
# 1. Clean build of both apps (stop dev first)
npm run build

# 2. Restart and walk the app as Kyle, both themes — compare to preflight.
npm run dev

# 3. Postflight curls at the NEW ports (equivalent to preflight):
KEY=hh_xxx
curl -s -H "Authorization: Bearer $KEY" http://localhost:3001/api/v1/projects | head -c 500
curl -s -X POST -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -H "Idempotency-Key: postflight-1" \
  -d '{"name":"Postflight test client"}' http://localhost:3001/api/v1/clients
# replay (same key) → header `idempotency-replayed: true` + identical body:
curl -si -X POST -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -H "Idempotency-Key: postflight-1" \
  -d '{"name":"Postflight test client"}' http://localhost:3001/api/v1/clients | grep -i idempotency-replayed
# rate limit: 22 writes in a minute → 429 on the 21st.

# 4. Confirm Door 1 unchanged on :3000:
curl -s -H "Authorization: Bearer <HUB_TASKS_KEY>" http://localhost:3000/api/external/projects | head -c 300
```

Then update `HENLEY_HUB_CONTEXT.md`. Ready-to-paste content:

**§2 (Stack and repo) — add under the layout:**

```
- **Monorepo**: Turborepo + npm workspaces (npm 7+). Layout:
  - apps/web   — the Next.js 15 app (unchanged behavior), dev on :3000
  - apps/api   — Express + TS service hosting the v1 API, dev on :3001
  - packages/db        — Prisma schema, client, seed (SQLite, dev.db here)
  - packages/services  — the 9 resource services + errors/scopes/pagination
  - packages/env       — typed (Zod) env loader, reads repo-root .env
  - packages/typescript-config, packages/eslint-config — shared configs
- Run everything: `npm run dev` at the root (turbo runs web + api together).
```

**§4 (What's built) — add:**

```
### Brief 4 — monorepo restructure (Turborepo, B1)
Single Next.js app split into a Turborepo monorepo. apps/web (Next, verbatim) +
apps/api (Express, the 25 v1 endpoints rewritten with full behavior parity) +
packages/db, packages/services, packages/env, shared configs. SQLite + npm kept.
QBO code untouched (qboService is a placeholder; extraction deferred to after the
QBO sandbox test). Door 1 (/api/external/projects) stays in apps/web, unchanged.
v1 API now lives on :3001; the in-app Swagger viewer points at API_ORIGIN.
Commits: <paste the 8 hashes from git log --oneline>.
```

**§9 (File locations) — key path changes:** `src/...` → `apps/web/src/...`;
`prisma/...` → `packages/db/prisma/...`; service layer → `packages/services/src/`;
v1 API → `apps/api/src/routes/`; QBO (DO NOT TOUCH) → `apps/web/src/lib/...`
(paths shifted under apps/web but contents unchanged).

Then commit:

```bash
git add HENLEY_HUB_CONTEXT.md
git commit -m "docs: update project context for monorepo layout

checkpoint: 36c13ec"
git push origin claude/henley-hub-platform-2wIAN
```

Confirm the parachute still exists: `git ls-remote --heads origin pre-restructure-backup`.

---

## Recovery (if it goes sideways)

```bash
git checkout claude/henley-hub-platform-2wIAN
git reset --hard 36c13ec
git push --force-with-lease origin claude/henley-hub-platform-2wIAN
# or fall back to the backup branch:
git checkout pre-restructure-backup
```

---

## Likely first-compile snags (since Cowork could not run tsc)

- **`@repo/*` not found** → run `npm install` at the root first so workspaces link.
- **Prisma client missing** → `npm run db:generate` (root) after the db move.
- **Next can't see env / prisma** → confirm the `next.config.mjs` dotenv line and
  `transpilePackages` landed.
- **`@types/express` / `@types/cors` / `helmet` versions** → if install resolves
  different majors, align them; the code targets Express 4.
- **SQLite path** → `DATABASE_URL="file:./dev.db"` resolves relative to
  `packages/db/prisma/`; make sure `dev.db` is there.
