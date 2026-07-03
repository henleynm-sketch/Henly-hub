# Build Status 3 — Multi-Agent Build, Assistant, MCP Connector, Notifications

Handoff for the briefing chat. Follows BUILD-STATUS-2.md. Branch
`claude/henley-hub-platform-2wIAN`, commits `3bc58e3..ffc50df` (~37). tsc clean.
NAMING MAP unchanged: UI "Project" = `Engagement`, UI "Job" = `Project` (legacy).

## Brief: Multi-Agent Build (lanes A–E) — DONE

Executed SERIALLY with disjoint file ownership (deliberate deviation: this
FUSE-mounted workspace corrupted files under a single writer twice; parallel
subagent writers were the one orchestration risk not worth taking).

- **A** `3bc58e3` — dark-mode select fix at element+token level (`color-scheme`
  per theme scope, solid option/optgroup popup tokens); covers all 27 raw-select
  files with zero logic diffs. Later same-family fix: `faa12d8`/`88f773a` —
  `.hh-panel` carries `position:relative` and loads after Tailwind, silently
  killing `fixed`/`absolute` on the same element (assistant panel rendered
  bottom-left in-flow; board dropdown + a toast fixed too; audit found no more).
- **B** `707a9b9`,`7749934` — contracts: lifecycle now DRAFT→SENT→SIGNED→
  DEPOSIT_PAID, order-enforced + audit-logged (manual states until e-sign/
  payment providers chosen); backfill form for REAL historical signed
  agreements (labeled, audited); status filter chips; deposit default from
  Setting `contracts.defaultDepositPct`; CLIENT role sees only own signed
  contracts (list + print gating extended to owner-after-signature).
- **C** `a2a8710` — verified root cause shipped: hard-delete let JT sync
  resurrect vendors → Vendor.archivedAt soft-delete, page filters, sync skips
  archived explicitly. THE REPORTED PAGE ERROR REMAINS OPEN — Arnab never
  supplied console/terminal text; page + tsc statically clean.
- **D** `852a7fe`,`33448e8` — dashboardService single-pass aggregates + recharts
  (exact 3.9.1; `37a067f` added react-is after an interrupted npm install
  dropped it). KPI fixes: "Jobs in flight" counted retired status values
  (always 0); Active clients = clients with ≥1 non-CLOSED job. Panels:
  pipeline $ by stage (client's most-advanced staged job attribution +
  explicit Unstaged bucket), phase/status/division donuts, 8-week trend,
  warranty, vendor compliance, live Henley Tasks snapshot, month-vs-month
  table. Tokens-only colors, reduced-motion honored.
- **E** `7ea751a`,`7e03a96`,`e3a7a6e` — in-Hub assistant: role-scoped tool
  registry over existing services (reads + writes; QBO push/time approval/
  team/API-keys excluded by design), SSE chat route with 8-call cap and
  confirm-before-mutate (pending proposal persisted; new message implicitly
  declines), floating panel with confirm cards + record links, per-user
  threads. Executed mutations audit as `assistant.<tool>`.
- Integration `904e676` + `e4ce077` (mount was inside the NODE_ENV guard —
  JSX error + would've hidden it in prod). Evidence in `VERIFICATION_MA/`.

## Brief: Assistant v1.1 — Phase 1 DONE, Phase 2 BUILT (gated)

- `97b9d25` — "Ask Claude" pill replaces the demo role pill bottom-right;
  role switcher → Settings→Developer (dev builds only); Claude card states the
  two integration directions honestly (no fake "Sign in with Claude" — the
  Messages API takes org keys only).
- Phase 2 built EARLY at Nick's "complete everything": `7e55dcb` OAuth 2.1 AS
  (PKCE S256 only, DCR, exact-redirect, hashed tokens, refresh rotation,
  RFC 8414/9728 metadata, consent over NextAuth session) · `5e20fb2` `/api/mcp`
  streamable-HTTP JSON-RPC over the SAME tool registry (annotations, RFC 9728
  WWW-Authenticate, audits as `mcp.<tool>`) · `221fd63` Connect-from-Claude
  panel (connector URL, grants list, instant revoke). Middleware opened for
  /.well-known, /api/oauth, /api/mcp, /oauth/authorize, /unsubscribe.
  END-TO-END TEST STILL GATED on public HTTPS hosting — panel says so honestly.

## Nick-directed: Universal AI box (supersedes Anthropic-only card)

`ab93c12` + fix train `8142a36`,`85a73fc`,`77577ff`,`6f37ca8`,`e364b0f`:
one key field; provider detected by prefix (sk-ant- / sk- / AIza / **AQ.** —
Google's new key format); live verification before enabling; model auto-
corrects to the provider family and is picked via LIVE model discovery
(Gemini ListModels — Google zeroed free-tier quota on gemini-2.0-flash, static
defaults go stale); Gemini `thoughtSignature` round-tripped on function calls
(2.5+ hard-requires it; sanitized away from Anthropic payloads); pill/panel
take the provider's name (Ask Claude/GPT/Gemini). `db55ecc`: delete-chat +
image attachments (≤3 ×4MB, validated server-side, delivered as anthropic
base64 / openai data-URL / gemini inlineData). NICK'S GEMINI KEY PASSED
THROUGH CHAT — rotation advised, may still be pending. Also `b9ab5f0` closed
original-brief Phase D: /crm renders JobsBoard locked to pipelineStage,
417-line P2 board deleted. `c241cba`: org logo upload (Setting-table base64,
sidebar renders it; R2/S3 migration trivial later).

## Brief: Email Notification System — DONE (4/4 + 3 runtime fixes)

Gate passed first: Nick extended Exchange RBAC — `Test-ServicePrincipalAuthorization`
shows Application Mail.Send InScope=True on HenleyHubMailScope (hello@ only).

- `2b71e6b` rail: Graph sendMail from hello@; Notification/Delivery/
  Unsubscribe tables + Client/Vendor.emailOptOut; dispatcher (immediate
  attempt, 2^n-min backoff, max 5, DB-level dedupe eventType:subject:email:day,
  honest suppression reasons); instrumentation interval (hot-reload safe);
  CEO test-send/flush. Templates+catalog live in the same lib.
- `673a51e` catalog: emits wired — client-visible daily log, estimate
  SENT/ACCEPTED, contract SENT/SIGNED, job stage change (opt-in), inbound
  inbox message; daily sweeps — milestone T-2 (client-visible), vendor COI
  expiring/expired, W-9 monthly nudge (org toggle), CEO time-approval digest.
  Resolution at SEND time: visibility recheck → user pref/org default →
  client/vendor optOut → HMAC unsubscribe (public confirm page, scanner-safe)
  → master switch. DORMANT HONESTLY: SELECTION_* (Selections module has no
  dueDate), JOB_ASSIGNED/VENDOR_ASSIGNED (no assignment actions exist yet).
- `26b70fd` UI: notifications grid extended (legacy rows kept; SMS column
  reserved for the Quo brief), kill switch + test + flush, delivery log
  (last 100, real rows), client/vendor opt-out toggles.
- Fixes: `29c7f8d` settings survives stale prisma client pre-restart;
  `ffc50df` unsubscribe HMAC moved to Web Crypto — instrumentation also
  bundles for Edge where node:crypto can't resolve (runtime guards can't
  prevent static resolution).

## Open items

1. Nick mid-verification: db push/generate/restart done; the Send-test-email
   → Outlook receipt is the current step; then client-visibility-flip and
   vendor unsubscribe round-trips (VERIFICATION_NOTIFY/README.md).
2. Arnab's vendors error text (Lane C reported crash) — still never supplied.
3. Hosting decision → unlocks MCP connector end-to-end + real base URL for
   email deep links (currently Setting org.baseUrl → env → localhost).
4. Gemini key rotation (leaked into chat transcript).
5. Five-role browser walk + screenshots (Phase G + multi-agent evidence).
6. Original open questions: JT write-back (default no) · No Value triage venue ·
   COI tracking priority — now partly answered by the notify brief shipping
   COI emails.
7. PowerShell 5.1 reminder stands; also remind Nick to run commands FROM the
   repo folder (one failed db push was just wrong cwd).
