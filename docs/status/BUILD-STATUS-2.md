# Build Status 2 — Location/Weather, CRM Table, Project→Jobs Hierarchy

Handoff for the briefing chat. Follows JOBTREAD-BUILD-STATUS.md. Branch
`claude/henley-hub-platform-2wIAN`, commits `421f881..16bcc9a` (checkpoints
`7209cbc`, `49f54cc`, `ebe92cf`). Nick has run db push/generate through the
location work; the Engagement schema change also requires it (flagged to him).

## Brief: Job Cockpit Location + Site Weather — DONE (4/4 commits)

- `421f881` Phase 1 — Project gains latitude/longitude/geocodedAt/geocodeSource
  (`jobtread|nominatim|manual`) + `taxRateBps @default(1300)`. `src/lib/geocode.ts`
  (Nominatim, UA header, on-demand only, persisted), `src/lib/weather.ts` (WMO→lucide
  table + Open-Meteo fetch with `next.revalidate: 1800`), `geocodeProject` /
  `setProjectTaxRate` actions, address edits clear coords (updateProject + sync),
  jobs sync persists JT location coords (source `jobtread`, never over `manual`,
  idempotency-guarded). Live JT fact: only 11 of 633 locations carry coords.
- `2954788` Phase 2 — LocationCard on cockpit left column: three honest states
  (no-address CTA / Locate-on-map / OSM embed iframe pin), copy address, Google
  Maps deep link, inline tax chip (0–3000 bps validated).
- `94f2150` Phase 3 — WeatherCard (server component, Suspense-streamed): current
  + next-12h strip (precip >20%) + 7-day, renders only with coords, quiet
  failure line. Bonus shipped: FIELD role gets it on assigned project detail.
- `2c7217b` Phase 4 sweep — live-verified Nominatim (Kenstone Beach → plausible
  Kawartha Lakes), Open-Meteo (21.4°C clear at check), OSM embed URL. Sweep fix:
  bare street addresses get an ", Ontario" hint (JT addresses are fully
  formatted; Hub-created ones often aren't). Browser walk left to Nick.
- Note: sandbox couldn't curl either service (egress allowlist) — verified via
  Chrome navigation; the app's server-side fetches run on Nick's machine.

## Brief: CRM Client List Upgrade — DONE (2/2 commits)

- `4735654` Phase 1 — derived rollups per client (openJobs = OPEN+WARRANTY+PRESALE,
  closedJobs = CLOSED, lastActivityAt = max(project.updatedAt, client.updatedAt))
  in constant query count: full client fetch + one `project.groupBy` — in-memory
  sort/paginate (page 50) at Henley scale. No stored counters, no financial
  columns (guardrail). Debounced (350ms) server search component.
- `75f5971` Phase 2 — dense table: Name+stage badge · Primary contact · Email ·
  Location · Open Jobs · Closed Jobs · Last activity; sticky sortable headers
  (name/open/closed/activity), tabular-nums, "N customers" footer, honest empty
  state, mobile open-jobs pill. Count cells deep-link to
  `/jobs/list?clientId=..&bucket=open|closed` (read-only params added to All
  Jobs with a filtered header + clear link). Stage/source chips, pipeline
  kanban, client detail/create untouched.

## Unbriefed (Nick-directed): Project→Jobs hierarchy

Nick's ruling via AskUserQuestion: TRUE hierarchy — a Project is a client
engagement/contract containing Jobs; grouping key = engagement; assignment
manual. Also: "Henley Hub will eventually omit JobTread" — Hub is the
destination system, so surfaces are Hub-native.

- `3398fa3` Phase 1 — new `Engagement` model (displayed "Project"; the legacy
  `Project` model REMAINS the Job because protected QBO/time-clock code depends
  on it — renaming was never on the table). `Project.engagementId` nullable.
  Projects list (/jobs/projects) with open/total rollups + create form;
  detail page with attach/detach (same-client enforced); cockpit "Project"
  panel with honest unassigned state; /projects/new relabeled "New job" with
  optional parent-project picker (client-match validated).
  Zero auto-grouping: all 144 jobs start unassigned (144 shown honestly).
- `16bcc9a` Unification after Nick flagged two "Projects" surfaces: top-level
  Projects nav (CEO/Office) now points at the engagement hierarchy; legacy
  /projects job-card grid redirects there for office roles but SURVIVES for
  Field/Sub/Client (their dashboards + time clock link it); duplicate Jobs
  child removed; cockpit button now "Full job view".

## Naming map (important for future briefs)

- UI "Project" = DB `Engagement` (new).
- UI "Job" = DB `Project` (legacy, untouchable relations: QBO, time clock,
  assignments, logs, budget, threads, documents...). All /projects/[id] deep
  links remain the JOB detail page.

## Open items / debts

1. STILL UNVERIFIED: Phase B sync summary (idempotent second run) — Nick has
   never supplied the summary; the 413 page-size fix (`02823c0`) makes a re-run
   mandatory before trusting earlier syncs. Counts to expect: ~369 customers
   (matched, not duplicated), 363 vendors, 87 jobs, 11 logs, 92 to-dos,
   catalog 174 items / 180 codes / 4 types.
2. Engagement schema needs `npx prisma db push; npx prisma generate` on Nick's
   machine if not yet run (PowerShell 5.1: `;` never `&&`).
3. Hierarchy phase 2 candidates: bulk-attach a client's jobs, estimate/contract/
   financial rollups at project level, engagement status automation, renaming
   the remaining "project" copy on the legacy job detail page.
4. Phase D (CRM pipeline board absorption) and Phase G (full-role sweep +
   screenshots) from the original JobTread brief remain open.
5. JT write-back still parked (default no); No Value triage on Hub; COI expiry
   question unanswered.
