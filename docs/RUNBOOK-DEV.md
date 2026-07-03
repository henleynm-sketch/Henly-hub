# Dev Runbook — Turborepo layout · PostgreSQL (Neon)

The app lives in `apps/web`; the database package is `packages/db`. The LIVE
database is PostgreSQL on Neon — DATABASE_URL in the ROOT `.env`. Nick and
Arnab now share ONE database: changes on either machine appear on both.

ROLLBACK: uncomment the `# DATABASE_URL="file:./dev.db"` line in root `.env`
(comment the postgres one), revert the provider commit, `npm run db:generate`.
`dev.db` + its dated backup are retained untouched for exactly this purpose.

## Daily commands (all from repo root)

| Task | Command |
|---|---|
| Start dev server | `npm run dev` (turbo → web on :3000) |
| Push schema changes | `npm run db:push` |
| Regenerate Prisma client | `npm run db:generate` |
| Reseed demo data | `npm run db:reset` — BLOCKED on Postgres by the seed guard (would wipe SHARED live data). Requires SEED_FORCE=1. Don't. |
| Typecheck everything | `npm run typecheck` |

## Layout

```
apps/web            frontend + in-Next backend (Door 1, /api/v1, assistant, MCP, OAuth)
packages/db         @repo/db — schema.prisma, dev.db, seeds, PrismaClient singleton
.env                ROOT — single source of truth for env
turbo.json          pipeline
```

`apps/web/src/lib/prisma.ts` is a one-line re-export of `@repo/db` — every
existing `@/lib/prisma` import (including the protected QuickBooks files)
resolves unchanged.

## Things that did NOT change

- URL: http://localhost:3000 — all routes identical
- `.env` keys and location (root)
- Branch: `claude/henley-hub-platform-2wIAN`

## Reminders

- PowerShell 5.1: use `;` between commands, never `&&`
- Run commands FROM the repo root
- Node 20+
