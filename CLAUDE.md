# Henley Hub — Claude project notes

This file is read by Claude Code at the start of every session. Keep it short and accurate.

## What this is

Henley Hub is a residential remodeling business platform — CRM, unified client comms (email/SMS/in-app), estimates, contracts, projects with milestones and daily logs, budget tracking, financials, and a client portal. Role-aware: CEO / OFFICE / FIELD / SUB / CLIENT each see a different app.

This is the v0.1 MVP, considerably grown since first written. Live modules: dashboard (analytics grid: recharts charts + comparison table via `lib/services/dashboardService.ts`), CRM (dense client table w/ derived job rollups), inbox, Jobs area (dashboard, All Jobs, board w/ saved views, job cockpit w/ location+weather, daily logs, live JT to-dos, catalog, connection/sync), Projects hierarchy (UI "Project" = `Engagement` model grouping Jobs; UI "Job" = legacy `Project` model — protected relations hang off it), estimates (catalog picker), contracts (estimate conversion, lifecycle DRAFT→SENT→SIGNED→DEPOSIT_PAID, historical backfill), vendors (compliance + soft-delete), financials, settings (integrations: QBO, M365, Quo, Henley Tasks, JobTread, Claude assistant). Claude assistant: role-scoped tool layer (`lib/assistant/`), confirm-gated mutations, SSE chat route, floating panel. Still stubbed: files/selections partially, e-sign + payment providers.

## Stack

- Next.js 15 (App Router) · React 19 · TypeScript
- Tailwind CSS · lucide-react
- Prisma ORM · SQLite (dev) — swap `provider` + `DATABASE_URL` to use Postgres
- NextAuth v5 (Credentials provider, JWT sessions) — split between `auth.ts` (Node, full) and `auth.config.ts` (edge-safe for middleware)

## Working in this repo

- **Dev branch:** `claude/henley-hub-platform-2wIAN` — all work goes here until told otherwise
- **Node:** 20+ required (pinned via `.nvmrc`, `package.json` engines, and `.devcontainer/devcontainer.json`)
- **Run locally:** `npm install && npm run db:reset && npm run dev`
- **Reset demo data:** `npm run db:reset` (drops + reseeds via `prisma/seed.ts`)
- **Demo logins:** see README; password is `demo` for all

## Repo layout

```
prisma/schema.prisma       data model (User, Client, Project, Milestone, DailyLog, BudgetItem, Thread, Message, Estimate, EstimateLine, Selection, Document, ProjectAssignment)
prisma/seed.ts             demo seed
src/auth.ts                NextAuth full config (Node-only, uses bcrypt + Prisma)
src/auth.config.ts         edge-safe auth config for middleware
src/middleware.ts          route guarding
src/lib/prisma.ts          Prisma client singleton
src/lib/roles.ts           Role enum + permission helpers (isInternal, canSeeFinancials, canViewAllProjects, canManageTeam)
src/lib/utils.ts           cn, formatMoney, formatDate, formatRelative, initials
src/components/            Sidebar, PageHeader, ComingSoon, SignOutButton, DemoRoleSwitcher
src/app/page.tsx           public landing
src/app/sign-in/           sign-in form
src/app/(app)/             authenticated app shell (sidebar + main)
  layout.tsx               auth guard, sidebar, header, dev role switcher
  dashboard/page.tsx       role-branched to OfficeDashboard / FieldDashboard / SubDashboard / ClientDashboard
  clients/                 CRM list, detail, new
  projects/                list, detail (milestones + logs + budget), new
  inbox/                   unified inbox across email/SMS/in-app/call notes
  estimates/               list, detail, new (auto-fills from selected client)
  financials/              cross-project budget vs actual rollup
  settings/                team & access (CEO only)
  contracts/ files/ selections/ integrations/quickbooks/   stub pages
```

## Conventions

- **Server components by default.** Use `"use client"` only when interactivity needs it (forms posting to server actions are fine in server components).
- **Server actions** for mutations. Don't introduce a `/api/...` route just for forms — server actions are cleaner.
- **Role gating** happens in two places: middleware (login required) and inside each page (`canSeeFinancials`, `canViewAllProjects`, etc. from `lib/roles.ts`). Never trust the client.
- **Money is stored as integer cents** in Prisma and rendered via `formatMoney(cents)`.
- **Dates** come back as `Date` from Prisma; render via `formatDate` / `formatRelative`.
- **SQLite has no enums.** Role + status fields are strings, validated by the helpers in `lib/roles.ts` and by literal types in the seed.
- **CSS:** Tailwind utilities + a handful of component classes in `src/app/globals.css` (`.card`, `.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.input`, `.label`, `.badge-*`).
- **No comments** in code unless the *why* is non-obvious. The codebase aims to be self-explanatory through naming.

## Roles & visibility

Role-aware behavior matters everywhere. The rules to keep in mind:

- **CEO**: sees everything; only role that can manage team / financials at the org level.
- **OFFICE**: full CRM, projects, estimates, financials. No team management.
- **FIELD**: only assigned projects. Can post daily logs (with "share with client" toggle). No financials. Sees their own messages.
- **SUB**: only assigned projects, limited to their scope. No financials, no daily logs from others.
- **CLIENT**: only their own project. Only milestones with `clientVisible: true` and only daily logs with `clientVisible: true`. No financial info.

When adding a new page, decide its visibility early. Use the helpers in `lib/roles.ts`.

## What's stubbed (Phase 2)

- **QuickBooks Online** — OAuth flow + customer/invoice/payment sync. Schema already has `qbCustomerId` on Client.
- **Contracts** — Estimate → contract conversion, PDF, e-signature, deposit.
- **Files** — Per-project document library with role-based visibility (R2 / S3).
- **Selections** — Client-facing approval flow with deadlines.
- **Email / SMS gateway** — Inbox UI is real; outbound delivery and inbound parsing are not wired.
- **Field time clock** — Tied to daily log hours.

Each stub page (`/contracts`, `/files`, etc.) describes the intended data flow.

## When asked to add a new connector

Always: env var stubs in `.env.example`, OAuth route handlers under `src/app/api/integrations/<name>/`, a config UI under `src/app/(app)/integrations/<name>/`, and Prisma fields if data needs to persist. Add a feature-flag check so unconfigured connectors degrade gracefully.

## Tone for commits and PRs

Imperative, ≤72 char subject, body explains *why* not *what*. No emoji. No "Generated by Claude" tag.

## What NOT to do

- Don't add comments explaining what readable code does
- Don't introduce new abstractions ahead of need (one inline call > a new helper)
- Don't add backwards-compat shims or feature flags for code that isn't deployed anywhere
- Don't run destructive git commands without asking
- Don't merge to `main` — work stays on the dev branch until told otherwise
