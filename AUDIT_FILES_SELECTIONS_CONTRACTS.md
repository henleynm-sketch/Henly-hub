# Audit — Files, Selections, Contracts vs Master spec

**Brief 1 — reconnaissance only. Read-only. No code, schema, or config changed.**

Date: 2026-06-18
Branch: `claude/henley-hub-platform-2wIAN`
Scope: report the true current state of the **Files**, **Selections**, and
**Contracts** features against the spec, so later briefs build only what is
genuinely missing.

## Method & sources

There is no single file literally named "Master Document" in the repo. The
spec for these three features is distributed across two committed documents,
which this audit treats jointly as the master spec:

- `BACKLOG.md` → "Henley Hub (platform) → Next up" — the one-line spec for
  each of the three features.
- `HENLEY_HUB_CONTEXT.md` — the project handoff doc (§4 "What's built",
  §6.4 "Real BuilderTrend-parity gaps", §6.5 "Cosmetic / polish").

The "Repo actually has" column is taken directly from reading the code listed
below. Every path and field name cited was read during this audit.

Files inspected:

- `prisma/schema.prisma` (models `Document` L161, `Selection` L121,
  `Contract` L237, plus `Estimate` L207 / `EstimateLine` L226 /
  `ProjectAssignment` L98)
- `src/app/(app)/files/page.tsx` (318 lines)
- `src/app/(app)/selections/page.tsx` (16 lines)
- `src/app/(app)/contracts/page.tsx` (181 lines)
- `src/app/(app)/contracts/[id]/page.tsx` (212 lines)
- `src/app/print/contracts/[id]/page.tsx`
- `src/lib/services/fileService.ts` (86 lines) — the only service of the three
- `src/lib/roles.ts`
- Call sites: `src/app/(app)/projects/[id]/page.tsx`,
  `src/app/(app)/dashboard/OfficeDashboard.tsx`, `src/components/Sidebar.tsx`,
  `src/app/api/v1/files/**`, `src/app/api/admin/export/route.ts`

Note on the service/action layer: there is **no** `src/lib/actions/`
directory. Server actions are colocated inside the page files as
`"use server"` functions. Only `fileService.ts` exists; there is **no**
`selectionService.ts` and **no** `contractService.ts`.

---

## 1. Files

**Verdict: real, working flow.** Local-disk storage, role-aware visibility,
upload/share/delete all functional. The gap vs spec is the storage backend,
not the feature.

### Schema — `Document` (`prisma/schema.prisma` L161–175)

`id`, `projectId String?` (nullable), `project Project?`, `name`, `kind`
(CONTRACT | PLAN | PERMIT | INVOICE | PHOTO | OTHER), `url` (non-nullable;
`""` while pending), `mimeType String?`, `pending Boolean @default(false)`,
`sizeBytes Int?`, `clientVisible Boolean @default(false)`,
`uploadedById String?`, `uploadedBy User?`, `createdAt`.

| Master spec says | Repo actually has | Gap |
|---|---|---|
| "Files module: per-project library with role visibility (R2/S3)" (`BACKLOG.md`) | `/files` page lists documents grouped per project, filtered by `kind` chips; daily-log photos surfaced per project. (`files/page.tsx`) | None on the per-project library itself. |
| Cloud storage (S3/R2/Azure Blob) (`HENLEY_HUB_CONTEXT.md` §6.5) | Binary written to **local disk** at `public/uploads/documents/` via `fs/promises.writeFile` in the `uploadDocuments` server action; `Document.url` points at `/uploads/documents/<uuid>`. (`files/page.tsx` L18, L105–122) | **Cloud backend not wired.** Disk storage is not production-portable. |
| Role visibility | Enforced in the page: project scope via `canViewAllProjects` else `assignments.some.userId`; CLIENT sees `clientVisible:true` only; SUB restricted to `SUB_KINDS` (PLAN/PERMIT/PHOTO/OTHER). Upload gated to CEO/OFFICE/FIELD; FIELD additionally checked against `ProjectAssignment`. Share/hide/delete gated to CEO/OFFICE. (`files/page.tsx` L51–60, L82–157) | None — role + ProjectAssignment checks are present and correct. |
| Metadata-only registration for API uploads | `createFileMetadata` creates row with `url=""`, `pending=true` for the v1 API (no binary). (`fileService.ts` L29–50) | Intentional gap pending storage backend (documented). |
| API surface | `src/app/api/v1/files/route.ts`, `.../files/[id]/route.ts`, `.../projects/[id]/files/route.ts` exist. | (Not behavior-audited in this brief.) |

**Service-layer note:** `fileService.ts` performs validation
(`ValidationError`/`NotFoundError`) but **no auth/role/assignment checks** —
all authz lives in the page server actions. Acceptable today (single UI
caller) but the service is not self-guarding if reused.

---

## 2. Selections

**Verdict: stub + read-only display.** The dedicated route is a "Coming
soon" placeholder. Selections are *displayed* read-only in two places and
counted on the dashboard, but there is **no create / edit / approve /
deadline flow anywhere**.

### Schema — `Selection` (`prisma/schema.prisma` L121–131)

`id`, `projectId`, `project Project`, `category`, `option`,
`priceCents Int @default(0)`, `status String @default("PROPOSED")`
(PROPOSED | APPROVED | REJECTED), `decidedAt DateTime?`, `notes String?`.

| Master spec says | Repo actually has | Gap |
|---|---|---|
| "Selections module: client-facing **approval flow with deadlines**" (`BACKLOG.md`) | `src/app/(app)/selections/page.tsx` is a 16-line `<ComingSoon>` placeholder (the only `ComingSoon` use in the app). | **Entire feature unbuilt.** No page UI beyond the pitch. |
| Client approves / rejects with comment (`ComingSoon` pitch text) | No approve/reject action exists. `status` and `decidedAt`/`notes` fields exist on the model but nothing writes them through a UI or service. | **No write path** — model fields are unused by any flow. |
| Reminders when deadline approaching | **No deadline/dueDate field on `Selection`** at all. | Schema gap: needs a `dueDate` (and likely `clientVisible`, `createdAt`) before deadlines/reminders are possible. |
| Approved selections roll into project budget | No link between `Selection` and `BudgetItem`; nothing reads approved selections into budget. | Not built. |
| Read surfaces | Read-only list on project detail (category/option/status badge only — `projects/[id]/page.tsx` L467–484); dashboard "Selections needing a decision" count + recent-activity feed (`OfficeDashboard.tsx` L98, L111, L145–152, L271–272); included in admin export (`api/admin/export/route.ts` L26). | These are display/count only — not the approval flow. |
| Navigation | Sidebar shows "Selections" **only to the CLIENT role**, with a `badge: "soon"` (`Sidebar.tsx` L69). Internal roles have no Selections nav entry. | Consistent with stub status. |

**No `selectionService.ts`.** No `"use server"` selection actions anywhere.

---

## 3. Contracts

**Verdict: real, substantial flow.** Estimate→Contract conversion,
versioning, status lifecycle, and print/PDF all work. Gaps are e-signature
and deposit collection (both explicitly stubbed in the UI).

### Schema — `Contract` (`prisma/schema.prisma` L237–262)

`id`, `number @unique`, `version Int @default(1)`, `clientId` + `client`,
`projectId String?` + `project Project?`, `estimateId String?` +
`estimate Estimate?`, `authorId` + `author`, `title`,
`status String @default("DRAFT")` (DRAFT | SENT | SIGNED | VOID),
`subtotalCents`, `taxCents`, `totalCents`, `depositCents Int @default(0)`,
`terms String?`, `sentAt DateTime?`, `signedAt DateTime?`,
`signedByName String?`, `qbInvoiceId String?`, `createdAt`, `updatedAt`.
`Estimate` has `contracts Contract[]` (L221).

| Master spec says | Repo actually has | Gap |
|---|---|---|
| "Build out Contracts stub: **Estimate → Contract conversion**" (`BACKLOG.md`) | `convertEstimate` server action: picks an ACCEPTED estimate not already under a non-VOID contract, snapshots totals, computes deposit from a % dropdown, auto-numbers `CT-<n>`, sets `version`, optionally links a project (only if `project.clientId === estimate.clientId`). (`contracts/page.tsx` L31–86) | **Done.** Conversion is fully built, including per-project versioning. |
| "**PDF**" | `/print/contracts/[id]` renders a print-styled, financials-gated page with a `PrintButton`; detail page links to it as "Print / PDF". (`print/contracts/[id]/page.tsx`; `contracts/[id]/page.tsx` L79–81) | Browser print-to-PDF only; no server-generated PDF artifact. Likely sufficient. |
| "**e-sign**" | Manual signature capture only: `markSigned` records a typed `signedByName` + `signedAt`, status → SIGNED. UI caption: "E-signature via DocuSign plugs in here later." (`contracts/[id]/page.tsx` L51–62, L156) | **No real e-signature integration** (DocuSign etc.). Manual record only. |
| "**deposit**" | `depositCents` computed at conversion and shown as "Deposit due on signing." QuickBooks card has a **disabled** "Create QB invoice (setup required)" button. (`contracts/page.tsx` L80; `contracts/[id]/page.tsx` L197–207) | Deposit is **recorded but not collected** — no invoice/payment-link generation. `qbInvoiceId` field exists but is never written. |
| Status lifecycle | `markSent` (DRAFT→SENT), `markSigned` (SENT→SIGNED), `voidContract` (→VOID); version list per project. All gated by `canSeeFinancials`. (`contracts/[id]/page.tsx` L43–70, L178–195) | **Done.** |
| Visibility / role | List + detail + print all require `canSeeFinancials` (CEO/OFFICE only). Clients cannot see contracts. (`roles.ts` L16–18; both pages) | Gated by role; **no ProjectAssignment scoping** (contracts are office-level, not per-assignee — acceptable by design). |

**No `contractService.ts`.** All logic is in the two page files'
`"use server"` actions; authz is `canSeeFinancials` checked inside each action.

---

## What to build — prioritized per feature

### Selections (largest gap — effectively greenfield)

1. **Schema delta first:** add `dueDate DateTime?` (and likely `clientVisible
   Boolean`, `createdAt DateTime`) to `Selection`; consider a `decidedById`
   for audit. Use `npx prisma db push` (never `db:reset`).
2. **`selectionService.ts`** — create/update/approve/reject with validation,
   mirroring `fileService.ts` patterns.
3. **Internal management UI** — replace the `ComingSoon` page: per-project
   selection sheet by category, create/edit options with price + deadline.
4. **Client approval flow** — approve/reject with comment, writing `status` +
   `decidedAt` (+ comment to `notes`).
5. **Budget roll-up** — link approved selections into `BudgetItem`.
6. **Deadline reminders** — depends on step 1's `dueDate`.
7. Flip Sidebar nav from CLIENT-only `"soon"` to all relevant roles.

### Contracts (mostly built — close two gaps)

1. **Deposit collection via QuickBooks** — wire the disabled "Create QB
   invoice" button to generate a deposit invoice + payment link, persisting
   `qbInvoiceId`. **Gated by the QBO sandbox round-trip test** (see
   `HENLEY_HUB_CONTEXT.md` §6.1); do not call QBO push from the service layer
   until that passes. Respect the QBO guardrail files.
2. **Real e-signature** — DocuSign (or equivalent) integration to replace the
   manual `signedByName` capture.
3. *(Optional)* extract a `contractService.ts` so UI and any future API share
   one code path, consistent with the v1 service-layer pattern.

### Files (working — one real gap)

1. **Cloud storage backend (R2/S3/Azure Blob)** — replace local-disk
   `public/uploads/documents/` writes; this also unblocks the v1
   `POST /api/v1/files` binary path (currently `pending=true`, `url=""`).
2. *(Optional, hardening)* move role/assignment checks into `fileService.ts`
   so the service is self-guarding if reused beyond the current page.

---

*Out of scope for Brief 1: building or fixing anything. This document is the
only artifact produced.*
