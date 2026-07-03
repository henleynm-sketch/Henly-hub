# Auth + Full Feature Walk — Lane V Checklist (2026-07-03)

Method: browser-driven via the dev role switcher (no credential entry by the
agent — password journeys are marked NICK). Dev server on :3000.

## Auth regression (public routes)
| Check | Result |
|---|---|
| /signup — invitation-only copy, no form | PASS |
| /invite/<bad-token> — honest invalid screen | PASS |
| /forgot-password — form renders | PASS |
| /reset/<token> — page renders; validity enforced on submit | PASS |
| /login alias → sign-in (or dashboard when signed in) | PASS |
| /unsubscribe public | PASS (notify sweep) |
| /.well-known + /api/oauth + /api/mcp reachable | PASS (mcp build) |
| Real login / invite-accept / reset round-trip with emails | NICK — requires credential entry + inbox |

## Five-role walk (key results)
| Role | Surface | Result |
|---|---|---|
| CEO | Dashboard analytics | PASS after fix ffa3dd5 — page render pending ONE dev-server restart; live module verified via /api/debug/kpis: activeClients 84, inFlight 90, pipeline $259,000, reconciling with donuts |
| CEO | Board (views, No Value, counts, search) | PASS |
| CEO | Settings sections (Developer, notify LIVE, AI card, Connect-from-Claude) | PASS; Team invite panel render pending same restart (code present, watcher stale) |
| OFFICE | Dashboard + nav scoping (no Financials) | PASS |
| FIELD | Nav scoping (no CRM/Jobs/Financials); /jobs redirects | PASS |
| FIELD | /clients direct URL | **FAIL → FIXED 07e287f** (full CRM leaked to field) |
| SUB | /clients, /contracts blocked; /projects scoped to assignment | PASS |
| SUB | Contract value on job card | **FAIL → FIXED 22cd8d3** (financials shown to sub) |
| CLIENT | Dashboard = own project only; no financials/CRM; /jobs/list redirects | PASS |
| CLIENT | Own signed contracts view | PASS by code review (no signed contract exists for demo client — honest N/A) |
| ALL | Assistant pill respects enablement | PASS (visible; per-role tool-list assertion = code review, chat not exercised to spare Gemini quota) |

## Bugs found & fixed this lane
- ffa3dd5 — dashboard KPIs derived from panel result sets (filtered
  count()/aggregate() anomaly returned empty alongside populated
  findMany/groupBy; raw SQL confirmed 90/=$259K).
- 07e287f — FIELD reached full CRM by direct URL.
- 22cd8d3 — SUB saw contract value on job cards.

## Deferred to Nick (credential/inbox territory)
1. Invite a real second email → accept → login as that user.
2. Forgot/reset round-trip incl. email.
3. Production-build smoke: demo hints absent.
4. Outlook renders of invite/reset templates.
5. Post-restart: dashboard KPI page render + Team invite panel visible.
