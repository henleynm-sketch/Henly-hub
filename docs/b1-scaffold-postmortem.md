# B1 Scaffold Postmortem

Recorded 2026-07-03 before deletion. The apps/ + packages/ tree,
turbo.json, tsconfig.base.json, RESTRUCTURE_RUNBOOK.md and B1_SESSION_NOTES.md
were a never-executed Turborepo scaffold authored ~80 commits ago, BEFORE the
JobTread absorption, Jobs/Projects hierarchy, assistant, MCP connector,
notifications and real auth. Its copied services/routers were stale business
logic; executing its runbook would have regressed the app. Superseded by the
fresh conversion starting at this commit.

## Tree at deletion
```
B1_SESSION_NOTES.md
RESTRUCTURE_RUNBOOK.md
apps/api/package.json
apps/api/src/app.ts
apps/api/src/index.ts
apps/api/src/lib/envelope.ts
apps/api/src/lib/handler.ts
apps/api/src/middleware/auth.ts
apps/api/src/middleware/cors.ts
apps/api/src/middleware/errorHandler.ts
apps/api/src/middleware/guards.ts
apps/api/src/openapi/spec.ts
apps/api/src/routes/README.md
apps/api/src/routes/clients.ts
apps/api/src/routes/dailyLogs.ts
apps/api/src/routes/docs.ts
apps/api/src/routes/estimates.ts
apps/api/src/routes/files.ts
apps/api/src/routes/health.ts
apps/api/src/routes/messages.ts
apps/api/src/routes/milestones.ts
apps/api/src/routes/projects.ts
apps/api/src/routes/threads.ts
apps/api/src/routes/timeEntries.ts
apps/api/src/routes/users.ts
apps/api/src/types/express.d.ts
apps/api/tsconfig.json
apps/web/package.json
apps/web/tsconfig.json
packages/db/package.json
packages/db/scripts/load-env.cjs
packages/db/src/index.ts
packages/db/tsconfig.json
packages/env/package.json
packages/env/src/index.ts
packages/env/tsconfig.json
packages/eslint-config/base.js
packages/eslint-config/package.json
packages/services/package.json
packages/services/src/clientService.ts
packages/services/src/dailyLogService.ts
packages/services/src/errors.ts
packages/services/src/estimateService.ts
packages/services/src/fileService.ts
packages/services/src/index.ts
packages/services/src/milestoneService.ts
packages/services/src/pagination.ts
packages/services/src/projectService.ts
packages/services/src/qboService.ts
packages/services/src/scopes.ts
packages/services/src/threadService.ts
packages/services/src/timeEntryService.ts
packages/services/src/userService.ts
packages/services/tsconfig.json
packages/typescript-config/base.json
packages/typescript-config/nextjs.json
packages/typescript-config/node.json
packages/typescript-config/package.json
tsconfig.base.json
turbo.json
```
