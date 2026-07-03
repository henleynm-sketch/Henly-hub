# Dev Runbook — Turborepo layout

The app now lives in `apps/web`. Same URLs, same behavior — only the folder moved.

## One-time cutover (after pulling the turbo commits)

Run from the repo root in PowerShell, dev server STOPPED:

```powershell
Move-Item .env apps\web\.env
Move-Item prisma\dev.db apps\web\prisma\dev.db -Force
Remove-Item prisma, src, public, scripts -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item next.config.mjs, postcss.config.js, tailwind.config.ts, tsconfig.json, next-env.d.ts, .env.example, node_modules, .next -Recurse -Force -ErrorAction SilentlyContinue
npm install
npm run dev
```

`-Force` on the dev.db move is deliberate: it overwrites the copied snapshot in
`apps/web/prisma` with your live database. If `git status` still shows leftovers,
that's untracked debris — safe to delete.

## Daily commands (all from repo root)

| Task | Command |
|---|---|
| Start dev server | `npm run dev` (turbo → web on :3000) |
| Push schema changes | `npm run db:push` |
| Regenerate Prisma client | `npm run db:generate` |
| Reseed demo data | `npm run db:reset` |
| Typecheck everything | `npm run typecheck` |

You can also `cd apps\web` and run the same scripts directly — root scripts are
just passthroughs (`-w web`).

## Things that did NOT change

- URL: http://localhost:3000 — all routes identical
- Database: SQLite at `apps/web/prisma/dev.db` (same file, new home)
- `.env` keys: unchanged, file just moved to `apps/web/.env`
- Branch: `claude/henley-hub-platform-2wIAN`

## Reminders

- PowerShell 5.1: use `;` between commands, never `&&`
- Run commands FROM the repo root (`C:\Users\solut\Documents\henley-hub`)
- Node 20+ (pinned in `.nvmrc` / engines)
