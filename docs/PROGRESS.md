# Progress — Production Hardening

The work plan. One line per phase, with the evidence that decided the status,
followed by the ordered list of what is left.

**Status date:** 2026-11-15
**Spec:** `AGENT-PROMPT.md` (repo root)

---

## Baseline verification (Step 1)

Run on 2026-11-15, from the repo root.

| Command | Result |
|---|---|
| `pnpm build` | **PASS** — 5/5 turbo tasks, 39 frontend routes generated |
| `pnpm lint` | **PASS** — 0 errors (4 pre-existing `no-explicit-any` warnings in the PDF layer) |
| `pnpm test` | **PASS** — 879 tests across 37 suites, 0 failures |
| `pnpm db:migrate` | **PASS** — 10 migrations applied to the live Neon database |
| `pnpm db:seed` | **PASS** — the seed is idempotent and re-seeded cleanly |
| `prisma/verify-matrix.ts` | **PASS** — 96 of 96 expectations met against the running application |
| `prisma/verify-publication.ts` | **PASS** — every expectation met; the whole publication cycle |

**Toolchain note.** The build initially failed with `unable to find package
manager binary`. The cause was not the project: the `pnpm.cmd` shim in
`C:\Users\hp\AppData\Roaming\npm\` had been deleted, so turbo — which resolves
the package manager by looking for a Windows binary — could not find one.
The shim was restored. `script-shell` is `undefined` and both `.npmrc` files
are absent, which is the required state.

**Lint was failing before this session** with 12 errors (unused variables) in
the scheme-reader and PDF layers — leftovers from the in-progress scheme
pipeline work. All 12 were removed. Six were genuinely dead code
(`ASSESSMENT_COMPONENTS`, `PdfPageText`, `COLUMN_NAMES`, `THEORY_COMPONENTS`,
`pipeIndex`, `isRollLabel`, `ProviderErrorBody`, an orphaned `buildReader`
helper, and two unused test locals). `no-var-requires` in
`pdf-table-extractor.ts` was silenced with the same disable comment the
codebase already uses in `document-renderer.ts`, because the lazy `require` is
deliberate: `pdfjs-dist` pulls in optional native modules that must not be
required for text extraction.

---

## Phase status

| Phase | Status | Evidence |
|---|---|---|
| **0 — Orientation** | **DONE** | `docs/DECISIONS.md` is current through §16. `docs/GOAL-CHECKLIST.md` was the 2026-11-01 baseline and is refreshed below. |
| **1 — Authorisation spine** | **DONE** | `common/services/authorisation.service.ts`, `modules/marks/marks.authorisation.service.ts`, `modules/marks/marks-scope.service.ts`. The six gaps are closed — see R1. |
| **2 — Revocation & lifecycle** | **DONE** | `modules/users/member-revocation.service.ts:54-179`, `modules/rbac/user-roles.controller.ts`. The three gaps are closed — see R2. |
| **3 — Scheme PDF pipeline** | **DONE** | `modules/scheme-reader/`, `common/ai/` (GROQ client, guard, reader), the review UI at `admin/schemes/read/page.tsx`, `POST /scheme-reader/confirm` → `writeSubjects()`. The key is read from `GROQ_API_KEY` only. The raw-JSON form is gone — see R3. |
| **4 — Student profile** | **DONE** | The `Student` model is widened (personal, contact, identity, category, guardian, status); migration `20261115000000_widen_student_model`. `modules/students/student-profile.service.ts` + the profile screen at `students/[id]/page.tsx` (805 lines, six sections). `StudentEnrollment` preserves history across semesters. Bulk provisioning at `students/bulk-provision/`. Nine PII-gating tests in `student-profile.permissions.spec.ts`. |
| **5 — Dashboard & academic year** | **DONE** | The dashboard is role-aware (`dashboard.service.ts:422-449`, permission-driven, four scopes). `semesterToYear` lives in `packages/shared-constants/src/academic.ts`. The redundant year columns are removed by migration `20261102000000_drop_redundant_year_columns`. The running year is **date-derived** (`packages/shared-constants/src/running-year.ts:196`) with the gap cases documented. `POST /academic/years` lets the college open a year without a developer. |
| **6 — UX simplification** | **DONE** | The shared class context (`lib/context/class-context.tsx`, `components/context/ClassContextBar.tsx`), used by 7 pages. `NoAccess.tsx` gives a 403 a recovery path. The failure classifier (`lib/api/interceptors.ts`) sorts every failure into a kind. Audit coverage spans 40+ `@Audited` sites. Reports are archived, not deleted. |
| **7 — Verification sweep** | **PARTIAL** | The build/lint/test sweep passes. The browser walk has **not** been done — Chrome DevTools MCP failed to connect (see R7.1). |
| **8 — Documentation** | **PARTIAL** | `docs/PROGRESS.md` and `docs/DECISIONS.md` are current. `docs/AUDIT.md`, `docs/ARCHITECTURE.md`, `docs/API.md`, `docs/END_USER_GUIDE.md`, `docs/FINAL-REPORT.md` are outstanding — see R8. |

---

## Remaining work, in order

### R0 — Housekeeping (done this session)

- R0.1 ✅ Restored the `pnpm.cmd` shim so turbo can find the package manager.
- R0.2 ✅ Removed 12 lint errors (dead code in the scheme-reader/PDF layers).
- R0.3 ✅ Removed the literal GROQ key from `AGENT-PROMPT.md:887`. It was in a
  **tracked** file. The key remains only in `apps/backend/.env`, which is
  gitignored — the correct place. **The key should still be rotated**, because
  it is in the file's history. Source code was already clean; this was the only
  committed copy.
- R0.4 ✅ Added the `GROQ_*` variables to `apps/backend/.env.example`, which had
  none, so a fresh deployment had no way to know the key was optional.

### R1 — Phase 1: close the authorisation gaps

- **R1.1 — The correction flow is unreachable from the UI.** ✅ **DONE.**
  New screen `apps/frontend/app/(authenticated)/marks/correct/page.tsx`, gated
  on `marks:write` through `RequirePermission` and registered in the shared
  catalogue as `SCREENS.MARK_CORRECTION`. The marks screen shows a
  "Correct a mark" link only to a member holding `marks:write`, carrying the
  subject and component it was reached from. The endpoint, service and hook
  were added (`ENDPOINTS.MARKS.CORRECT`, `marksService.correct`,
  `useCorrectMark`).
- **R1.2 — A correction overwrites the teacher's original marks.** ✅ **DONE.**
  New `MarkRevision` model (`schema.prisma:610`) with migration
  `20261115000100_add_mark_revisions`. `MarksRepository.createAsCorrection`
  writes the replaced value, the new value, the reason and the overridden
  teacher to a revision row. `Mark.revisions` holds the history; the revision
  row is append-only and cascades only with its mark.
- **R1.3 — A correction does not name the overridden teacher in the audit
  log.** ✅ **DONE.** `MarksAuthorisationService.assertMayWrite` now returns
  `{ overriddenTeacher }` — the teacher whose allocation the write overrides.
  `MarksService.create` passes it to `createAsCorrection`, which records the
  teacher's id and name on the revision row.
- **R1.4 — The upload-confirm path duplicates the allocation rule and omits
  the correction rule.** ✅ **DONE.** `UploadService` now injects
  `MarksAuthorisationService` (`UploadModule` imports `MarksModule`), and the
  exam-cell branch of the confirm path asks the shared service whether it may
  write each offering. An exam-cell upload that covers a subject a teacher
  holds is now **refused**, with a message pointing at the correction flow —
  previously it silently overwrote the teacher's marks with no reason and no
  correction audit. The teacher's own path keeps the "skip unallocated rows"
  behaviour, because a printed statement commonly covers the whole class.
- **R1.5 — `activate` bypasses `restore`.** ✅ **DONE.** `UsersService.activate`
  had no callers and set `isActive` without bumping the RBAC cache version.
  It was removed; `restore` (which requires a reason, bumps the cache version
  and audits) is now the only way back. The frontend's `useSetMemberActive` and
  `useDeleteMember` were replaced by `useRevokeMember` and `useRestoreMember`.
- **R1.6 — The capability parity test never compares the shared catalogue
  against the backend's `@Permissions()` decorators.** ✅ **DONE.**
  New `apps/backend/src/common/constants/route-permissions.spec.ts` reads
  every controller's source, extracts each route's `@Permissions(...)`, and
  asserts four things: the parser really read the routes (so the assertions
  are not vacuous); every route is permission-guarded or is on an explicit
  exemption list of public and member-scoped routes; every permission named
  is one the shared catalogue defines; and every catalogue permission is
  either used by a route or named as frontend-only.
  **The test found a real mismatch**: `POST /subject-offerings` required
  `subjects:write` while the frontend's "Add subject offering" screen
  requires `subject_offerings:write` — the catalogue's own rule says an
  offering "has its own permission because it is a different record with a
  different owner". The offering routes now use the offering permissions.

### R2 — Phase 2: close the revocation gaps

- **R2.1 — "Class teacher required" does not exist as a state.** ✅ **DONE.**
  New `GET /class-teacher-assignments/needs-teacher`
  (`allocations.controller.ts:179`), backed by
  `AllocationsRepository.findClassesNeedingTeacher`, which derives the classes
  that exist (those with subject offerings), removes the ones with a class
  teacher, and keeps those with students. Shown on the assignments screen
  (`admin/assignments/page.tsx`) as a panel above the list, with an "Assign"
  action on each row.
- **R2.2 — The consequence-preview endpoint is never called by the UI.** ✅ **DONE.**
  New `RevocationImpactDialog` component
  (`components/feedback/RevocationImpactDialog.tsx`) fetches
  `GET /users/:id/revocation-impact` and shows the server's consequence
  sentences, plus a required reason, before the administrator confirms. The
  members screen's deactivate button opens it instead of calling the API
  directly, and the raw `window.confirm` — which wrongly said "permanently
  deletes" for what is actually a soft delete — is gone. The dialog also
  handles restoration, which the list previously could not do at all.
- **R2.3 — Reassignment confirmation is unverified.** ✅ **DONE.**
  The backend was **silently overwriting**: `createClassTeacherAssignment`
  found the existing assignment and updated it, with nothing to say so. It now
  refuses an unconfirmed replacement with a 409 naming the current class
  teacher, and `CreateClassTeacherAssignmentDto.replacesExisting` is the
  explicit flag. The frontend sheet shows who is being replaced and what
  ends ("their access to this class's statistics"), with a checkbox to
  confirm, and the save button stays disabled until it is ticked. The
  frontend's old delete-then-create dance was removed — the backend's
  replacement is atomic, so the class is never left without a teacher because
  a second step failed.

### R3 — Phase 3: close the scheme-pipeline gaps

- **R3.1 — An end user is still asked to type raw JSON.** 🔄 **IN PROGRESS**
  (delegated). `components/forms/SchemeFormFields.tsx:108` renders a textarea
  labelled "Rules (JSON)"; `admin/schemes/page.tsx:99` renders
  `JSON.stringify(scheme.rules)` in a `<pre>`. §4.6 of the spec requires
  structured, labelled inputs with derived numbers. **This is a hard
  non-negotiable (D1).**
- **R3.2 — The `.env.example` gap** — done (R0.4).

### R4 — Phase 4: the student model and profile

- **R4.1 — Widen the `Student` model** with the real-world fields §2.8.1
  lists, and migrate. PII must be permission-gated: a teacher must not see a
  student's Aadhaar or guardian phone; a Principal must not see Aadhaar.
- **R4.2 — Build the student profile screen** §2.8.2: identity, academic
  snapshot, marks history per semester, result history, documents, activity
  trail, actions. Permission-aware per role.
- **R4.3 — Student history must survive semester progression.** No per-student
  enrolment record exists, so Sem 1 marks cannot be reliably attributed to the
  semester they were earned in.
- **R4.4 — Bulk student login provisioning** for a whole class.

### R5 — Phase 5: the running academic year

- **R5.1 — `resolveAcademicYear()` is not date-derived.**
  `common/utils/academic-year.ts:18` picks `isActive: true`, else the latest by
  `startDate`. It **never** compares today's date against
  `AcademicYear.startDate`/`endDate`, even though both exist on the model
  (`schema.prisma:311-312`). DECISIONS §3.2 and §2.7 require the running year
  to be derived from today's date.

### R6 — Phase 6: close the UX and audit gaps

- **R6.1 — `lib/api/interceptors.ts` is a 5-line `export {}` placeholder.**
  ✅ **DONE.** Replaced with a real failure classifier
  (`describeFailure`, `isRetryable`) that sorts every failure into exactly
  one kind — session-expired, no-access, not-found, invalid, conflict,
  too-many, server-error, network — and says whether a retry can help. The
  network case is decided first and is deliberately **not** a server error:
  nothing went wrong on the server's side, because the server was never
  asked. Covered by `apps/frontend/__tests__/lib/api/interceptors.spec.ts`.
  `extractErrorMessage` in `hooks/useAuth.ts` gained the missing **422/400**
  and **network/timeout** cases.
- **R6.2 — Reports are not audited.** ✅ **DONE.**
  `AuditResource.REPORT` added to `common/decorators/audited.decorator.ts`,
  and both report mutations are audited — `POST /reports`
  (`AuditAction.CREATE`) and the archive (`AuditAction.DELETE`, with the
  reason).
- **R6.3 — `AuditResource` has no member for academic year, examination or
  report.** ✅ **DONE.** `REPORT`, `ACADEMIC_YEAR` and `EXAMINATION` added.
- **R6.4 — Reports were hard-deleted.** ✅ **DONE** (found during R6.2).
  `ReportsRepository.delete` called `prisma.report.delete` — a hard delete of
  a statement about a class's results, which the spec forbids. Reports are now
  **archived**: migration `20261115000200_archive_reports` adds `isArchived`,
  `archivedAt`, `archivedBy` and `archiveReason`; the file is released and
  the row is kept. The report list filters to live reports by default. The
  frontend had no delete action at all, so `DELETE /reports/:id` was
  unreachable dead code — it is now reachable through a new
  `ArchiveReportDialog` that requires a reason.

### R7 — Phase 7: verification sweep

- **R7.1 — Walk every screen at three breakpoints.** ✅ **DONE.**
  Chrome DevTools MCP could not connect in this environment
  (`CONNECT_TIMEOUT`), but the walk was done anyway: a small Chrome
  DevTools Protocol driver (`test-data/cdp.js`) drives a real Chrome over
  the same protocol the MCP server uses — clicking, typing, resizing,
  screenshotting, and reading the console and the network.
  Every screen of every role was opened at **375, 820 and 1440 pixels**.
  The findings are in `latest-bugs.md`. **No screen scrolls sideways** at any
  of the three widths.
- **R7.2 — Walk every role's journey.** ✅ **DONE.** All six roles signed
  in through the real login form and every screen they are offered was
  opened. Every refusal is a refusal **with a way back** — no dead end was
  found. The walk found four real bugs, all now fixed and verified.
- **R7.3 — Verify actual API responses carry no field the caller may not
  see.** ✅ **DONE.** `student-profile.permissions.spec.ts` asserts that a
  teacher's response carries no national identity reference and no guardian
  phone, and that a Principal's carries no national identity reference. The
  profile service **omits** the section rather than blanking it, so the
  field is absent from the payload, not merely hidden.

### R8 — Phase 8: documentation

- R8.1 `docs/AUDIT.md` — every screen and every route: permission, scope,
  data returned, gaps.
- R8.2 `docs/ARCHITECTURE.md` — the modules, the authorisation spine, the
  data model.
- R8.3 `docs/API.md` — every endpoint: permission, scope, errors.
- R8.4 `docs/END_USER_GUIDE.md` — per role, in plain language.
- R8.5 `README.md` — refresh for the hardened system.
- R8.6 `docs/GOAL-CHECKLIST.md` — the final pass, every line PASS with
  evidence or a Known Gap with a reason.
- R8.7 `docs/FINAL-REPORT.md` — what was verified and what was not.

### R10 — Found by the browser walk

- **R10.1 — The student could not open the Toppers screen.** ✅ **DONE.**
  The link was offered and the screen refused. The screen now branches: a
  member holding only `toppers:read_own_class` sees their own class's
  leaderboard, with no filters and no subject-wise tab.
- **R10.2 — There was no academic-structure screen.** ✅ **DONE.**
  `GET /academic/structure` and the **Academic Structure** screen: branches
  → classes → subjects, with the teacher of each subject, the class
  teacher, the number of students, and how many still have marks missing.
- **R10.3 — The HOD and the Principal could not see any marks.** ✅
  **DONE.** They held `marks:read` and had no screen behind it. The Marks
  screen now opens for them and is read-only — no Save button, no editable
  cells.
- **R10.4 — The sidebar's toggle was 40 pixels on a phone.** ✅ **DONE.**
  It is now the design system's 44-pixel icon button.
- **R10.5 — The logo link was 32 pixels tall on a phone.** ✅ **DONE.**
  It now meets the 44-pixel minimum.
- **R10.6 — The seeded Super Admin had a stray ADMIN role.** ✅ **DONE.**
  Test data had left `admin@dbatu.edu` holding both roles, which gave it
  every academic write permission. The stray role was removed and the
  account's permissions now match `new-requirements.md` §3.2 exactly.
- **R10.7 — The class-teacher assignment is on a different screen from the
  structure.** ⬜ **OPEN.** The structure screen says "No class teacher"; the
  assignment is still done on the Assignments screen. Joining them is a
  design decision, recorded rather than made silently.

### R9 — Found by the matrix verification

- **R9.1 — `GET /marks` was closed to the HOD and the Principal.** ✅
  **DONE.** The route named `marks:read` and `marks:enter_own_subject` under
  the guard's "all of" rule, and neither role holds both. Fixed with the new
  `@AnyPermission` decorator; nine further instances were found and fixed at
  the same time. `route-reachability.spec.ts` now asserts that every role
  holding one of a route's permissions can open that route.
- **R9.2 — The widened Student model disagreed with its own migration.**
  ✅ **DONE.** Four columns were declared without their `@map`, so the
  client asked for `students.bloodGroup` while the column was
  `students.blood_group`; every read of a student failed with a 500.
  `gender`, `bloodGroup`, `status`, `section` (on both `Student` and
  `StudentEnrollment`) now carry their maps.
- **R9.3 — `POST /subject-offerings` guarded on the wrong permission.** ✅
  **DONE.** It required `subjects:write` while the catalogue gives an
  offering its own permission. The offering routes now use the offering
  permissions.
- **R9.4 — A student's own result never loaded.** ✅ **DONE.** The frontend
  called `/students/my-result` while the server serves `/my-result`, so the
  request fell through to the roster's `GET /students/:id` and was refused.
  The same for `/students/my-toppers`. Found by the API documentation agent
  and confirmed against the live API.
- **R9.5 — A whole class's marks timed out.** ✅ **DONE.** The bulk write of
  twenty students across six subjects exceeded the thirty-second default and
  the request was cut off — leaving the member unable to tell which rows
  were saved. The bulk route now declares a two-minute timeout on both sides,
  and the write is still **whole**.
- **R9.6 — The examination lifecycle was modelled but not exposed.** ✅
  **DONE.** The `Examination` model had a `PENDING → PROCESSING → PUBLISHED`
  lifecycle and two permissions granted to the exam cell, but no module, no
  route and no screen. The `examinations` module, its five routes and the
  "Publish results" screen are now in place, and the whole cycle is verified
  end to end against the running application by
  `prisma/verify-publication.ts`.
- **R9.7 — The academic-years screen had no create button.** ✅ **DONE.**
  The backend route existed; the screen did not use it and its empty state
  told the member to ask a Super Admin to "add a year there". The screen
  now opens a year with its dates, and can change which year is running.
- **R9.8 — The students list removed a student behind a browser prompt.**
  ✅ **DONE.** A bare `window.confirm("Delete {name}?")` that said nothing
  about the consequence. It now opens a dialog that says the student is
  **archived** and their marks are kept.

---

## Notes carried forward

- **No git commands are run in this session.** The user manages version
  control themselves.
- **The code is the source of truth.** Where `new-requirements.md` and the code
  disagree, the code wins and the document is corrected (DECISIONS §7).
- **The GROQ key is in `apps/backend/.env` and in the history of
  `AGENT-PROMPT.md`.** The user should rotate it. The app must degrade
  gracefully when it is absent — that path is already implemented and tested.
