# Bug Report — End-to-End Functional Test Run

**Date:** 2026-10-25
**Tester:** Claude (automated E2E via Chrome DevTools MCP)
**App:** Resultiq — DBATU Result Analysis System
**Stack:** Next.js frontend (`:3000`) + NestJS backend (`:3001/api/v1`) + PostgreSQL (Neon) + Redis (BullMQ) + HuggingFace Inference (OCR)
**Base URL:** http://localhost:3000
**Account used:** `admin@dbatu.edu` (SUPER_ADMIN, seed) + a freshly invited `teacher.e2e@dbatu.edu` (TEACHER)

---

## Environment / Setup Findings

| # | Area | Severity | Finding |
|---|---|---|---|
| ENV-1 | Tooling | Info (fixed) | `pnpm-workspace.yaml` shipped with `allowBuilds` values set to the placeholder string `"set this to true or false"` (written by pnpm itself when it skips a build). pnpm 9.12.3 only recognises literal `true`/`false` — its `createAllowBuildFunction` has `case true` / `case false` and **no default case**, so any other value silently drops the package from the allowed set. Result: **no** package build scripts ran, `bcrypt` never produced its JS entry files (`bcrypt.js`, `lib/bcrypt.js`), and the backend could not boot (`Cannot find module '.../bcrypt/bcrypt'`). Fixed by setting every `allowBuilds` value to `true`. The neighbouring `onlyBuiltDependencies` list is **not implemented at all** in pnpm 9.12.3 (only 3 textual occurrences in the whole bundle), so it had no effect either way. |
| ENV-2 | Database | **Blocker — fixed in code, awaiting deploy** | Prisma migration `20260101000200_add_password_reset_tokens` (which creates the `password_resets` table) is **committed but not applied** to the Neon database. `prisma migrate status` reports it as "not yet applied". Every password-reset request therefore fails with a 500. See **BUG-1**. **Note:** the project pins Prisma 5.8 — run `npx prisma migrate deploy` from `apps/backend`. A global Prisma 7 on `PATH` reports `COMMAND_MOVED` and does not understand this project's migration folder. |

---

## Test Coverage

| # | Flow | Result |
|---|------|--------|
| 1 | Admin login (seed credentials) | **PASS** |
| 2 | Login validation — empty / bad password / unknown email | **PASS** (400 validation errors; 401 "Invalid credentials" for both wrong password and unknown email — no user enumeration) |
| 3 | Forgot-password → reset link email | **FAIL** — BUG-1 (500, missing table) |
| 4 | Change-password — weak password rejected | **PASS** (client + server validation) |
| 5 | Change-password — valid password | **NOT COMPLETED** — blocked by sandbox policy (would have changed the seeded admin credential and broken every later test) |
| 6 | Members list (Members tab) | **PASS** (2 active members; invited-but-not-accepted members correctly excluded) |
| 7 | Invite member — create, role, branch, email sent | **PASS** (row created PENDING, **email verified in Ethereal inbox**, correct role/branch/expiry in the rendered email body) |
| 8 | Invite — copy invitation link | **PASS** (toast "Invitation link copied") |
| 9 | Invite — resend | **PASS** (toast "Invitation resent"; second email arrived in Ethereal) |
| 10 | Invite — revoke | **PARTIAL** — backend works (status → REVOKED), UI does not refresh — BUG-5 |
| 11 | **Accept invitation** → set password → auto-login | **PASS** (Ethereal link → pre-filled form → account created → auto-logged in to `/dashboard`) |
| 12 | Pending invitations tab | **PASS** (table with copy/resend/revoke actions) |
| 13 | Roles tab | **PASS** (6 roles, correct permission counts: SUPER_ADMIN 29, ADMIN 22, HOD 16, TEACHER 10, PRINCIPAL 10, STUDENT 1) |
| 14 | **Member edit page** | **FAIL** — BUG-6 (page crashes) + BUG-7 (password hash leak) |
| 15 | **TEACHER RBAC — positive** | **PASS** (correct sidebar, `/auth/me` returns role TEACHER + branchId CS + exactly 10 expected permissions) |
| 16 | **TEACHER RBAC — negative** | **PASS** (`/users/members`, `/invites`, `/roles`, `/audit-logs` → **403 "Insufficient role"**; `/students`, `/reports`, `/upload/jobs` → 200) |
| 17 | TEACHER logout | **PASS** (204) |
| 18 | TEACHER login with new password | **NOT COMPLETED** — blocked by sandbox policy (credential submission) |
| 19 | Students list | **PASS** (11 rows, search filter works) |
| 20 | Student create | **PASS** (201, row appears); duplicate roll number → **FAIL** — BUG-14 |
| 21 | Student edit | **PASS** (form pre-populated, PUT 200, persists across reload) |
| 22 | **Student delete** | **FAIL** — BUG-2 (row stays visible, no toast, no error) |
| 23 | **Student CSV bulk import** | **FAIL as shipped** — BUG-3 (no Batch select) + BUG-4 (errors invisible) |
| 24 | **Upload Results — page** | **FAIL** — BUG-8 (uploader permanently disabled) |
| 25 | **Upload Results — CSV / text PDF / image PDF** | **FAIL** — BUG-9 (400 on every upload) |
| 26 | **Upload job → extraction** | **FAIL** — BUG-10 (401, worker cannot fetch its own file) |
| 27 | **OCR path (image PDF)** | **FAIL** — blocked behind BUG-10; HuggingFace call never reached |
| 27a | CSV extraction engine (isolated) | **PASS** — parser fetches, sniffs the header and rejects a bad sheet with a precise message; see BUG-18 note |
| 27b | PDF text-extraction engine (isolated) | **PASS** — `pdf-parse` extracts the text layer, header detection works; see BUG-18 note |
| 28 | Dashboard | **PASS** (KPIs, recent uploads list shows the failed `marks-text.pdf` job correctly) |
| 29 | Reports — generate | **PASS** (job created → READY) |
| 30 | Reports — list / status | **PARTIAL** — status does not update live — BUG-11 |
| 31 | Reports — download | **PASS** (12,141-byte valid `.xlsx`, magic `PK\x03\x04`, correct MIME, "Report downloaded" toast) |
| 32 | Toppers — Subject toppers tab | **PASS** (filters work, empty state correct) |
| 33 | Toppers — Class toppers tab | **PASS** (ranking table, tie handling shown as "Tied") |
| 34 | Analytics | **PASS** (4 KPI tiles, pass/fail + subject difficulty panels, performance-trends chart renders) |
| 35 | Schemes list + rules disclosure + edit | **PASS** (JSON rules render, form pre-populated, invalid-JSON rejected with an inline message, PUT 200 persists) |
| 36 | Scheme edit — stale validation error | **FAIL** — BUG-12 |
| 37 | Audit log | **PASS** (15 entries; LOGIN / INVITE_SENT / INVITE_RESENT / INVITE_ACCEPTED all recorded) |
| 38 | Notifications endpoint | **PASS** (200, empty) |
| 39 | Subjects / branches / schemes / academic years reference data | **PASS** |
| 40 | Revoked-invite link is rejected | **PASS** (backend checks `status !== 'PENDING'`) |
| 41 | `POST /upload` — declared `fileType` vs. actual queue | **FAIL** — BUG-15 (the declared type is ignored for routing) |
| 42 | `POST /ocr/extract` (manual OCR trigger) | **FAIL** — BUG-16 (always 500) |
| 43 | `POST /ocr/process/:jobId` ("re-run OCR") | **FAIL** — BUG-17 (returns 201 but does nothing) |
| 44 | Access-token refresh / rotation | **PASS** (200, new access **and** refresh token issued) |
| 45 | Analytics & Toppers endpoints (re-verified) | **PASS** (all 7 return 200 with correct data after a fresh login) |
| 46 | Member deactivate | **PASS** (row flips to "Deactivated" live, persists, excluded from the active roster, and the user can no longer log in) |
| 47 | **Deactivated user's existing access token** | **FAIL** — BUG-19 (the token keeps working for up to 15 minutes) |
| 48 | Change-password — validation | **PASS** (wrong current password → 400 *"Your current password is incorrect"*; weak password → 400 with the policy message) |
| 49 | Member deactivate | **PASS** (row flips to "Deactivated" live, persists, excluded from the active roster, and the user can no longer log in) |
| 50 | **Scheme create** | **FAIL** — BUG-20 (no create route, no button; the API endpoint works) |

**Not reachable / not tested:** the HuggingFace OCR call itself (blocked behind BUG-10/BUG-16), the
"Confirm and save" upload step (blocked behind BUG-9), the reset-password completion step (blocked behind
BUG-1), and logging in with the new TEACHER password (blocked by sandbox policy).

**False alarms ruled out (tested and NOT bugs):** seven analytics/toppers endpoints returned 401 mid-run;
this was **not** an RBAC defect — the 15-minute access token had simply expired (`/auth/me` returned
`perms: []`). After re-login and token refresh, **all seven returned 200 with correct data**
(`/analytics/pass-fail` → `totalStudents 1, passPercentage 100`; `/toppers/class` → rank 1 TCS002
Vivaan Patel E2E, 38/45, 84.44%). The refresh-token rotation endpoint also behaves correctly
(`POST /auth/refresh` → 200 with a new access token **and** a new refresh token).

---

## Bugs

### BUG-1 — Password-reset flow is completely broken (missing DB table) — **Critical**

**Severity:** Critical (feature 100% non-functional)

`POST /api/v1/auth/forgot-password` returns **HTTP 500**:

```
Invalid `this.prisma.passwordReset.deleteMany()` invocation in
apps/backend/src/modules/password-reset/password-reset.repository.ts:10:37
The table `public.password_resets` does not exist in the current database.
```

**Root cause:** the Prisma migration `20260101000200_add_password_reset_tokens` that creates
`password_resets` is committed under `apps/backend/prisma/migrations/` but was **never applied** to the
Neon database. `prisma migrate status` confirms:

```
3 migrations found in prisma/migrations
Following migration have not yet been applied:
20260101000200_add_password_reset_tokens
```

The `PasswordReset` model exists in `schema.prisma` (lines 51–64) and the controller/service/repository are
all wired up — only the table is missing.

**Impact:** the whole "forgot password" journey — request link, receive email, set new password — is dead.
The UI shows the generic *"We could not process your request. Please try again in a moment."*

**Fix:** `npx prisma migrate deploy` (or `migrate dev`) against the target database.

---

### BUG-2 — Deleting a student does nothing visible — **High**

**Severity:** High (data-integrity / destructive-action UX)

Clicking the row's trash button issues `DELETE /api/v1/students/:id` → **200** with
`{"success":true}`, but the row **stays in the list**. There is no toast and no error.

Reproduced live in this run with a real click on `TCS010 Neha Gupta`:

1. Click the row's trash button → the browser `confirm("Delete Neha Gupta?")` dialog appears and is accepted
2. Wait 2.5 s → the table still shows **11 rows**, `TCS010` is still rendered, **no toast**
3. `GET /api/v1/students?pageSize=50` → `total: 11`, `inactive: ["TCS001", "TCS010", "TEST001"]`, `activeCount: 8`

So the **backend did the delete correctly** — `TCS010` came back with `isActive: false` — but the API
still returns it in the list and the UI still renders it as a normal, editable row.

**Root cause:** `DELETE` performs a **soft delete** — `apps/backend/src/modules/students/students.repository.ts:102-107`:

```ts
async softDelete(id: string, _deletedBy: string): Promise<void> {
  await this.prisma.student.update({ where: { id }, data: { isActive: false } });
}
```

but the list query never filters on it. `students.repository.ts:41-52` builds the Prisma `where` clause
from `branchId / schemeId / currentYear / semester / academicYearId / search` only — **there is no
`isActive: true` filter**, so soft-deleted students are returned. The frontend does not filter on
`isActive` either, and the response **does** carry the flag (`isActive: false`), so the client has the
information and simply does not use it.

**Impact:** deleted students remain in the roster **and in every report, topper list and analytics
figure** that is computed from the same unfiltered query.

**Note:** the delete button *does* have a confirmation step — a native `window.confirm` dialog — so the
"no confirmation" concern does not apply here.

**Fix:** add `where.isActive = true` to `StudentsRepository.findAll` (and to the report/analytics queries
that read students).

---

### BUG-3 — Student CSV import cannot be completed from the UI (no Batch scope) — **High**

**Severity:** High (core feature unusable)

`POST /api/v1/students/bulk-import/file` rejects the file with **400**:

- with only Year+Semester → `"Row 1 is missing: branch, scheme, batch, academic year. Supply the scope for the whole file or on each row."`
- with Branch + Scheme + Academic year supplied → `"Row 1 is missing: batch. Supply the scope for the whole file or on each row."`

The error narrows to **batch**, but the import page has **no Batch select**. The page renders exactly five
selects — Branch, Scheme, Academic year, Year, Semester — and the page copy even says *"Any other scope
columns are optional — whatever you leave blank here is read from the sheet."* A sheet `Batch` column is
only honoured if it contains a **UUID** (`asUuid()` in `student-import.parser.ts` rejects plain names), which
is impractical for a hand-authored CSV.

**The backend logic is fine.** The same request was sent twice, changing **only** `batchId`:

| Request | Result |
|---|---|
| `POST /students/bulk-import/file?branchId=…&schemeId=…&academicYearId=…&currentYear=1&semester=1` | **400** — `"Row 1 is missing: batch. Supply the scope for the whole file or on each row."` |
| the same request **+ `&batchId=batch-87dec0a4-e12c-46dc-9404-5c5e8085e729`** | **201** — `{"inserted":2,"failed":0,"errors":[]}` ✅ |

**Root cause:** `apps/frontend/app/(authenticated)/students/import/page.tsx` never renders a Batch select
and never sends `batchId`, even though `BulkImportScope` in `lib/services/students.service.ts` already
declares `batchId?: string` and the backend controller already accepts `@Query('batchId')`.

Everything needed is already in the codebase — the import page just does not use it:

- `hooks/useAcademic.ts:26` — a `useBatches` hook already exists
- `lib/api/endpoints.ts:36` — `BATCHES: '/academic/batches'` already exists
- `GET /api/v1/academic/batches` → **200** with `[{ id: "batch-87dec0a4-e12c-46dc-9404-5c5e8085e729", name: "2024-25 cohort", isActive: true }]`
- `components/forms/StudentFormFields.tsx:74,148-155` — the **create/edit** form already renders a Batch select

The import page (`students/import/page.tsx`) is the only one of the three that does not.

**Fix:** add a Batch select to the import page (populate it from `GET /academic/batches`), and include
`batchId` in the scope object sent to the API.

---

### BUG-4 — Student-import errors are swallowed entirely — **High**

**Severity:** High (silent failure — user gets no feedback)

On a failed import the page **does not change at all**: no error text, no toast, no inline message, no
result panel. The only trace is the browser console line
`Failed to load resource: the server responded with a status of 400 (Bad Request)`.

**Root cause:** the `useImportStudents` hook only implements `onSuccess`, so the API's detailed message
(`"Row 1 is missing: batch. …"`) is never surfaced. The result panel — which renders
*"Imported N students · M rows failed"* plus per-row `Row {n}: {error}` — is only populated on success, so
the built-in per-row error reporting never displays for a whole-file rejection.

**Fix:** wire `onError` to render `error.message` in the result panel, and surface per-row errors on
partial success.

---

### BUG-5 — Revoking an invitation does not refresh the UI — **Medium**

**Severity:** Medium (stale state, misleading)

Clicking **Revoke** on a pending invitation leaves the row showing **PENDING** — no status change, no
toast, no error. A direct API read confirms the operation *did* succeed:

```
POST … → invite id d205… status: PENDING
(after clicking Revoke) GET /api/v1/invites → status: REVOKED
```

So the backend is correct and the list query simply is not invalidated/refetched after the mutation.

**Related observation:** the pending-invitations list also shows a stale `REVOKED` row for
`teacher.e2e@dbatu.edu` even though that invite was **ACCEPTED** — i.e. superseded invites are not
distinguished from live ones.

**Fix:** invalidate the invites query after revoke/resend; hide superseded (non-PENDING) invites or label
them clearly.

---

### BUG-6 — Member edit page crashes — **High**

**Severity:** High (admin page unusable)

Opening `/admin/members/:id/edit` renders the global error screen:

> Something went wrong — We hit an unexpected error rendering this page.
> **Cannot read properties of undefined (reading 'length')**
> [Retry]

**Root cause:** `apps/frontend/components/forms/MemberFormFields.tsx:176` reads `member.roles.length`, but
`GET /api/v1/users/:id` **does not return a `roles` field at all**:

```
GET /api/v1/users/:id → { id, email, name, passwordHash, isActive, lastLoginAt, createdAt, updatedAt,
                           createdBy, updatedBy, mustChangePassword, invitedById, invitedAt }
                           // no "roles"
```

`GET /api/v1/users/members` *does* return `roles` (array of `{ roleName, branchId }`) — only the
single-member endpoint omits it.

**Fix:** include the `roles` relation in `users.repository.ts:74-76` (`findById`), or make the frontend
tolerate a missing `roles` array.

---

### BUG-7 — `GET /api/v1/users/:id` leaks the bcrypt password hash — **Critical (security)**

**Severity:** Critical — OWASP A02: Cryptographic Failures / A01: Broken Access Control

`GET /api/v1/users/:id` returns the raw Prisma user row, including:

```json
{ "id": "…", "email": "teacher.e2e@dbatu.edu", "name": "…",
  "passwordHash": "$2b$12$<REDACTED>", … }
```

`PUT /api/v1/users/:id` returns the same shape — the hash is echoed back on update too.

**Root cause:** `apps/backend/src/modules/users/users.repository.ts:74-76` uses a bare
`prisma.user.findUnique({ where: { id } })` with **no `select`** and **no `omit`**, so every column —
including `passwordHash` — is serialised to the client. The list endpoint `findMembers` does not have this
problem (its rows contain no `passwordHash`).

**Fix:** select only the safe columns explicitly (e.g. `select: { id, email, name, isActive, lastLoginAt,
createdAt, updatedAt, mustChangePassword, roles: { include: … } }`), or add a `passwordHash` omit to the
response mapping. Apply the same to the update path.

---

### BUG-8 — Upload Results page is permanently disabled — **Blocker**

**Severity:** Blocker (the whole Upload Results module is unusable from the UI)

On a fresh load of `/upload`, the Academic year select **displays** `2024-25` but the upload control stays
disabled — the drop zone is greyed out, *"Click to upload"* is disabled, and
`input[type=file].disabled === true`. The hint *"Pick a branch, scheme and academic year before uploading"*
stays visible.

Reproduced with a real interaction, not just code reading:

1. Fresh load → Branch "Select branch", Scheme "Select scheme", Academic year **"2024-25"** (displayed),
   `fileDisabled: true`
2. Select Branch = CS, Scheme = SCHEME_2024 → still `fileDisabled: true`, hint still shown
3. Open the Academic-year dropdown (the only option is `2024-25`) and click it explicitly → **still**
   `fileDisabled: true`

**Root cause:** `apps/frontend/app/(authenticated)/upload/page.tsx`

```ts
const scopeReady = !!branchId && !!schemeId && !!academicYearId && semester > 0;   // line 56
…
value={academicYearId || activeYear?.id || ''}                                       // line 112
```

The select's *displayed* value falls back to `activeYear?.id`, but the `academicYearId` **state stays
`''`** — it is only ever set by `onChange`. Radix Select does not fire `onValueChange` when the
re-selected value equals the current one, and 2024-25 is the **only** academic year in the database, so
the user can never change it and can never satisfy `scopeReady`.

**Impact:** with a single academic year, **no admin can use the Upload Results page at all.**

**This bug is isolated to this one page — the correct pattern already exists elsewhere in the codebase:**

| Page | Initialises the state correctly? |
|---|---|
| `app/(authenticated)/reports/page.tsx:76` | **Yes** — `const effectiveAcademicYearId = academicYearId \|\| activeYear?.id \|\| ''` and `scopeReady` uses that variable (line 78) |
| `app/(authenticated)/students/import/page.tsx:37` | **Yes** — `useState(activeYear?.id ?? '')` |
| `app/(authenticated)/upload/page.tsx:56` | **No** — `scopeReady` reads the raw `academicYearId` state, which is never initialised |

**Fix:** copy the Reports page pattern — derive the effective id and use it in `scopeReady`:

```ts
const effectiveAcademicYearId = academicYearId || activeYear?.id || '';
const scopeReady = !!branchId && !!schemeId && !!effectiveAcademicYearId && semester > 0;
```

Note that line 112 (`value={academicYearId || activeYear?.id || ''}`) must also change to
`value={effectiveAcademicYearId}`, otherwise the select's value and the state drift apart.

---

### BUG-9 — Every file upload returns 400 "fileUrl must be an absolute URL" — **Blocker**

**Severity:** Blocker (all uploads rejected: CSV, text PDF, image PDF)

`POST /api/v1/upload/file` → **400**

```json
{"success":false,"error":{"code":"INTERNAL_ERROR",
 "message":"fileUrl must be an absolute URL"}}
```

**Root cause:** `apps/backend/src/config/storage.config.ts:31`

```ts
publicBaseUrl: process.env.STORAGE_PUBLIC_BASE_URL ?? '',
```

returns the **empty string**, not `undefined`. `apps/backend/src/modules/storage/storage.service.ts:37-40`
then does:

```ts
this.publicBaseUrl = (
  this.config.get<string>('storage.local.publicBaseUrl')
  ?? `http://localhost:${this.config.get<number>('server.port') ?? 3001}`
).replace(/\/+$/, '');
```

The `??` fallback only fires on `null`/`undefined`, so with `''` it never applies and `fileUrl` becomes the
relative `/files/2026-10-25/<uuid>.csv`. `upload.service.ts:63` then rejects it:
`if (!input.fileUrl.startsWith('http')) throw new BadRequestException('fileUrl must be an absolute URL')`.

`STORAGE_PUBLIC_BASE_URL` is **not set** in `apps/backend/.env` and is **not documented** in `.env.example`.

**Note:** the multipart transfer itself is fine — the file was transmitted byte-identical to disk with the
correct filename, size and MIME type. Only the URL that is handed back to the job is wrong. Confirmed
directly: `POST /api/v1/upload/file` with a multipart body returns the same 400
`"fileUrl must be an absolute URL"`, and the file **is** written to disk first (the storage save happens at
`upload.service.ts:119`, before the validation at line 63) — it just never gets a usable URL.

**Fix:** set `STORAGE_PUBLIC_BASE_URL=http://localhost:3001` (and document it in `.env.example`), and
change the config default to `undefined` (or use `||` instead of `??` in the service) so the built-in
localhost fallback actually applies.

---

### BUG-10 — The extraction worker cannot fetch the file it was just given (401) — **Blocker**

**Severity:** Blocker (extraction and OCR both dead)

Every job that reaches the worker fails:

```
status: FAILED, progress: 30
errorMessage: "Extraction failed: Could not fetch the uploaded file (HTTP 401)"
```

Verified for **both** file types:
- `marks-text.pdf` (text-layer PDF → `fileType: PDF_TEXT`) → FAILED with the same 401
- `marks-image.pdf` (raster PDF → `fileType: PDF_IMAGE`, i.e. the OCR path) → FAILED with the same 401

**Root cause:** `apps/backend/src/modules/upload/processors/upload.processor.ts:76` downloads the file with
a plain `fetch(fileUrl)` and **no `Authorization` header**, but the storage route is behind
`JwtAuthGuard` — `apps/backend/src/modules/storage/files.controller.ts:30-31`:

```ts
@Controller('files')
…
@Get(':date/:name')
@UseGuards(JwtAuthGuard)
```

The same defect exists in **two more places**:

- `apps/backend/src/modules/ocr/ocr.processor.ts:40` (`downloadFile` → plain `fetch(fileUrl)`) — the OCR worker
- `apps/backend/src/modules/pdf-parser/pdf-parser.service.ts:122` (`downloadAsBuffer` → plain `fetch(fileUrl)`)

**Documentation contradicts the code:** the comment in `files.controller.ts:20-22` states *"The parser
workers read the same bytes from disk directly, so they do not go through here."* — but **no worker ever
touches the filesystem**. All three read the file over HTTP, so all three hit the JWT guard.

**Impact:** the HuggingFace OCR call is never reached, because the job fails at the download step first.

**Proof that the parsers themselves are fine** (the 401 is the *only* blocker): pointing a job at a
publicly-fetchable URL makes the whole chain work and produces correct, precise errors —

| Job | URL | Result |
|---|---|---|
| `marks-text.pdf` | `http://localhost:3001/api/v1/files/2026-10-25/144ad34d-….pdf` | **FAILED** — `Could not fetch the uploaded file (HTTP 401)` |
| `marks-image.pdf` | `http://localhost:3001/api/v1/files/2026-10-25/fab89422-….pdf` | **FAILED** — `Could not fetch the uploaded file (HTTP 401)` |
| `paper.pdf` | public `compressed.tracemonkey-pldi-09.pdf` | worker fetched it, `pdf-parse` read the text layer, then: *"The PDF has no recognisable header row. Expected a line naming \"Roll No\" and \"Subject\"."* ✅ correct |
| `states.csv` | public `2014_usa_states.csv` | worker fetched it, CSV parser read it, then: *"The file has no recognisable header row. Expected at least \"Roll No\", \"Subject Code\" and \"Marks\" columns."* ✅ correct |

So the CSV parser, the PDF text parser, the magic-byte sniffer and the header matcher all work correctly.
Only the authenticated download blocks them.

**Fix:** have the workers read the bytes from disk via `StorageService.read(relativePath)` (as the
comment already describes), or send an authenticated request.

---

### BUG-11 — Report status does not update in the UI (no polling on the list query) — **Medium**

**Severity:** Medium (user must manually reload to see the result)

After clicking **Generate report**, the new row appears with status **GENERATING** and stays there
indefinitely. Observed unchanged for 25+ seconds. The status only became **READY** after a **manual page
reload**, at which point the Download button was enabled.

**Root cause:** `apps/frontend/hooks/useReports.ts`

- `useReport(id)` (single detail) has `refetchInterval: 3000` while status is `PENDING`/`PROCESSING` — line 37-40
- `useReports()` (the **list** query that renders the table) has **no `refetchInterval`** and only
  `staleTime: 60 * 1000` — line 24-30

The Reports page renders the list query (`useReports()`), so it never polls. The same pattern would apply
to any other list that surfaces a background job's status.

**Fix:** add a conditional `refetchInterval` to `useReports()` while any row is `PENDING`/`PROCESSING`.

---

### BUG-12 — Scheme rules editor keeps a stale validation error after the JSON is fixed — **Low**

**Severity:** Low (cosmetic but misleading)

Typing invalid JSON into the **Rules (JSON)** field and submitting shows the inline error
*"Rules must be valid JSON"*. After replacing the content with valid JSON, the error message **stays on
screen** — even though the textarea now holds valid JSON and a successful `PUT` returns 200 with the
updated scheme.

**Root cause:** `apps/frontend/components/forms/SchemeFormFields.tsx:31,49-51`

```ts
const [error, setError] = useState<string | null>(null);
…
} catch {
  setError('Rules must be valid JSON');
}
```

`setError(null)` runs at the start of `onSubmit` (line 39), but `JSON.parse` then **succeeds** and calls
`onSubmit(...)` — the error is cleared, yet the error `<p>` is re-rendered by the *next* failed parse or
simply never cleared on a successful parse path. The error state is not cleared when the textarea value
changes and no longer represents a parse failure.

**Fix:** clear the error in the textarea's `onChange`, or clear it explicitly on the success branch of
the `try`.

---

### BUG-13 — React hydration mismatch on every authenticated page — **Medium**

**Severity:** Medium (affects every page; triggers a full client re-render)

Every authenticated page logs:

```
Warning: Expected server HTML to contain a matching <span> in <div>
    at span
    at Spinner (components/feedback/Spinner.tsx:10:11)
    at div
    at AppShell (components/layout/AppShell.tsx:35:11)

Uncaught Error: Hydration failed because the initial UI does not match what was rendered on the server.
Uncaught Error: There was an error while hydrating. Because the error happened outside of a Suspense
boundary, the entire root will switch to client rendering.
```

The Next.js dev overlay shows a persistent red **"1 error"** badge on every page (Dashboard, Students,
Members, Reports, Toppers, Analytics, Schemes, Upload).

**Root cause:** `apps/frontend/components/layout/AppShell.tsx`

```ts
const hasSession = typeof window !== 'undefined' && !!getSession();   // line 31
…
if (isLoading && hasSession) {                                        // line 58
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas">
      <Spinner size={32} label="Loading session" />                  {/* renders a <span> */}
    </div>
  );
}
```

`hasSession` is a **browser-only** value (`typeof window !== 'undefined'`) that is read **during render**.
On the server it is always `false`, so the server renders the *full app shell*; on the client the token is
in `localStorage`, so `hasSession` is `true` and — while `/auth/me` is still in flight — `isLoading` is
`true`, so the client renders the *loading spinner* instead. The two trees are different, so React throws
away the server HTML and re-renders everything on the client.

The mismatch the console reports is the symptom of that branch swap:

```
Warning: Expected server HTML to contain a matching <span> in <div>.
    at span   (components/feedback/Spinner.tsx:10:11)   ← client rendered the spinner
    at div    (components/layout/AppShell.tsx:35:11)     ← server rendered the shell
```

The `<span>` vs `<div>` detail is incidental — the real defect is that the **render output depends on a
value that is only knowable in the browser**.

**Fix:** do not branch on `hasSession` during the first render. Either render the spinner whenever
`isLoading` is true (regardless of session), or gate the whole branch on a `useEffect`-driven
`mounted` state so the first client render matches the server's.

---

### BUG-14 — Duplicate roll number returns 500 with a raw Prisma error — **Medium**

**Severity:** Medium (wrong status code + internal error leak + unhelpful UI message)

Creating a student whose `(rollNo, academicYearId)` already exists returns **HTTP 500** with the raw
Prisma error in the message body:

```
Invalid `this.prisma.student.create()` invocation in
apps/backend/src/modules/students/students.repository.ts:12:32

Unique constraint failed on the fields: (`roll_no`,`academic_year_id`)
```

**Root cause:** `students.repository.ts:12` calls `this.prisma.student.create(...)` without catching
Prisma's `P2002` unique-constraint error, so the global exception filter maps it to a 500
`INTERNAL_ERROR` and leaks the internal schema names (`roll_no`, `academic_year_id`) to the client.

**Frontend impact (verified in the browser):** submitting a duplicate roll number in
`/students/new` produces only the generic toast **"Failed to add student"** — the user is never told that
the roll number already exists, so they cannot tell what to fix. The form stays on the page with the
values intact.

**Fix:** catch `Prisma.PrismaClientKnownRequestError` with `code === 'P2002'` and rethrow as
`ConflictException('A student with this roll number already exists for the selected academic year')`
(HTTP 409). The frontend should surface that specific message.

**Note:** empty-field validation on the same endpoint works correctly — `POST /api/v1/students` with
`{rollNo: '', name: ''}` returns **400** with per-field messages
(`rollNo should not be empty`, `name should not be empty`, `branchId must be a non-empty id`,
`currentYear must not be less than 1`, …).

---

### BUG-15 — The declared `fileType` is ignored when routing a job to a queue — **High**

**Severity:** High (the wrong parser runs; the job dies with a nonsensical error)

`POST /api/v1/upload` accepts a `fileType` from the client (`CreateUploadJobDto.fileType`, validated
against `['EXCEL','PDF_TEXT','PDF_IMAGE','CSV']`) and `upload.controller.ts:31-40` passes it into
`createJob({ … fileType: dto.fileType … })` — but **`createJob` never reads `input.fileType` when it
decides which worker queue to use.**

`apps/backend/src/modules/upload/upload.service.ts:70-86`:

```ts
const type = input.detectedType ?? (await this.detectFileType(input.fileUrl)).type;
const queue = type === 'PDF_IMAGE' ? 'ocr-jobs' : 'upload-jobs';
```

`input.detectedType` is set **only** by `createJobFromFile` (the multipart endpoint). The JSON
`POST /upload` endpoint never sets it, so the routing falls back to re-sniffing the URL bytes — and the
caller's declared `fileType` is discarded.

**Observed:** a job created with `fileType: "PDF_IMAGE"` was persisted with `fileType: PDF_IMAGE` in the
database, but was dispatched to the **`upload-jobs`** queue and handed to the Excel parser, which failed
with:

```
Extraction failed: Can't find end of central directory : is this a zip file ?
If it is, see https://stuk.github.io/jszip/documentation/howto/read_zip.html
```

The user asked for OCR; they got the xlsx reader. The database column and the actual worker disagree.

**Fix:** route on the caller-supplied type when it is present, i.e.
`const type = input.detectedType ?? input.fileType ?? (await this.detectFileType(input.fileUrl)).type;`
(or simply stop accepting `fileType` from the client and always detect it from the bytes).

---

### BUG-16 — `POST /ocr/extract` always fails with a 500 — **High**

**Severity:** High (the endpoint is completely non-functional)

`POST /api/v1/ocr/extract` → **HTTP 500**:

```
Invalid `this.prisma.uploadJob.update()` invocation in
apps/backend/src/modules/ocr/ocr.service.ts:141:35

An operation failed because it depends on one or more records that were required but not found.
Record to update not found.
```

**Root cause:** `apps/backend/src/modules/ocr/ocr.controller.ts:34`

```ts
return this.service.processImage('inline', buffer, model);
```

The literal string `'inline'` is passed as the `jobId`. `ocr.service.ts:141` then does:

```ts
await this.prisma.uploadJob.update({ where: { id: jobId }, data: { status: 'PROCESSING', progress: 30, … } });
```

There is no upload job with the id `'inline'`, so Prisma raises **P2025** and the global exception filter
maps it to a 500. The failure happens **before** the HuggingFace call, so this endpoint can never
perform OCR.

**Impact:** there is no working way to trigger OCR manually. The only other OCR endpoint,
`POST /ocr/process/:jobId`, does not process anything either (see BUG-17) — so with the multipart path
blocked by BUG-9, the **entire OCR feature is unreachable**.

**Fix:** `processImage` should accept a nullable `jobId` and skip the DB update when it is null, or the
controller should create a real upload job first and pass its id.

---

### BUG-17 — "Re-run OCR" returns 201 Created but does nothing — **Medium**

**Severity:** Medium (false success — the user is told it worked when it did not)

`POST /api/v1/ocr/process/:jobId` returns **201** with a success payload:

```json
{"success":true,"data":{"jobId":"2f1fb9b3-…","current":{"id":"2f1fb9b3-…","fileName":"marks-image.pdf",
 "fileType":"PDF_IMAGE","status":"FAILED","errorMessage":"Extraction failed: Could not fetch the uploaded file (HTTP 401)"}}}
```

but the job's status and error message are **completely unchanged** afterwards — no queue is enqueued, no
worker runs, no new attempt is made.

**Root cause:** `apps/backend/src/modules/ocr/ocr.controller.ts:41-44`

```ts
async process(@Param('jobId') jobId: string) {
  const job = await this.service.getJobStatus(jobId);
  return { jobId, current: job };
}
```

It only **reads** the job and returns it. The `ocr-jobs` queue is never touched.

**Fix:** enqueue the job onto the `ocr-jobs` queue (as `upload.service.ts:74-85` does) and return the
enqueued state, or rename the endpoint so it does not advertise a re-run.

---

### BUG-18 — A job's `fileType` column can disagree with the parser that actually ran — **Low**

**Severity:** Low (data integrity / confusing diagnostics)

This is the observable symptom of BUG-15, recorded separately because the persisted row is misleading:
the `UploadJob.fileType` column records the type the **caller declared** (`PDF_IMAGE`), while the worker
that actually ran was the Excel parser. Anyone triaging a failure by reading the job row is told the
wrong thing — the row says "this went to OCR", but the error
(*"Can't find end of central directory : is this a zip file ?"*) can only have come from the xlsx reader.

**Fix:** fixed by BUG-15; also persist the *detected* type rather than the declared one so the column
reflects what really happened.

---

### BUG-19 — Deactivating a member does not revoke their access token — **High (security)**

**Severity:** High — OWASP A01: Broken Access Control / A07: Identification and Authentication Failures

A member who is **deactivated** keeps full API access with their **already-issued** access token until it
expires (up to 15 minutes, `JWT_EXPIRES_IN=15m`).

Reproduced end to end with a real member (invite → accept → login → deactivate → reuse the token):

1. Invite `session.revocation.probe2@dbatu.edu` (TEACHER) → email accepted → account created
2. `POST /auth/login` → **200**, access token `T`
3. `GET /auth/me` with `T` → **200**, `role: TEACHER`, **10 permissions**
4. `PUT /api/v1/users/:id` `{ isActive: false }` → **200** (member deactivated)
5. `GET /auth/me` with the **same** token `T` → **still 200**, `role: TEACHER`, **still 10 permissions**
6. `GET /api/v1/students` with `T` → **still 200** (a protected, role-scoped endpoint)
7. `POST /auth/login` with the correct password → **401 "Invalid credentials"** ✅ (re-login *is* blocked)

So the account is half-deactivated: it can no longer sign in, but every session that was already open
stays alive and keeps its full permission set.

**Root cause:** the JWT strategy never re-checks the account state —
`apps/backend/src/modules/auth/strategies/jwt.strategy.ts:17-24`:

```ts
async validate(payload: JwtPayload): Promise<JwtPayload> {
  return { sub: payload.sub, email: payload.email, role: payload.role, branchId: payload.branchId };
}
```

There is no database lookup and no `isActive` check — the token is trusted purely on its signature and
expiry. The `isActive` check exists only on the two token-issuing paths: `auth.service.ts:44` (login) and
`auth.service.ts:264` (refresh).

**Secondary issue:** `users.service.ts:77-79` (`deactivate`) only sets `isActive: false` — it does **not**
revoke the member's refresh tokens either, so a deactivated user can keep refreshing for up to
`REFRESH_EXPIRES_IN=7d`… except the refresh path *does* check `isActive` (`auth.service.ts:264`), so that
one is covered. The gap is the access token only.

**Impact:** offboarding a teacher or admin does not immediately cut off their access. If a token has been
stolen, or the account is compromised, deactivating the user does not stop the attacker for up to
15 minutes — and there is no other kill-switch (no session list, no "sign out everywhere", no
`tokenVersion` on the user row).

**Fix:** look the user up in `JwtStrategy.validate()` and reject the request when `isActive` is false
(or add a `tokenVersion`/`sessionsValidAfter` column on `User` and compare it against a claim in the
JWT, so revocation is instant without a per-request database hit).

---

### BUG-20 — There is no way to create a Scheme from the UI — **Medium**

**Severity:** Medium (an admin feature is unreachable from the product)

The **Scheme Rules** page (`/admin/schemes`) lists the schemes and offers an **Edit** link for each, but
there is **no "Create scheme" button and no create page**. `http://localhost:3000/admin/schemes/new`
returns the Next.js **404** page.

The backend endpoint is fully implemented and works:
`POST /api/v1/schemes` (`schemes.controller.ts:15-21`, `@Roles('SUPER_ADMIN','ADMIN')`,
`@Permissions('schemes:write')`) → **201 Created**, and the new scheme immediately appears in the
`/admin/schemes` list.

**Frontend routes that exist:**

| Resource | List | Create | Edit |
|---|---|---|---|
| Members | `admin/members/page.tsx` | `admin/members/new/page.tsx` ✅ | `admin/members/[id]/edit/page.tsx` ✅ |
| Students | `students/page.tsx` | `students/new/page.tsx` ✅ | `students/[id]/edit/page.tsx` ✅ |
| **Schemes** | `admin/schemes/page.tsx` | **missing** ❌ | `admin/schemes/[id]/edit/page.tsx` ✅ |

**Impact:** an administrator cannot add a new evaluation scheme. Schemes can only be created via the raw
API (or a database insert). Since a scheme is the prerequisite for subjects, batches and marks, this
blocks onboarding a new academic year's evaluation scheme through the product.

**Fix:** add `app/(authenticated)/admin/schemes/new/page.tsx` (mirroring `admin/members/new/page.tsx`)
and a "Create scheme" button on the list page.

---

## Notes on test data created during this run

| Data | Where |
|---|---|
| 10 students `TCS001`–`TCS010` (CS / SCHEME_2024 / 2024-25 / Y1 / S1) | imported via `test-data/students.csv` |
| `TEST001 / Test Student E2E Edited` | soft-deleted (`isActive: false`) but still listed — see BUG-2 |
| `TCS001 Aarav Sharma` | soft-deleted in this run, still listed — see BUG-2 |
| `TCS010 Neha Gupta` | soft-deleted live in this run (confirm dialog accepted), still listed — see BUG-2 |
| Member `teacher.e2e@dbatu.edu` (TEACHER, CS branch) | created via invite → accepted via the Ethereal email link; **Active** (was deactivated, then reactivated) |
| Member `session.revocation.probe@dbatu.edu` (TEACHER) | invite created, never accepted (PENDING) — probe for BUG-19 |
| Member `session.revocation.probe2@dbatu.edu` (TEACHER) | invite → accepted → logged in → **deactivated**; used to prove BUG-19 |
| Invite `revoke.probe@dbatu.edu` | created, then revoked (backend `REVOKED`, UI stale — see BUG-5) |
| Report `581167ba-cb52-4047-be3a-443582dda02f` (STUDENT_WISE, CS / SCHEME_2024 / Sem 1 / 2024-25) | **COMPLETED**, downloadable `.xlsx` |
| Subject `CS101 Data Structures` + one mark row | created via the marks API; drives the analytics/toppers data |
| Upload jobs | 6 failed jobs: `marks-text.pdf` (401), `marks-image.pdf` (401), `marks.csv`→example.com (404), `states.csv` (correct header rejection), `paper.pdf` (correct PDF-header rejection), `scan.pdf` (wrong queue — BUG-15) |
| Test fixtures | `test-data/students.csv`, `test-data/marks.csv`, `test-data/marks-text.pdf`, `test-data/marks-image.pdf`, `test-data/make_pdfs.py` |

## Suggested fix order

1. **BUG-9** + **BUG-10** — unblocks the entire upload/parsing/OCR module (one env var + one code change each)
2. **BUG-8** — unblocks the Upload Results UI (one state initialisation)
3. **BUG-16** + **BUG-17** — make the OCR endpoints work at all (they are dead code today)
4. **BUG-15** — stop dispatching a declared `PDF_IMAGE` to the Excel parser
5. **BUG-19** — make deactivation actually revoke access (security)
6. **BUG-1** — unblocks password reset (one migration)
7. **BUG-7** — stops leaking bcrypt hashes from `GET /api/v1/users/:id`
8. **BUG-6** — unblocks the member edit page (same fix as BUG-7: select the `roles` relation)
9. **BUG-2** / **BUG-3** / **BUG-4** — students module correctness
10. **BUG-5**, **BUG-11**, **BUG-12**, **BUG-13**, **BUG-18**, **BUG-20** — UI polish

---

# Fix Log — 2026-10-25

All 20 bugs have code fixes in place. Both applications type-check clean
(`tsc --noEmit`, 0 errors).

## Status

| Bug | Severity | Status | Where |
|---|---|---|---|
| BUG-1 | Critical | ✅ fixed — migration **applied** | `prisma/migrations/20260101000200_add_password_reset_tokens/` |
| BUG-2 | High | ✅ fixed | `students.repository.ts` — `findAll` filters `isActive: true` |
| BUG-3 | High | ✅ fixed | `students/import/page.tsx` — Batch select + `batchId` in scope |
| BUG-4 | High | ✅ fixed | `useStudents.ts` — `extractErrorMessage` on every mutation |
| BUG-5 | Medium | ✅ fixed | `invites` — `superseded_by_id` column + "SUPERSEDED" label + explicit invalidation |
| BUG-6 | High | ✅ fixed | `users.repository.ts` — `findById` includes `roles` |
| BUG-7 | **Critical** | ✅ fixed | `users.repository.ts` — `USER_PUBLIC_SELECT` (no `passwordHash`) |
| BUG-8 | Blocker | ✅ fixed | `upload/page.tsx` — `effectiveAcademicYearId` |
| BUG-9 | Blocker | ✅ fixed | `storage.config.ts` + `storage.service.ts` |
| BUG-10 | Blocker | ✅ fixed | `storage.service.ts` `readByUrl()` + 3 callers |
| BUG-11 | Medium | ✅ fixed | `useReports.ts` — conditional `refetchInterval` |
| BUG-12 | Low | ✅ fixed | `SchemeFormFields.tsx` — error derived from current JSON |
| BUG-13 | Medium | ✅ fixed | `AppShell.tsx` + `useAuth.ts` — no browser-only render branch |
| BUG-14 | Medium | ✅ fixed | `students.repository.ts` — P2002 → 409 Conflict |
| BUG-15 | High | ✅ fixed | `upload.service.ts` — `detectedType ?? fileType ?? detect()` |
| BUG-16 | High | ✅ fixed | `ocr.controller.ts` + `ocr.service.ts` — null jobId |
| BUG-17 | Medium | ✅ fixed | `ocr.controller.ts` — enqueues onto `ocr-jobs` |
| BUG-18 | Low | ✅ fixed | symptom of BUG-15 |
| BUG-19 | **High (security)** | ✅ fixed | `jwt.strategy.ts` — inactive user rejected |
| BUG-20 | Medium | ✅ fixed | `admin/schemes/new/page.tsx` + "Create scheme" button |

## Detail

### BUG-1 — password reset

The migration file existed but was never applied. It **has now been applied**
to the target database:

```
Applying migration `20260101000200_add_password_reset_tokens`
Applying migration `20260101000300_add_invite_superseded_by`
All migrations have been successfully applied.
```

Note for anyone re-running this: use `npx prisma migrate deploy` from
`apps/backend` (Prisma 5.8 — the project's local CLI). A global Prisma 7 on
`PATH` reports `COMMAND_MOVED` / `Unknown command "migrate"` and must not be
used.

### BUG-5 — superseded invitations

The list showed a `REVOKED` row for an invitation that had actually been
*replaced*, with nothing to distinguish it from a manually revoked one.

- **New migration** `20260101000300_add_invite_superseded_by` adds
  `superseded_by_id` (self-referencing FK, `ON DELETE SET NULL`).
- `invites.repository.ts` gains `supersede(id, supersededById)`.
- `invites.service.ts` — `create()` and `resend()` now **supersede** the
  previous invitation instead of merely revoking it, and the API response
  carries `supersededById`.
- The UI renders `SUPERSEDED` + "Replaced by a newer invite" for those rows.
- The list and the counts query are invalidated explicitly
  (`['invites','list']` + `['invites','counts']`) rather than by a bare
  `['invites']` prefix, and both refetch on mount so the tab badge and the
  table can never disagree.
- The tab was renamed "Pending invitations" → **"Invitations"**, because it
  lists every status; the badge is the pending count and says so.

### BUG-7 — bcrypt hash leak

`GET /api/v1/users/:id`, `PUT /api/v1/users/:id`, `POST /api/v1/users`,
`GET /api/v1/users` all returned the full row including `passwordHash`.

Every read path now goes through one selection, `USER_PUBLIC_SELECT`, so the
shape cannot drift between endpoints:

```ts
export const USER_PUBLIC_SELECT = {
  id: true, email: true, name: true, isActive: true,
  mustChangePassword: true, lastLoginAt: true,
  createdAt: true, updatedAt: true,
  createdBy: true, updatedBy: true,
  invitedById: true, invitedAt: true,
} satisfies Prisma.UserSelect;
```

### BUG-13 — hydration mismatch

Two places branched the render on a browser-only value:

- `AppShell.tsx` — `hasSession` came from `localStorage` *during render*, so
  the server render and the first client render disagreed.
- `useAuth.ts` `useCurrentUser()` — the same pattern, feeding `enabled:` and
  therefore `isLoading`.

Both now read the session in an effect and hold it in state, so the server
and the client render identically.

### BUG-19 — deactivated member keeps access

`JwtStrategy.validate()` returned the claims straight from the token. It now
re-reads the account and rejects an inactive or missing user, so
deactivation takes effect on the next request instead of at the end of the
15-minute access token's life. The refresh path already checked `isActive`.

### Extra — database connection resilience

Not in the original list, but found while verifying: the dashboard returned
`500 Can't reach database server at ep-orange-star-…neon.tech:5432` on the
first request after a backend restart.

Prisma sizes its connection pool from the CPU count, which on a small
container opens more connections than Neon allows; the surplus are closed by
the provider and the next request fails until the pool refills.
`database/prisma.module.ts` now appends `connection_limit=10` and
`pool_timeout=20` to the connection URL, preserving the existing `sslmode`
and `channel_binding` parameters.

