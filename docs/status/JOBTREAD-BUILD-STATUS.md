# JobTread Integration — Build Status vs. Brief

Context handoff for the briefing chat. Branch `claude/henley-hub-platform-2wIAN`,
commits `1ed2a2f..2927c6c` (checkpoints `14b9431`, `ba35e3a`). All phases were
executed in one extended session at Nick's direction (brief said one per session).

## Phase status

**Phase A — Connection foundation + Settings card: DONE** (`1ed2a2f`, fixes `43670b2`, `414c557`)
- `JobTreadConfig` singleton, `src/lib/jobtread.ts` (Pave client with grantKey injection, raw-error surfacing, paginated list helper), Settings card with three states, Save & test, field-map display + per-axis manual override dropdowns, key masked.
- Live acceptance met: green test "Connected to Henley Contracting Ltd. — 87 jobs"; all four axes resolved.

**Phase B — Entity sync: BUILT, verification pending** (`f6a972b`, fix `02823c0`)
- JT id columns on Client/Vendor/Project/DailyLog; idempotent syncs for customers (dedupe: jobtreadAccountId → email → name+compatible-phone), vendors, jobs (taxonomy via fieldMap, exact canonical match, unmatched counted; job number → code only when null and non-conflicting), daily logs (author = syncing CEO, JT attribution header, clientVisible=false, P7 structured fields mapped from JT dailyLog custom fields), to-dos counted only. Sync-all + honest summary on the card.
- OUTSTANDING: Nick has not yet supplied the sync summary; second-run zero-diff and dedupe spot-check unverified. The 413 page-size fix (see Deviations) means any sync run before `02823c0` may have failed silently on the customers query — re-run required.

**Phase C — Jobs board: DONE** (`e602e21`)
- `JobView` model, lazy-seeded personal (4) + org (3) views, `JobsBoard` with canonical columns + No Value triage column, zero-count collapse to strips, HTML5 drag persisting via validated CEO/Office-only action, view switcher with create/delete, search, role-scoped page. Five-role browser walk not yet performed.

**Phase D — P2 pipeline absorption: NOT STARTED.** CRM pipeline board untouched; no duplicate implementations were created (the generalized board lives at /jobs/board).

**Phase E — Per-job JT panel: DONE** (`e6a4624`)
- Live to-dos panel on linked project detail (CEO/Office, Suspense-streamed), provenance chip on synced logs, org-wide /jobs/todos page, deep links `https://app.jobtread.com/jobs/{id}` (format verified live). No persistence.

**Phase F — Catalog: DONE** (`010168d`)
- CostType/CostCode/CostItem (cents + bps), `EstimateLine.costItemId/costCodeId`, catalog folded into sync-all, tabbed /jobs/catalog UI with edit sheets, additive draft-estimate line editor with catalog prefill. Manual lines unchanged.

**Phase G — Verification sweep: NOT DONE** (five-role walk, screenshots, double-sync diff).

## Beyond-brief scope (Nick-directed)

- Sidebar restructured: expandable **Jobs** group = Henley's mini-JobTread (`485534c`, `bf4e340`): Dashboard (live status tiles + three pipeline panels + recent logs), **All Jobs** JT-style table, Board, Daily Logs, To-Dos, Catalog, Connection & Sync (absorbed the Settings card; /jobtread redirects).
- **Job cockpit** at /jobs/[id] (`2927c6c`): JT-job-dashboard-style page — editable nine-field panel (Status/Type/PM/Sales Rep/Customer PO + four axes, validated writes incl. new `setProjectMeta` action), money tiles, recent logs, live to-dos; links into existing project modules. Board cards open the cockpit.

## Deviations from the brief (all deliberate)

1. `fieldMap`/`lastSyncSummary`/`JobView.filters` are `String?` JSON, not `Json?` — Prisma 5.22 has no Json type on SQLite (codebase precedent: `ApiKeyAudit.detail`).
2. Pave rejects large nested-connection pages with **HTTP 413**; verified ceilings: size 25 (tasks/accounts/jobs/dailyLogs), 50 (costItems). All queries paginate.
3. Live org facts vs. brief: **174 cost items / 180 cost codes** (brief said 57), cost types all margin 20% non-taxable (brief's 30/42.86 taxable Subcontractor is stale), cost-code numbers are "JT-0100"-style not 1000–9900.
4. Field discovery initially matched "Sales Rep" for pipelineStage (bare-"sales" rule); fixed to prefer "pipeline" (`414c557`) and the stored map was corrected to `Pipeline Stage` (22PYXkS5cN3h).
5. `CONSTRUCTION_PHASE` constant corrected to JT's verbatim "Cleanup, Landscaping & Handoff" (comma); no Hub rows stored the old spelling.
6. Jobs sync also maps the JT "Status" custom field → `Project.status` when the value validates against canonical JOB_STATUS (live values are already OPEN/CLOSED/WARRANTY/PRESALE). Name-resolved, not fieldMap; makes org board views real. Flag if unwanted.
7. Settings sheets are portaled to document.body — `hh-panel`/`hh-row` hover transforms + backdrop-filter trap `position:fixed` descendants (`43670b2`). Same latent bug exists in M365/Quo/HenleyTasks cards (not fixed, out of scope).
8. Schema DDL flow: sandbox couldn't run Prisma engines (blocked binary downloads) nor safely write dev.db (FUSE cache vs. running dev server). Schema changes are applied by Nick via `npx prisma db push` on Windows; sandbox generates the client via engine-path env overrides.

## Guardrail compliance

- QBO/time-clock files untouched; no db:reset; no local task storage (to-dos live-fetched only); no JT write-back; no hardcoded field IDs (fieldMap + name-resolution at sync time); grant key only in the config table (probes read it from dev.db at runtime, never written to source/commits); explicit `git add` throughout.

## Open items

1. Run Sync now twice post-`02823c0`; verify summary (≈369 customers matched-not-duplicated, 363 vendors, 87 jobs linked, 11 logs, 92 to-dos, catalog 174/180/4) and second-run all-unchanged.
2. Phase D absorption of the CRM pipeline board.
3. Phase G full-role verification sweep + screenshots.
4. Brief's open questions for Nick unchanged (write-back default no; No Value triage on Hub; vendor COI expiry tracking priority).
5. Nick's Windows PowerShell 5.1: use `;` not `&&` in any commands you hand him.
