# Dev Runbook — Turborepo layout

The app lives in `apps/web`; ALL database files (schema, dev.db, seeds) live in
`packages/db`. Same URLs, same behavior — only folders moved.

## One-time cutover (dev server STOPPED, from repo root in PowerShell)

```powershell
git reset
Move-Item .\prisma\dev.db .\packages\db\prisma\dev.db -Force
Remove-Item prisma, node_modules, .next -Recurse -Force -ErrorAction SilentlyContinue
npm install
npm run db:generate
npm run dev
```

Notes:
- `.env` STAYS at the repo root — do NOT move it. It is now the single source
  of truth; all scripts load it from root via dotenv-cli.
- `DATABASE_URL="file:./dev.db"` stays EXACTLY as-is. The path is relative to
  schema.prisma, which now sits next to dev.db in `packages/db/prisma/`.
- The `-Force` on the dev.db move is deliberate: it overwrites a stale snapshot
  copy with your LIVE database (it holds the QuickBooks token — never recreate it).
- FIRST CHECK after boot: Settings → QuickBooks must still say CONNECTED.
  If it says disconnected: STOP, do not re-auth — the dev.db move/path is wrong.

## Daily commands (all from repo root)

| Task | Command |
|---|---|
| Start dev server | `npm run dev` (turbo → web on :3000) |
| Push schema changes | `npm run db:push` |
| Regenerate Prisma client | `npm run db:generate` |
| Reseed demo data | `npm run db:reset` (WIPES dev.db — QBO token included. Don't run casually.) |
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
