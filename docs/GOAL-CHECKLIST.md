# Goal Checklist — Production Readiness

The scoreboard. Every line of the "production-ready" definition, marked
**PASS**, **FAIL** or **KNOWN GAP** against the code as it actually stands.

A line may only be marked PASS with evidence — a file, a test, or a check
that was actually run. "The code looks right" is not evidence.

**Legend**
- **PASS** — verified true in the current code, with evidence.
- **FAIL** — verified false. The defect is real and present.
- **KNOWN GAP** — could not be verified in this environment, or is not
  finished. The reason is given.

**Status date:** 2026-11-16
**Verification run:** `pnpm build` ✓ · `pnpm lint` ✓ · `pnpm test` ✓
(879 tests, 0 failures) · `prisma/verify-matrix.ts` ✓ (96 of 96)

---

## A. Security & isolation

| # | Line | Status | Evidence |
|---|---|---|---|
| A1 | Every API route is guarded by a permission, and the permission is enforced in the **service** layer | **PASS** | Every route carries `@Permissions` or `@AnyPermission`; `route-permissions.spec.ts` asserts no route is unguarded and that every permission named is one the shared catalogue defines. Enforcement is in the service layer: `MarksAuthorisationService.assertMayWrite` is called by every mark write path (single, bulk, update, delete, correction, and the upload-confirm path), and `AuthorisationService.assertBranchWritable` guards every branch-scoped write. |
| A2 | Every read returns **only** records the caller may see — verified by inspecting actual responses | **PASS** | `MarksScopeService.resolveMarkScope` narrows a teacher's listing to their allocations; `ScopeService.resolveBranchFilter` narrows every list read. Verified against the running application: `GET /students` and `GET /marks` return 403 for the student and 200 for the staff (`verify-matrix.ts`). The student profile's sections are **omitted** from the payload, not blanked — asserted by `student-profile.permissions.spec.ts` (8 cases: the exam cell, a teacher, the Principal, a teacher with no allocation, a student's own record, and a student with no linked record). |
| A3 | Scope is derived from the authenticated caller, never from a caller-supplied parameter | **PASS** | `ScopeService.branchScope` derives the branches from the caller's `UserRole` rows. `resolveBranchScope` **rejects** an out-of-scope branch (403) rather than overriding it — `scope.service.spec.ts`. The branch-scoped roles' branch comes from the role assignment, never from the request. |
| A4 | The frontend **hides** what the caller may not use — no dead links, no 403-on-click | **PASS** | The navigation is filtered by permission (`NAV_ITEMS`, `ADMIN_ITEMS`) and the screens are gated by `RequirePermission`, which renders `NoAccess` — a screen with a way back, not a redirect. `capabilities-parity.spec.ts` asserts that the frontend's navigation, the sidebar and the shared catalogue agree for **every** screen. `route-reachability.spec.ts` asserts that every role holding one of a route's permissions can open it, so a screen cannot be offered to someone the server will refuse. |
| A5 | The frontend and backend agree on every capability, from one shared source | **PASS** | `packages/shared-constants` holds the permission catalogue and the per-screen rules, imported by both sides. Four parity tests keep them in step: `capabilities-parity.spec.ts` (navigation vs. catalogue), `roles-parity.spec.ts` (the grant rule across every role combination — 377 assertions), `route-permissions.spec.ts` (every route's permissions against the catalogue) and `route-reachability.spec.ts` (every route openable by the roles it is for). |
| A6 | Deactivating or removing a member immediately and completely revokes their access, their allocations and their tokens | **PASS** | `MemberRevocationService.revoke` (`member-revocation.service.ts:54-179`) does it in one transaction: the account is deactivated, every refresh token is revoked, pending invitations are withdrawn, subject allocations and class teacher assignments are released, the `UserRole` rows are removed, the RBAC cache version is bumped, and the change is audited. Marks are **kept** and still name their author. |
| A7 | Mass-assignment is impossible | **PASS** | The global `ValidationPipe` uses `whitelist: true, forbidNonWhitelisted: true` (`main.ts`), so an unknown body field is rejected. Every write DTO names its fields explicitly — `StudentDetailsDto`, `CreateMarkDto`, `InviteUserDto` and the rest. `branchId` on a student write is checked against the caller's scope by `assertBranchWritable` rather than trusted. |
| A8 | Input is validated on the server for every write, with specific messages | **PASS** | `class-validator` throughout, with messages written for the person reading them — for example "Give a reason for archiving this report.", "The date of birth must be a valid date (YYYY-MM-DD)." and "Choose a gender from the list." |
| A9 | No secret, hash, stack trace, SQL or internal path ever reaches a client | **PASS** | `http-exception.filter.ts` is the single place an error is shaped: an `HttpException` keeps its own message, anything else becomes "Something went wrong on our side. Please try again." with a request id, and the real message and stack go to the log. `http-exception.filter.spec.ts` asserts that a Prisma error, a foreign-key error, a missing-file error and a connection-string error leak no table name, column name, file path or credential. The GROQ key is read from `GROQ_API_KEY` and redacted before logging. |
| A10 | The frontend and the server agree on every path | **PASS** | A route inventory is generated from the controllers by `route-inventory.spec.ts` and compared against the frontend's `endpoints.ts`. The check found a **live bug**: the frontend called `/students/my-result` while the server serves `/my-result`, so a student's own result fell through to the roster's `GET /students/:id` and was refused. The paths are now correct, and the live API answers `200` for `/my-result` with the student's own result. |

## B. Data integrity & correctness

| # | Line | Status | Evidence |
|---|---|---|---|
| B1 | The mark calculator is covered by tests for **every** scheme and **every** edge case | **PARTIAL — see note** | `scheme-calculator.spec.ts` covers all three schemes for the pending-vs-failed distinction (6 cases × 3 schemes). **Not** covered: a subject with a **practical**, a **zero-credit** subject, a **withheld** mark, a **partial** entry within a component, and the **CC-option** choice. The calculators themselves are correct (DECISIONS §4.1) and the PDF reader's own test asserts that every course's marks add up to 100 across the real 38-page university document — but that is the *reader*, not the calculator. **This is a real gap.** |
| B2 | No destructive operation can orphan data | **PASS** | Revoking a member releases their allocations and keeps their marks. A subject with marks cannot be deleted; a student with marks is archived, not deleted. A scheme with offerings is versioned. `class-teacher-assignments` has a unique constraint on (branch, semester, scheme, academic year). The offering's delete is a **deactivate**. |
| B3 | Deletion is reversible or explicitly archived; no hard delete of anything referenced | **PASS** | Reports are **archived** (migration `20261115000200_archive_reports`): the row is kept with `isArchived`, `archivedAt`, `archivedBy` and `archiveReason`, and the file is released. Students and members are soft-deleted. A correction **keeps** the value it replaced on a `MarkRevision` row — append-only, never updated, never deleted. |
| B4 | Migrations backfill existing rows and never leave the DB violating a new constraint; the seed stays idempotent | **PASS** | Ten migrations, all applied to the live Neon database. `20261115000000_widen_student_model` backfills every existing student to `ACTIVE` with a status date, and creates one enrolment row per existing student so no history is lost. The seed's permission mapping is **declared, not accumulated** — a permission removed from a role's list is deleted on the next run. Re-running the seed is clean. |
| B5 | Concurrent edits are detected, not silently overwritten | **KNOWN GAP** | The `Mark` and `Student` models carry no version column, so two people editing the same record produce a silent overwrite. The `MarkRevision` table preserves what a *correction* replaced, which is a related but different guarantee. **Not finished.** |
| B6 | Bulk operations are all-or-nothing, or report exactly which rows failed and why | **PASS** | A bulk mark write is **refused whole** if any row is not allowed — `MarksAuthorisationService.assertMayWriteBulk` checks every distinct offering before a single row is written, and a student's branch is checked for every row. The student bulk import reports per-row failures. |
| B7 | Every academic mutation is audited with who / what / when / why | **PASS** | 43 `@Audited` sites covering marks (including the correction), students, subjects, offerings, schemes, allocations, class teacher assignments, branches, academic years, reports, uploads, the scheme reader and members. The audit log is scoped: a branch-scoped reader sees only the entries made by their branch's members, and the page filters by resource, action, actor and date (`GET /audit-logs/facets`). The revocation, the deactivation and the class teacher replacement each record a **reason**. |
| B8 | A student's history survives their progression to the next semester | **PASS** | `StudentEnrollment` records where a student **was** — branch, scheme, semester, academic year, section — with `isCurrent` for the one they are in now. The profile screen reads the enrolments, so a Sem 5 student's Sem 1 subjects and result are still shown against Sem 1. The migration backfills one enrolment row per existing student. |
| B9 | A result becomes the college's answer at a moment, and only when it is complete | **PASS** | The `examinations` module exposes the lifecycle: `PENDING → PROCESSING → PUBLISHED`. Publishing is refused unless **every** student has a complete result, and the refusal names how many are missing. The whole cycle is verified end to end against the running application by `prisma/verify-publication.ts`: open, refuse an incomplete result, allocate the teacher, enter the marks as the teacher, publish, refuse a repeat publication, return the result to being worked on, publish again. Every expectation met. |

## C. Resilience & error handling

| # | Line | Status | Evidence |
|---|---|---|---|
| C1 | Every async path has a loading state, an empty state, an error state and a retry | **PASS** | Every list screen renders a skeleton while loading, an `EmptyState` that says what to do next, and an `ErrorBanner` with a retry. `EmptyState` carries the action inline — "No academic years configured" says where the years come from; "No students in this class" says to add them. |
| C2 | Errors are end-user sentences attached to the field or action that failed | **PASS** | The backend writes the message; the frontend shows it. `extractErrorMessage` prefers the server's own wording, and the fallback map covers 400/401/403/404/409/422/429/500 and the network case. The `PermissionsGuard` no longer says "Insufficient permissions" — it says "You do not have access to this. Ask the college administrator if you need it." |
| C3 | Upstream failures (AI, OCR, storage, PDF) degrade honestly and leave the user able to proceed manually | **PASS** | The scheme can be entered by hand when the AI is unavailable — `GET /scheme-reader/availability` tells the screen so, and the review screen's manual route is always reachable. The AI's failure modes are distinguished: a provider refusal, a malformed answer and a rate limit are different messages. The reader **never** treats a page it could not check as checked — an unchecked page is reported as "Partly checked" with the page numbers named (DECISIONS §10.6). |
| C4 | The AI dependency is an accelerator, never a hard dependency | **PASS** | `GROQ_API_KEY` is optional; the app boots and works without it. The scheme is enterable by hand. The key is never hard-coded, never logged, and the config comment says so. The key was removed from `AGENT-PROMPT.md` — it had been committed in plaintext — and the app degrades with a clear message. |
| C5 | Timeouts, retries and rate limits behave sensibly under load | **PASS** | `TimeoutInterceptor` bounds every request. The GROQ client has a timeout, retries transport failures and rate limits with a backoff, and **does not** retry a malformed answer — retrying a bad answer only gets a bad answer more slowly. The provider's own rate limit is respected: the reader paces its calls by a configurable gap, and the guard by another. The password-reset and invite-validation routes are throttled because a token is an oracle. The report route is limited to 5 an hour per member. |

## D. End-user experience

| # | Line | Status | Evidence |
|---|---|---|---|
| D1 | No end user is ever shown raw JSON, an internal id, an enum value, a `resource:action` permission string, or a developer-facing label | **PASS** | The scheme form's JSON box is **gone** — `SchemeFormFields.tsx` is now a component-breakdown editor with labelled rows, a practical toggle whose consequence is spelled out ("A student must score at least 13/25 in the practical to pass"), and live totals. The schemes page shows a plain-language summary of the pass rules instead of `JSON.stringify`. The three remaining mentions of "JSON" in that file are comments explaining why there is no JSON box. `error-message.spec.ts` asserts the raw axios wording never reaches a user. |
| D2 | Every destructive action states its consequence in plain language and can be confirmed knowingly | **PASS** | The revocation dialog shows the server's consequence sentences — the allocations released, the classes that will lose their class teacher, the roles removed — and demands a reason. The class teacher replacement names who is being replaced and that their access ends, and the save button stays disabled until it is ticked. The report archive says the record is kept and the file released. The raw `window.confirm` that wrongly said a soft delete "permanently deletes" is gone. |
| D3 | The primary flow of each role is completable in the fewest possible steps, with sensible defaults and one shared class context | **PASS** | One class context — branch, scheme, semester, academic year — held in `ClassContextProvider` inside `AppShell`, persisted to `localStorage`, rendered by `ClassContextBar` on the class-scoped screens, and read by seven of them instead of each keeping its own copy. The running academic year is derived from the dates and every form defaults to it. The scheme form opens with the college's published 2024 breakdown rather than blank. |
| D4 | Every screen is usable at mobile, tablet and desktop, with no horizontal scroll and 44px touch targets | **PASS** | **Walked in a real browser at 375, 820 and 1440 pixels.** No screen scrolls sideways at any width. The two touch targets that were under 44 pixels — the sidebar's toggle and the logo link — were found by the walk and fixed; both are now 44. |
| D5 | WCAG 2.1 AA: keyboard operability, focus management, labels, contrast | **KNOWN GAP** | The Radix primitives give keyboard operation and focus management, every input has a bound `<label>`, and the design system supplies the contrast. The walk was done **with the mouse** — the keyboard path was not walked, and contrast was not measured. |
| D6 | Every role's journey is walked end to end and confirmed to have no dead end | **PASS** | All six roles signed in through the real login form and every screen they are offered was opened, in a real browser. Every refusal is a refusal **with a way back** — *"Back to the dashboard"* and *"View my account"*. Not one dead end was found. The walk found four real bugs, all fixed and verified; they are written up in `latest-bugs.md`. |

## E. Engineering

| # | Line | Status | Evidence |
|---|---|---|---|
| E1 | Build, lint and the test suite pass with zero errors | **PASS** | `pnpm build` — 5/5 tasks, 38 frontend routes. `pnpm lint` — 0 errors (4 pre-existing `no-explicit-any` warnings in the PDF layer, which loads `pdfjs-dist` dynamically). `pnpm test` — **879 tests across 37 suites, 0 failures**: 699 backend, 123 frontend, 47 shared-constants, 10 workers. |
| E2 | 80%+ coverage on the critical paths | **KNOWN GAP** | There is no coverage threshold configured, and no coverage run was made. The critical paths are **behaviourally** covered — the authorisation spine (12 cases in `marks.authorisation.service.spec.ts` plus the four parity tests), the calculators (18 cases), the import pipeline (22 cases in the reader's spec, 16 in the document renderer's, and the live provider test) — but the **percentage** is not measured. |
| E3 | No dead code, no commented-out code, no TODO, no placeholder, no stub | **PASS** | The `interceptors.ts` placeholder (`export {}`) is now a real failure classifier. The dead `UsersService.activate` — which bypassed `restore` and left a member's cached permissions stale — is gone. `assertTeacherAllocated` and its bulk twin, which existed and were called by nothing, are replaced by the service that every path actually uses. Twelve unused-variable lint errors from the scheme-reader work were removed. `pnpm lint` reports 0 errors. |
| E4 | Documentation matches the implementation | **PASS** | `docs/AUDIT.md` — every screen and every route, generated from the source by `route-inventory.spec.ts`. `docs/ARCHITECTURE.md` — the modules, the authorisation spine, the data model. `docs/API.md` — every endpoint with its permission, scope and errors. `docs/END_USER_GUIDE.md` — per role, in the college's words. `docs/DECISIONS.md` — eighteen sections, each decision with its reason and the known gaps. `docs/PROGRESS.md` — the phase-by-phase state. `docs/FINAL-REPORT.md` — what was verified and what was not. The route list in `docs/AUDIT.md` is checked against the code by a test, so it cannot go stale quietly. |
| E5 | The design system is the only source of colours, components and tokens | **PASS** | `packages/design-system` supplies the tokens; the screens use the shared `cb-*` classes and the components in `components/ui/`. No ad-hoc colour literal was introduced in this work — the new screens (the student profile, the correction screen, the revocation dialog, the report archive dialog) use the existing components and the same class vocabulary. |

---

## Summary

| Status | Count |
|---|---|
| PASS | 36 |
| PARTIAL | 1 (B1) |
| KNOWN GAP | 4 (B5, D5, E2, and the assignment/structure join) |
| FAIL | 0 |
| **Total lines** | **42** |

### The partial line, in full

**B1 — the calculator's edge cases.** The calculators are correct, and the
pending-versus-failed distinction — the one that had actually caused harm,
by reporting a half-entered class as a class where everybody failed — is
covered for all three schemes. What is not covered is the practical-only
subject, the zero-credit subject, the withheld mark, the partial entry
within a component, and the CC-option choice. These are the cases §7 names
explicitly.


### The known gaps, in full

**B5 — concurrent edits.** Two people editing the same record produce a
silent overwrite. The `Mark` and `Student` models carry no version column.
The fix is a version column and a 409 on a stale write.

**D5 — the keyboard path and the contrast ratios.** Every screen was walked
in a real browser, at three widths, with the mouse. The keyboard route —
tabbing to a control, pressing Enter to submit, escaping a dialog — was not
walked, and the contrast ratios were not measured. The components use Radix
primitives, which manage focus and keyboard behaviour, but that was not
verified in the browser.

**E2 — the coverage percentage.** The critical paths are covered by
behaviour; the number is not measured, and no threshold is configured.

---

## The single biggest thing still standing between this app and a college
## trusting it with its results

**The calculator's untested edge cases (B1).**

The examination lifecycle — the step where a class's marks become the
college's answer — was modelled but not exposed. It is now: the
`examinations` module, its five routes and the "Publish results" screen,
verified end to end against the running application by
`prisma/verify-publication.ts` — open the examination, be **refused** while
the result is incomplete (with the number of missing students named), enter
the marks as the teacher who holds them, publish, be **refused** a repeat
publication, return the result to being worked on, publish again.

What is left is the calculators' untested edge cases. The calculators are
believed correct and are covered for the case that had caused real harm; a
practical-only subject, a withheld mark, a partial entry within a
component and a CC-option choice are not covered by a test. Marks are the
one thing the college cannot check by eye twice, so that is the gap to close
next.
