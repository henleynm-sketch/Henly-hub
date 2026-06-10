# Henley Hub

One platform to run a residential remodeling business — CRM, unified client comms,
estimates, contracts, projects, daily logs, budget tracking, and a client portal —
with role-aware views for the CEO, office staff, field crews, subs, and clients.

This is the v0.1 MVP slice. The data model and navigation cover the full vision;
the UI is built out for the spine (auth, CRM, inbox, projects, estimates,
financials) and stubbed for Phase 2 modules (contracts/e-sign, files, selections,
QuickBooks OAuth).

## Quick start

### Codespaces (recommended)

Open the repo in GitHub Codespaces. The devcontainer auto-runs `.devcontainer/setup.sh`, which:
- copies `.env.example` to `.env`
- generates a real `AUTH_SECRET`
- detects the Codespace forwarded URL and sets `AUTH_URL`
- runs `npm install` and `npm run db:reset` (creates SQLite + seeds demo data)

When that finishes, just run:
```bash
npm run dev
```
Port 3000 is auto-forwarded. Sign in with `kyle@henleyhub.com` / `demo`.

### Local

```bash
cp .env.example .env
# edit .env: replace AUTH_SECRET with `openssl rand -hex 32`
npm install
npm run db:reset
npm run dev
# open http://localhost:3000
```

## Demo logins (password `demo`)

| Email                       | Role                       | What you'll see                                              |
| --------------------------- | -------------------------- | ------------------------------------------------------------ |
| kyle@henleyhub.com          | CEO / Owner                | Full dashboard, financials, settings, all projects           |
| morgan@henleyhub.com        | Office / PM                | Pipeline, projects, inbox, estimates                         |
| sam@henleyhub.com           | Office / Design            | Same as office                                               |
| jess@henleyhub.com          | Field — Lead Carpenter     | Today's jobs, daily log entry, no financials                 |
| danny@henleyhub.com         | Field crew                 | Same as field                                                |
| tile-pro@subs.com           | Subcontractor              | Only assigned scopes                                         |
| watt@subs.com               | Subcontractor — Electrical | Only assigned scopes                                         |
| rachel.t@example.com        | Client (Tomlinson kitchen) | Their project portal: progress, milestones, shared updates   |
| miguel.vargas@example.com   | Client (Vargas suite)      | Their project portal                                         |

## What's built

- **Auth** — NextAuth credentials, JWT session, edge-safe middleware
- **Roles** — CEO, OFFICE, FIELD, SUB, CLIENT drive nav, page access, and what each user sees
- **CRM** — Client list, pipeline columns, client detail (projects, threads, estimates)
- **Unified Inbox** — Threads per client across Email / SMS / In-app / Call notes; reply form (gateway stubbed)
- **Projects** — List, detail with milestones (status edits), daily logs (post + share-with-client toggle), budget vs actual
- **Estimates** — List, auto-fill new estimate from selected client, line items by category, totals + tax
- **Financials** — Cross-project budget vs actual rollup
- **Settings** — Team & access list (CEO only)
- **Landing page** — Public marketing page at `/`

## What's stubbed (Phase 2)

- **QuickBooks** — OAuth flow, customer mapping, invoice push, payment sync. UI shell at `/integrations/quickbooks` describes the data flow.
- **Contracts** — Estimate → contract conversion, PDF, e-signature, deposit
- **Files** — Per-project document library with role-based visibility
- **Selections** — Client-facing selection sheet with approval flow
- **Field time clock** — Tied to daily log hours
- **Real email/SMS gateway** — Inbox UI is real; outbound delivery is stubbed

## Stack

- Next.js 15 (App Router) · React 19 · TypeScript
- Tailwind CSS · lucide-react icons
- Prisma ORM · SQLite (swap to Postgres by changing `provider` and `DATABASE_URL`)
- NextAuth v5 (Credentials provider, JWT sessions)

## Layout

```
prisma/
  schema.prisma          data model
  seed.ts                demo clients, projects, milestones, logs, threads, estimates
src/
  auth.ts                NextAuth (server-only, with bcrypt + Prisma)
  auth.config.ts         Edge-safe config used in middleware
  middleware.ts          Route guarding
  lib/
    prisma.ts            Prisma client singleton
    roles.ts             Role enum + permission helpers
    utils.ts             cn(), formatMoney, formatDate, formatRelative
  components/            Sidebar, PageHeader, ComingSoon, SignOutButton
  app/
    page.tsx             Landing
    sign-in/page.tsx     Sign-in form
    api/auth/[...nextauth]/route.ts
    (app)/               Authenticated app shell
      layout.tsx         Sidebar + header
      dashboard/         Role-branched dashboard
      clients/           CRM list, detail, new
      projects/          List, detail, new
      inbox/             Unified inbox
      estimates/         List, detail, new (auto-fill)
      financials/        Cross-project rollup
      contracts/         Stub
      files/             Stub
      selections/        Stub
      settings/          Team & access
      integrations/quickbooks/  Connection setup stub
```

## Roadmap

Phase 2 (next):

1. QuickBooks OAuth + customer/invoice sync
2. Contract generation (estimate → PDF → DocuSign → deposit)
3. File upload to S3/R2 with per-project visibility
4. Selections module with client approve/reject
5. Real outbound email/SMS gateway (Postmark + Twilio)

Phase 3:

- Native desktop app via Tauri (already web-first; Tauri is a thin wrapper)
- Mobile web fixes for field crew log entry
- Calendar view for crew scheduling
- Time clock for field crew tied to daily logs
