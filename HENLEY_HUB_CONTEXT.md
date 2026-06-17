# Henley Hub — project handoff document

Read this whole document before touching the codebase. It is the single
source of truth for what Henley Hub is, what's built, what works, what
doesn't, what's next, and how to operate the project safely.

Owner: Nick Henley (Henley Contracting Ltd., Durham Region & Kawartha
Lakes, Ontario). Developer: Arnab Chakraborty (Solutionever Technologies).
Other contributors: Ayandip (Henley Tasks, separate app), Yash (Azure /
Microsoft 365 setup), Yash (added to repo).

Last refreshed: end of v1 API build session.

---

## 1. What Henley Hub is

A role-aware contractor operating platform built to **replace BuilderTrend
and HubSpot** at Henley Contracting (~$10K USD/yr BuilderTrend subscription
on the line). QuickBooks Online stays as the financial system of record —
Hub is everything else: CRM, projects, daily logs, time clock, estimates,
contracts, files, scheduling, unified inbox, integrations.

Henley Contracting is a 1988-founded custom-home and high-end-renovation
builder. Team: Nick (CEO/Visionary), Rui Tomas (Operations lead, also
Nick's father), Mike Henley (Kawarthas Sr. Project Director, Nick's
brother), Andrew Bapst + Mat Heney (Site Supervisors), Josh Wartman +
Karen (Finance/HR), office staff Ashley/Victoria/Sara, plus subs and
field crew.

Branding: black `#000000`, dark charcoal `#58595B`, white `#FFFFFF`,
medium grey `#808080`, serif headings (Didot/Bodoni/Playfair-style),
clean uppercase sans subtext (Montserrat/Raleway-style). Closer to an
architectural firm than a trade contractor.

**The accent color shifted from orange `#E8621A` to blue during the UI
cleanup pass** (Phase 2 of the master brief). Active buttons, primary
actions, and active nav items render in blue now. Status pills, filter
chips, and badges still use the original orange ramp for category
distinction. Both are correct.

---

## 2. Stack and repo

- **Framework**: Next.js 15 (App Router), React 19, TypeScript
- **Styling**: Tailwind v3 + a custom `hh-*` design-system layer in
  `globals.css`. Tokens for both light and dark mode. No hardcoded
  hex anywhere outside the token definitions.
- **ORM/DB**: Prisma, SQLite in development (`prisma/dev.db`),
  Postgres planned for Phase 8 (production deploy).
- **Auth**: NextAuth v5 (credentials provider). Demo password is
  literally `demo` for every seeded user.
- **Repo**: `github.com/henleynm-sketch/my-project`
- **Working branch**: `claude/henley-hub-platform-2wIAN` (this IS the
  trunk; there is no separate `main` to merge into right now)
- **Local paths**:
  - Arnab: `C:/Users/solut/Documents/henley-hub`
  - Nick (read-only / test viewer): `C:/Users/nicho/my-project`
- **Daily workflow**: `cd ~/Documents/henley-hub` → `git pull` →
  `npm run dev` (port 3000 only) → commit/push at the end of changes.

### Demo users (password `demo` for all)

| Email | Role | Use |
|---|---|---|
| `kyle@henleyhub.com` | CEO / Owner | Primary test user |
| `morgan@henleyhub.com` | Office / Admin | Project coordination |
| `sam@henleyhub.com` | Office / Admin | Design & selections |
| `jess@henleyhub.com` | Field | Lead carpenter (used for time clock testing) |
| `danny@henleyhub.com` | Field | Production |
| `tile-pro@subs.com` | Subcontractor | Tile/stone |
| `watt@subs.com` | Subcontractor | Electrical |
| `rachel.t@example.com` | Client | Tomlinson family |
| `miguel.vargas@example.com` | Client | Vargas family |

Role-switcher pill bottom-right in dev — jumps between roles without
sign-out.

---

## 3. Hard guardrails — read twice, never violate

### Files Cowork must NEVER touch

These are working production code held for a sandbox test that has
**not yet been run**:

- `src/lib/quickbooks.ts`
- `src/lib/pushTimeActivity.ts`
- `src/app/(app)/projects/[id]/timeActions.ts`
- Everything under `/integrations/quickbooks/**`
- The `QBOToken` Prisma model

If the API approve endpoint or any other code needs to touch QuickBooks
behavior, **do not call the push directly from the service layer until
the sandbox test passes.** The v1 API already documents this gap: API
approve marks `approved + qbReady` but does not trigger the QBO push.
That stays the contract until QBO is verified live.

### Commands Cowork must NEVER run

- `npm run db:reset` — wipes the QBO connection. Use
  `npx prisma db push` for schema changes instead.
- `npm run build` while `npm run dev` is running — corrupts `.next`.
  Stop dev, then build.
- Anything that would write secrets into a committed file. Keys live
  in `.env` (gitignored), in the `Setting` table, or in the `ApiKey`
  table — **never in source**.

### Things that hurt the codebase silently

- Tailwind arbitrary values with **unescaped commas**
  (`bg-[var(--x,rgba(30,31,35,0.45))]`). Breaks the entire PostCSS
  pipeline app-wide, not just on the line where it appears. Past pain.
- Hardcoded hex outside the design-system token definitions. Use CSS
  variables.
- Running Cowork and Antigravity / Gemini IDE agents in parallel on
  the same files. Antigravity caused repeated style regressions in
  earlier sessions; UI is now stable and the rule is one agent at a
  time per file.
- Saving anything claiming "test API key" in source. Stub keys live
  only in `.env.local` or are generated at runtime in tests.

### Secrets pending rotation (DO when next in `.env`)

- **QBO** client ID + client secret (exposed in earlier chat logs)
- **GitHub PAT** (in the remote URL — replace with `gh auth` or a
  fresh PAT)
- **Quo API key** (`03e850...` was pasted into chat earlier — should
  be rotated and the new one stored in `QuoConfig.apiKey` only)
- **`HUB_TASKS_API_KEY`** in `.env` is now migrated into the `ApiKey`
  table as "Henley Tasks (migrated)" — the legacy `Setting` row still
  exists for the Door 1 route, do not delete it.

---

## 4. What's built and shipped

### Phase 0 — earlier sessions
- CRM with HubSpot stage normalization
- Estimates (drafts, line items, status)
- Daily logs with photos (UI; local-disk storage; cloud backend TBD)
- Time clock UI + approval flow, QBO TimeActivity push code (UNTESTED
  end-to-end against the QBO sandbox — the cancellation gate, still
  open)
- Demo seed data: 4 projects (Cooper Kitchen, Patel Screened Porch,
  Vargas Primary Suite Addition, Tomlinson Kitchen + Pantry Remodel)
- Inbox UI with channels (email, sms, voice)

### Client data import (one-shot, completed)

`henley-hub-client-import.csv` — 299 rows merging HubSpot (filtered
from 7,400+ scraped contacts down to 59 real ones) and JobTread (240
real customers, ~45 spam accounts cut). 37 records existed in both
systems and were merged. 29 rows have no email/phone (old JobTread
job-name entries like "Allen, Sandy - 609 Mary Street, Oshawa"); they
import but cannot be deduped by email, so the CSV should be re-imported
only with care. Lives in `/mnt/user-data/outputs/` from the original
session; re-run after Postgres migration.

### Brief 1 — Quo SMS & voice integration (shipped)

- Quo = rebrand of OpenPhone; API host is still `api.openphone.com`.
- Auth header is `Authorization: <KEY>` — **no `Bearer` prefix.**
- "Inboxes" in the Quo UI are "phone numbers" in the API.
- `QuoConfig` singleton row stores the key, `defaultPhoneNumberId`,
  `defaultPhoneNumberName`, `apiBase` override, last-sync metadata.
- `src/lib/quo.ts` — `quoCall`, `testQuoConnection`, `syncQuoMessages`,
  `syncQuoCalls`. Skips business-only `/summary` and `/transcription`.
- Settings → Integrations → Quo card: three states (Not configured /
  Configured / Connected), Configure & test flow opens a sheet, picks
  a phone number after successful auth.
- Inbox surfaces SMS + voice threads with the right channel icons.
  E.164 phone-matching links unknown numbers to imported clients when
  the number matches `Client.phone`.

### Brief 2 — UI cleanup, profile, settings rebuild, dashboard, mobile (shipped)

All six phases verified visually:

1. **Door 2 removal** — Hub's old Tasks page deleted, `worksite.ts`
   removed, "Task board" button off Schedule, no "Tasks" entry in
   sidebar, `WORKSITE_*` env vars gone.
2. **Primary buttons fixed** — site-wide, both themes, no clipping.
   This is where the accent shifted to blue.
3. **Sign-out + /profile page** — Account, Password, Preferences
   (Theme + Time zone), Sessions ("Signed in via credentials").
4. **Settings rebuild** — 8 sections: Organization, Team & access
   (with Department + Reports to columns), Departments (7-default
   seeder), Integrations (QBO + M365 + Quo + Henley Tasks door 1),
   API keys, Notifications grid, Audit log, Danger zone (Export all
   data). QuickBooks card moved OUT of sidebar into Integrations
   section. New tables: `Department`, `Setting`, `SettingAudit`,
   `AuditLog`, `UserNotificationPref`. Added columns to `User`:
   `department`, `reportsToId`, `active`.
5. **Dashboard upgrade** — 4 KPI cards (Active clients, Projects in
   flight, Open pipeline $, On the clock now), recent activity feed
   (last 14 days, real entries), This week's agenda, Action items
   (unread messages, time approvals, selections), bottom counter row
   (Daily logs this week, Client updates this month, QBO status).
6. **Mobile responsiveness** — sidebar collapses below 768px,
   tables become stacked cards under 640px, Time clock (Field) has
   large tap targets and a full-screen project picker on phones.

### Microsoft 365 integration (UI built, blocked on Azure setup)

- `M365Config` singleton row stores tenant id, client id, secret,
  mailbox.
- Configure sheet in Settings → Integrations → Microsoft 365.
- `getGraphToken` + `syncInbox` libraries present.
- **BLOCKED**: Azure app registration needs `Mail.Read` as an
  **Application** permission (not Delegated) with admin consent
  granted. Last test fails with `Insufficient privileges to complete
  the operation` from Graph. Yash owns the Azure side; reminder
  message was sent. Client ID in flight:
  `1b7e8810-43d4-4dd5-a4fa-d5166c077bed`. Tenant:
  `077d5730-988e-44ac-b44f-555fd97d56c6`. Mailbox:
  `automation@henleycontracting.com`.
- Code is correct. When the Azure permission lands, Test connection
  should pass.

### Brief 3 — v1 external API (shipped, end of last session)

The Cowork session that just ended built and pushed all five phases:

| Commit | Phase |
|---|---|
| `890b63f` | Checkpoint before v1 api build |
| `30755ef` | Foundation — keys, scopes, auth, rate limits, errors |
| `1340d7a` | Service extraction |
| (unlabeled) | v1 endpoints across nine resources |
| `b525c95` | API key manager UI |
| `9548ebe` | OpenAPI spec + browsable docs |

What this delivered:

- `/api/v1/...` with 25 endpoints across 9 resources (projects,
  clients, estimates, daily-logs, time-entries, milestones, files,
  threads, messages, users) + `/health` + `/openapi.json`.
- Per-endpoint scopes (25 of them, plus `admin` superscope), enforced
  via `requireScope` middleware.
- `ApiKey`, `ApiKeyAudit`, `ApiCallLog` tables. Keys stored as
  `sha256` hash + 8-char prefix for masked display.
- In-memory token-bucket rate limiter: 60 reads/min, 20 writes/min
  per key. TODO: move to Redis at multi-instance deploy.
- In-memory idempotency cache for writes (10-minute window) keyed
  on `(apiKeyId, Idempotency-Key)`. `ApiCallLog` records the key
  for the activity feed; the cached response body lives in-memory
  only.
- Settings → API keys: create / view / rotate / revoke / scope-edit
  keys, activity feed per key, audit history per key. Legacy
  `HUB_TASKS_API_KEY` migrated on first load into an `ApiKey` row
  named "Henley Tasks (migrated)". Door 1 (`/api/external/projects`)
  still reads from the `Setting` row → untouched contract for
  Ayandip's app.
- OpenAPI 3.1 spec at `/api/v1/openapi.json`. Browsable Swagger UI
  page at `/settings/api/docs` (loaded from CDN to keep deps lean).
- Service layer extracted: nine `*Service.ts` files under
  `src/lib/services/`. Server actions delegate to services; API
  routes call the same services. Business logic now lives in one
  place. QBO/time-clock files NOT touched per guardrail.

Curl evidence captured at end of session — every status code
returns the documented envelope; 22 writes in a minute returns 429
on the 21st; idempotency replay returns `idempotency-replayed: true`
header and identical body.

#### Known gap inside the v1 API (intentional, not a bug)

- `POST /api/v1/time-entries/[id]/approve` sets `approved=true,
  qbReady=true` but **does not call `pushTimeActivity`**. That stays
  in the internal flow until the QBO sandbox round-trip is verified.
  External consumers should not assume API-approve = QBO-pushed.
  **TODO before opening the API to outside developers**: add a
  one-line caveat to the endpoint's OpenAPI description, or close
  the gap once QBO is verified (see Section 6).

#### Other deviations (all acceptable)

- `_probe` route renamed to `probe` because Next treats `_`-prefixed
  folders as private/unroutable. Removed before final commit.
- `Document.url` is non-nullable, so pending-file metadata records
  use `url=""` + `pending=true` + response field
  `storageStatus: "pending_no_backend"`.
- OpenAPI spec generated inline (no `zod-to-openapi` dependency).
- Swagger UI from CDN (no `swagger-ui-react`/`redoc` install).
- Office role has read-only visibility on the API keys section.

---

## 5. Door 1: external feed for Henley Tasks (intact, do not change)

Henley Tasks (`https://tasks.henleycontracting.com`) is a SEPARATE
plain-PHP + MySQL task app built by Ayandip. All 15 Henley staff log
in there. Carpenters don't have Hub accounts. The integration is
one-way:

- **Door 1 (Hub → Tasks)**: Tasks pulls projects from Hub via
  `GET /api/external/projects` with `Authorization: Bearer <KEY>`.
  Key lives in `Setting` table (key `HUB_TASKS_API_KEY`) with `.env`
  fallback. Currently used by the production Tasks app.
- **Door 2 was killed earlier.** Hub does NOT read tasks from Worksite.
  `src/lib/worksite.ts` is deleted. Hub has no Tasks page in the
  sidebar.

**This will become relevant again** when/if Nick wants Hub's Dashboard
to show a "tasks past due" count badge — that would require a small
read-only Door 2. Out of scope until requested. Don't bring it up.

---

## 6. What's pending, ordered by priority

### 6.1 QBO sandbox round-trip test — STILL THE CANCELLATION GATE

The single test that's been pending since before this conversation started:

1. `.env` has `QB_ENV=sandbox`. Confirm.
2. Connect QuickBooks as Kyle at `/integrations/quickbooks`.
3. Open `/integrations/quickbooks/employees`, map Jess Whitman to a
   sandbox QBO employee.
4. Pick a project whose client has a `qbCustomerId` (the demo projects
   should; the 299 imported clients do NOT — they would need mapping
   first).
5. Switch role to Jess (FIELD). Open project → Time clock → Clock in,
   wait ~10 seconds, Clock out.
6. Switch back to Kyle. Open project → Time review → Approve the entry.
7. Watch the `npm run dev` terminal for `pushTimeActivity` log output.
8. In QBO sandbox, verify the TimeActivity appears with right
   employee, customer/job, hours, date.

If this passes, Nick can credibly decide on cancelling BuilderTrend.
If it fails, the failure mode determines the next fix (most likely
either employee mapping schema or the QBO customer linkage).

### 6.2 Microsoft 365 — unblock via Azure side

Yash needs to:
1. Find Azure app registration with client ID
   `1b7e8810-43d4-4dd5-a4fa-d5166c077bed` in tenant
   `077d5730-988e-44ac-b44f-555fd97d56c6`.
2. API permissions → Add a permission → Microsoft Graph →
   **Application permissions** → tick `Mail.Read` → Add.
3. Grant admin consent for Henley Contracting (requires Global Admin).
4. Wait ~60 seconds. Hub Test connection should then pass.

### 6.3 Small follow-ups inside v1 API (one short brief each)

- **OpenAPI caveat on `POST /api/v1/time-entries/[id]/approve`**:
  add a `description` field noting "Approves the entry; QBO push is
  NOT invoked from the API in v1. UI approve flow continues to push
  through `pushTimeActivity.ts`." Five minutes.
- **GitHub Actions CI** — add `.github/workflows/ci.yml` that runs
  `npx prisma generate && npx tsc --noEmit && npm run build` on every
  push. Catches compile-time regressions automatically. Half an hour.
- **After QBO sandbox passes**, close the API-approve QBO gap (option A
  from the wrap-up: have the service layer call the QBO push when an
  API approve happens). Half-day brief, low risk once QBO is verified.

### 6.4 Real BuilderTrend-parity gaps (not yet built)

In priority order:

- **Change orders** — Henley demonstrably uses these (demo inbox has a
  "Pantry door header — change order summary" thread). Ride the
  existing Estimate/budget machinery. Quick build, separate session.
- **QBO expense pull** — bills in QBO → `BudgetItem.actualCents`. Job
  costing is half-blind without this. Separate session, AFTER QBO
  sandbox passes.
- **Real scheduling** — calendar/Gantt with start/end dates, sub
  assignments. Bigger build, its own session. Confirm with Nick
  whether his team actually uses BuilderTrend scheduling daily before
  committing to this.

### 6.5 Cosmetic / polish

- Cloud file storage (S3/R2/Azure Blob) — currently `Document.url=""`
  + `pending=true`. Needed before `POST /api/v1/files` can accept
  binary uploads. Multipart endpoint scaffolded with 501-equivalent
  status flag, ready to wire when storage exists.
- Lazy-create-client button on unlinked SMS/voice threads in /inbox
  (so a stranger's text becomes a CRM client only when there's a
  reason). ~30 LOC.
- Polite-error mapping for known Microsoft errors
  (`Authorization_RequestDenied` → "App needs Mail.Read with admin
  consent").

### 6.6 Open architectural questions

- **Monorepo restructure** (Turborepo). Discussed at length. Decision:
  parked. Reasoning: no named second app, "someday maybe" doesn't
  justify a 2-3 day refactor that delivers zero user-visible value.
  Revisit when there's a real second consumer.
- **Postgres migration** (Phase 8). Real prerequisite for deployment.
  Hub currently runs on SQLite locally; the live API surface is
  localhost only. Standalone brief, no restructure required.
- **Hosting / deploy** (Vercel? Railway? Self-hosted?). Open. Linked
  to: subdomain (`hub.henleycontracting.com`?), TLS, QBO production
  OAuth (separate from sandbox), real ENV management.

### 6.7 Real consumers waiting on Hub

- Ayandip's Henley Tasks app — already consumes Door 1, will gain the
  ability to consume v1 endpoints once a key with `projects:read`
  scope is shared. Note: Tasks doesn't need v1 yet; Door 1 is enough
  for the current flow.
- Hub itself in production — same code, different deploy. Pending
  Postgres + hosting decision.
- Anything else: speculative. Don't pre-build for hypothetical
  consumers.

---

## 7. How to operate Cowork on this project safely

### Before any large change

```
cd ~/Documents/henley-hub
git status                          # confirm clean
git pull
git add -A
git commit -m "checkpoint before <thing>" --allow-empty
git push origin claude/henley-hub-platform-2wIAN
```

### Cowork cannot

Run `prisma`, `tsc`, `npm`, curl, or any shell command on your
machine. It can only write/edit files in the repo. **Human runs
verification.** This is by design — the alternative is letting any
prompt injection escalate to arbitrary shell.

After every Cowork phase:

```
npx prisma generate
npx tsc --noEmit
npm run dev                         # smoke test in browser
# then in another terminal:
curl <relevant endpoints>
```

If the phase doesn't appear as a real commit hash in
`git log --oneline -20`, **it didn't ship**, regardless of what
Cowork claims. (Past session: Cowork hallucinated "all phases shipped"
when only Brief 1 commits existed. Do not trust the report; trust the
log.)

### Brief structure that works

Every brief Cowork has executed cleanly follows this shape:

1. Working directory + branch.
2. Hard guardrails (this file's Section 3, repeated verbatim).
3. Goal in one paragraph.
4. Numbered phases. Each phase has: schema deltas (if any), files to
   create / modify / delete, acceptance criteria, commit message.
5. Out-of-scope list. Equally important as the goal.
6. Final verification steps the human will run.

Smaller scope per brief is better. Five phases per brief is the upper
limit. Cowork's claim "everything shipped" is only trustworthy when
each phase has a corresponding commit.

### When Cowork's report and `git log` disagree

`git log` is truth. The chat is fiction. This has happened once
already; it will happen again. Always verify.

### When something looks wrong in the browser

Hard refresh `Ctrl+Shift+R`. Browser cache lies about old CSS in
hh-* design-system work. Past session: spent 10 minutes diagnosing
an "unchanged" UI that was just cached.

---

## 8. Decision log — significant choices made and why

- **Hub on Next.js single app, not monorepo.** No second consumer
  exists; monorepo machinery would optimize for a project ten times
  bigger than Hub.
- **Service layer extracted in v1 API Phase 2.** Both UI and API call
  the same business logic; future restructures move folders, not
  rewrite logic.
- **QBO/time-clock files held back from service extraction.** They
  get a thin shim only until the QBO sandbox round-trip test passes.
- **Door 2 was killed** after building it once. Lesson: don't read
  task data from a separate system; let Tasks be its own master,
  Hub be projects/clients/money master.
- **Read AND write external API** built without a named writer. Cost:
  ~2 days. Benefit: future apps can integrate without us. Worth it
  per Nick's call; flagged as speculative; rate limits + per-endpoint
  scopes keep the surface manageable.
- **Quo API still hits `api.openphone.com`.** Rebrand was UI only.
  Auth header is the bare key, not Bearer.
- **Microsoft 365 needs Application Mail.Read with admin consent.**
  Delegated permissions don't work for server-side mailbox sync.
- **Accent shifted from orange to blue** during the UI cleanup.
  Buttons, primary actions, active nav = blue; pills/badges/chips =
  orange. Both are part of the design system, both correct.
- **Keys NEVER appear in code, briefs, chat, or commits.** They live
  in `.env` (gitignored), the `Setting` table, the `ApiKey` table,
  or in the user's hands. Test keys are generated at runtime.

---

## 9. Quick reference — file locations

| What | Where |
|---|---|
| App routes | `src/app/(app)/...` |
| API v1 routes | `src/app/api/v1/...` |
| Door 1 (legacy external) | `src/app/api/external/projects/route.ts` |
| Service layer | `src/lib/services/*Service.ts` |
| API plumbing | `src/lib/api/{auth,rateLimit,errors,validation,idempotency,scopes}.ts` |
| Quo client | `src/lib/quo.ts` |
| M365 client | `src/lib/microsoft365.ts` |
| QBO (DO NOT TOUCH) | `src/lib/quickbooks.ts`, `src/lib/pushTimeActivity.ts` |
| Design system | `src/app/globals.css` (hh-* classes) |
| Schema | `prisma/schema.prisma` |
| Seed | `prisma/seed.ts` |
| Local DB | `prisma/dev.db` (SQLite, not committed) |
| Env | `.env` (not committed), `.env.example` (committed) |

---

## 10. Three things to ALWAYS check before saying "done"

1. **The commit landed.** `git log --oneline -10` shows the hash.
2. **It compiles.** `npx tsc --noEmit` exits 0.
3. **It runs.** `npm run dev` boots; the affected URL responds; the
   browser shows the expected change after a hard refresh.

If any of those three is missing, the work is not done, no matter
what the chat says.
