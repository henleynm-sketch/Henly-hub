# Session notes — B1 monorepo restructure + live fixes

Date: 2026-06-17 · Branch: `claude/henley-hub-platform-2wIAN` · Starting commit
(safety anchor): `36c13ec` ("checkpoint before monorepo restructure").

This records everything done in the working tree after the B1 (monorepo
restructure) brief was given. **Read this with `git status` open.** Nothing in
this session was committed, compiled, or run — Cowork only wrote/edited files.
`git log` is still at `36c13ec`. Verify everything yourself before trusting it.

---

## 0. Working-tree state at a glance

Two unrelated bodies of work are sitting in the tree together:

- **A. Three live bug fixes** — edits to existing tracked files. Small, safe,
  independent of the restructure. **Commit these on their own, first.**
- **B. Monorepo restructure scaffolding** — all new, untracked files, plus a
  runbook. Inert (nothing imports them yet); the existing app still runs
  unchanged. Applied later via `RESTRUCTURE_RUNBOOK.md`.

Because the fixes (A) are tracked-file *modifications* and the scaffolding (B)
is *untracked*, `git stash -u` shelves both — keep that in mind when running the
runbook's preflight.

---

## A. Live app fixes (commit independently of the restructure)

These fix the running app and should ship regardless of whether/when the
restructure lands.

### A1 — `src/app/(app)/settings/page.tsx` · `requireCeo` hoisted to module scope
- **Symptom:** clicking **Rotate** on the Door 1 API key card threw
  `[ Server ] Error: requireCeo is not defined` (settings/page.tsx:331).
- **Cause:** `requireCeo()` was defined *inside* the page component, and all
  **seven** CEO-only `"use server"` actions (save organization, invite/update
  user, toggle active, seed/update departments, rotate key) closed over it.
  A server action closing over an enclosing-scope function fails at runtime —
  Rotate was just the one clicked; all seven were affected.
- **Fix:** moved `requireCeo()` out to module scope so the actions reference a
  stable module binding. One added function at the top, removed the in-component
  copy. No behavior change otherwise.

### A2 — `src/app/layout.tsx` · `suppressHydrationWarning` on `<body>`
- **Symptom:** console hydration error citing `data-gr-c-s-check-loaded` /
  `data-gr-ext-installed`.
- **Cause:** the **Grammarly** browser extension injects those attributes onto
  `<body>` before React hydrates. Cosmetic, dev-only, would not occur for users
  without the extension. Not a Hub bug.
- **Fix:** added `suppressHydrationWarning` to `<body>` (it was already on
  `<html>`; the attribute only covers the element it is on).

### A3 — `src/app/(app)/layout.tsx` · sticky sidebar + topbar
- **Request:** make the left nav sticky.
- **Cause:** the app shell used `flex min-h-screen`, which let the whole window
  scroll and carried the sidebar with it — even though `<main>` already had
  `overflow-y-auto` (the author intended an internal-scroll shell).
- **Fix:** shell `min-h-screen` → `h-screen overflow-hidden`, and added
  `min-h-0` to `<main>` so it scrolls internally. Sidebar and topbar now stay
  fixed; only content scrolls. The sidebar's `<nav>` already had its own
  `overflow-y-auto`. Tailwind utility classes only — no theme/token impact, but
  worth a quick light+dark glance.

**Suggested commit (A):**
```
fix(settings): hoist requireCeo to module scope for server actions
fix(ui): suppress body hydration warning + make app shell sticky
```
(or split into two). Verify: `npx tsc --noEmit`, then click Rotate (no error),
reload (no Grammarly hydration error), scroll a long page (sidebar stays).

---

## B. Monorepo restructure scaffolding (B1) — authored, not applied

All files below are **new and untracked**. They do not change the running app.
The actual conversion (git moves, deletions, import rewrites, installs, commits,
verification) lives in `RESTRUCTURE_RUNBOOK.md` and is yours to run.

### Files authored
- **Skeleton:** `turbo.json`, `tsconfig.base.json`,
  `packages/typescript-config/{package.json,base.json,node.json,nextjs.json}`,
  `packages/eslint-config/{package.json,base.js}`
- **`packages/db`** — shared Prisma client (`@repo/db`), root-`.env` loader
  script, tsconfig
- **`packages/env`** — typed (Zod) env loader reading the repo-root `.env`
  (aligned to the real `AUTH_SECRET`/`AUTH_URL` names)
- **`packages/services`** — `errors.ts`, `scopes.ts`, `pagination.ts`, the 10
  resource services (`server-only` stripped, imports → `@repo/db`/`./errors`/
  `./pagination`), a QBO no-op placeholder, and `index.ts`
- **`apps/api`** — full Express v1 service: `index.ts`, `app.ts`, middleware
  (auth/scope, rate limit, idempotency, call log, CORS, error handler), **12
  routers covering all 32 endpoints**, OpenAPI spec ported verbatim, `/docs`
  route, `routes/README.md`
- **`apps/web/{package.json,tsconfig.json}`** — the web workspace configs
- **`RESTRUCTURE_RUNBOOK.md`** — the step-by-step conversion you execute

### Deliberate deviations from the brief (to protect guardrails / shrink blast radius)
1. `@/lib/prisma` and `@/lib/services/*` stay as thin re-export shims in
   `apps/web` rather than rewriting ~50 importers — this is what keeps the
   untouchable QBO and Door 1 files unedited (they import only `@/lib/prisma`).
2. QBO is **not** extracted; `qboService.ts` is a placeholder. Extraction waits
   for the QBO sandbox test (guardrail).
3. `apps/api` `build`/`start` use `tsc --noEmit` / `tsx`; production bundling of
   workspace TS is deferred (deploy out of scope).
4. No separate `controllers/`/`validation/` dirs — handlers + Zod schemas inline
   per router, matching the original thin-route style.
5. OpenAPI `servers` points at `API_ORIGIN` so Swagger "Try it out" hits `:3001`.

### Pending (not done — all in the runbook, all yours to run)
Phase 0 backup branch · preflight baseline · git moves (`src`→`apps/web`,
`prisma`→`packages/db`, etc.) · root `package.json` swap · shim/edit writes ·
deletion of old v1 routes + API plumbing · `npm install` · per-workspace
`tsc` · postflight curls · `HENLEY_HUB_CONTEXT.md` update. **No commit exists
for any restructure phase.**

---

## C. Discussed but intentionally not built

- **Seed consolidation** (one `seed.ts` + one `db:seed`): investigated all four
  seed files. Finding — they are **mutually-exclusive load profiles** (demo /
  real / BuilderTrend each `deleteMany()` everything first; quo is a
  threads/messages overlay; real and bt define the same Henley team emails, so
  "all at once" would crash on a unique-email constraint). The buildable merge
  is one file with a profile selector. **You cancelled the decision**, so
  nothing was changed — all four seed files and the eight `db:*` scripts are
  untouched.
- **`db:*` script trim** (drop the `--force-reset` variants etc.): discussed,
  not changed.
- **GitHub Actions CI** (`tsc`/`build` on push): offered, not built.

---

## D. Recommended order from here

1. **Commit A (the live fixes)** now — they're done and safe, and they're
   independent of the restructure. Verify with `tsc` + a quick click-through.
2. When ready for the restructure, follow `RESTRUCTURE_RUNBOOK.md` from Step 0.
   Note the preflight uses `git stash -u`, which will also shelve the A fixes if
   they aren't committed yet — so do step 1 first.
3. Optionally revisit the seed merge and CI items in C.

Nothing here is verified by Cowork. The commit must appear in `git log`, `tsc`
must exit 0, and the browser must show the change — per
`HENLEY_HUB_CONTEXT.md` §10 — before any of it counts as shipped.
