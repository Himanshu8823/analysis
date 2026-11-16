# Final Report — Production Hardening

The report on what was done, what was verified, and what was not.

**Date:** 2026-11-16
**Spec:** `AGENT-PROMPT.md` — the binding mandate
**Work plan:** `docs/PROGRESS.md`
**Decisions:** `docs/DECISIONS.md` (18 sections)
**Evidence:** `docs/AUDIT.md`, `docs/GOAL-CHECKLIST.md`

---

## 1. Goal status

The production-ready checklist has 41 lines.

| Status | Count |
|---|---|
| **PASS** | **35** |
| **PARTIAL** | 2 |
| **KNOWN GAP** | 4 |
| **FAIL** | 0 |

Every PASS line carries evidence in `docs/GOAL-CHECKLIST.md` — a file and a
line, a test that was run, or a check against the running application. No
line is marked PASS on the strength of "the code looks right".

**The single biggest thing still standing between this app and a college
trusting it with its results: the calculator's untested edge cases.**

The three calculators are believed correct, and the case that had caused
real harm — a subject with no marks is *pending*, not *failed*, so a
half-entered class is not reported as a class where everybody failed — is
covered for all three schemes. What is **not** covered by a test is the
practical-only subject, the withheld mark, the partial entry within a
component, and the co-curricular option choice. Marks are the one thing a
college cannot check by eye twice, so this is where the next session
should start.

---

## 2. What was broken

Every defect found, in plain language, with where it was.

### The authorisation spine

| # | Defect | Where |
|---|---|---|
| 1 | **A teacher could write any mark in the college.** The allocation guard existed and was called by nothing — it was theatre. | `marks.service.ts` |
| 2 | **The exam cell could write marks for a subject a teacher holds.** The guard let it through with no correction, no reason, and no record of whose work it overwrote. | `marks.authorisation.service.ts` |
| 3 | **A student's own record could not be read.** `GET /students/:id/profile` required `students:read` **and** `students:read_own` — and no role holds both. The screen was dead for everyone, including the student it exists for. | `student-profile.controller.ts` |
| 4 | **The HOD and the Principal could not open the marks screen.** `GET /marks` named two permissions under an "all of" rule; neither role holds both. The screen was in their navigation and the server refused it. | `marks.controller.ts` |
| 5 | **The route that writes marks was guarded on a permission to *look* at an upload.** `POST /upload/jobs/:jobId/confirm` required `upload:read`. | `upload.controller.ts` |
| 6 | **An exam-cell upload could overwrite a teacher's marks** — silently, with no reason and no correction record. | `upload.service.ts` |
| 7 | **The offering routes guarded on the subject's permission**, while the catalogue gives an offering its own. | `subject-offerings.controller.ts` |
| 8 | **The student's own result never loaded.** The frontend called `/students/my-result`; the server serves `/my-result`. The request fell through to the roster's `GET /students/:id` and was refused. | `lib/api/endpoints.ts` |

### The revocation lifecycle

| # | Defect | Where |
|---|---|---|
| 9 | **Revoking a member left their allocations behind.** Their subject allocations, their class, their roles and their sessions all survived. | `users.service.ts` |
| 10 | **A revoked member kept a valid token** until it expired. | `member-revocation.service.ts` |
| 11 | **"Class teacher required" existed only as a phrase in a comment.** No constant, no field, no endpoint. A class whose teacher was revoked simply went missing. | `member-impact.service.ts` |
| 12 | **The consequence preview existed on the server and was never called.** The member screen called `deactivate` directly. | `admin/members/page.tsx` |
| 13 | **The member screen's confirmation was a browser prompt that said a soft delete "permanently deletes the account".** | `admin/members/page.tsx` |
| 14 | **There was no way to change a member's roles at all.** | `rbac/user-roles.controller.ts` |
| 15 | **Replacing a class teacher was a silent overwrite**, taking away somebody's access to a class with no warning. | `allocations.service.ts` |
| 16 | **A dead `activate` bypassed `restore`**, so a re-activated member's cached permissions stayed stale until the TTL expired. | `users.service.ts` |

### Data integrity

| # | Defect | Where |
|---|---|---|
| 17 | **A correction destroyed the mark it replaced.** The teacher's original entry was gone. | `marks.repository.ts` |
| 18 | **A correction did not name the teacher it overrode.** The audit trail could not say whose work had changed. | `marks.authorisation.service.ts` |
| 19 | **Reports were hard-deleted.** A statement about a class's results could vanish. | `reports.repository.ts` |
| 20 | **The widened Student model disagreed with its own migration** — four columns had no `@map`, so every read of a student failed with a 500. | `prisma/schema.prisma` |
| 21 | **A whole class's marks timed out** at thirty seconds, leaving the member unable to tell which rows were saved. | `marks.controller.ts` |

### The end user's experience

| # | Defect | Where |
|---|---|---|
| 22 | **An administrator was asked to type raw JSON** to define a scheme's pass rules. | `SchemeFormFields.tsx` |
| 23 | **The correction flow had no screen.** The exam cell had no route to a correction. | — |
| 24 | **The publication step did not exist.** A college's cycle ended with "publish the result", and that act was not in the application. | — |
| 25 | **An academic year could only be added by re-running the seed.** | `seed.ts` |
| 26 | **The running year was a flag, not a date.** The system could not work out which year the college was in. | `academic-year.ts` |
| 27 | **`interceptors.ts` was a placeholder** (`export {}`), and there was no 422 or network case in the error mapping. | `lib/api/interceptors.ts` |
| 28 | **A permission refusal said "Insufficient permissions"** — a developer's phrase on a college clerk's screen. | `permissions.guard.ts` |
| 29 | **The students list removed a student behind a browser prompt** that said nothing about the consequence. | `students/page.tsx` |
| 30 | **The GROQ key was committed in plaintext** in a tracked document. | `AGENT-PROMPT.md` |

---

## 3. What was changed, by phase

### Phase 1 — The authorisation spine

- **One gate for every mark write.** `MarksAuthorisationService.assertMayWrite`
  decides, from the caller's permissions, whether a write is allowed for an
  offering — and it is called by the single create, the bulk create, the
  update, the delete, the correction **and** the upload-confirm path. One
  rule, six paths.
- **"Any of" and "all of".** A new `@AnyPermission(...)` decorator says a
  route needs *at least one* of the permissions it names; `@Permissions(...)`
  keeps its meaning of *all*. Nine routes that locked out the roles they
  were written for were found and fixed.
- **The correction is a different operation.** It needs a reason, it is
  recorded under its own audit action, and it keeps the value it replaced on
  a `MarkRevision` row, naming the teacher whose work it replaced.
- **The upload path asks the same question.** The exam cell can no longer
  overwrite a teacher's subject through an upload.
- **Every route is checked against the catalogue** — and every role that
  holds one of a route's permissions can open that route.

### Phase 2 — Revocation and lifecycle

- **One revocation, in one transaction.** The account is deactivated, every
  session revoked, every invitation withdrawn, every allocation released, the
  roles removed, the cache version bumped and the change audited. The marks
  stay, and still name their author.
- **The consequence preview is on the screen.** The dialog says what will
  be released and which classes will lose their teacher, and asks for a
  reason.
- **"Class teacher required" is a real state.** A new endpoint lists the
  classes that have students and no class teacher, and the assignments screen
  shows them, with an "Assign" action on each.
- **A replacement is confirmed.** The screen names who is being replaced and
  what ends; the server refuses an unconfirmed replacement.

### Phase 3 — The scheme pipeline

- **No raw JSON.** The scheme form is a component-breakdown editor with
  labelled rows, a practical toggle whose consequence is spelled out
  ("A student must score at least 13/25 in the practical to pass"), and live
  totals. The numbers are derived and confirmed, never typed.
- **The AI proposes; the human disposes.** The review table is editable —
  every field, a row to delete, a row to add — and nothing reaches the
  database without the reviewer's confirmation.
- **The reader's schema is positional.** The model was answering with
  `tables_meta_meta_meta…` until it ran out of tokens, because the schema
  allowed an array at every position. Each position now says what it holds.
- **The key is configuration.** `GROQ_API_KEY`, never hard-coded, never
  logged; the app works without it.

### Phase 4 — The student

- **The model is a real college's model.** Date of birth, gender, contact,
  address, identity (gated), category and quotas, one and a second guardian,
  and a status lifecycle with a reason and a date.
- **The profile is a real screen.** Identity, academic snapshot, marks
  history, result history, documents and activity — each section present
  only if the caller may see it.
- **The history survives.** `StudentEnrollment` records where a student
  *was*, so a Sem 5 student's Sem 1 result is still there.
- **A class can be given its logins** in one action.

### Phase 5 — The dashboard and the academic year

- **The dashboard is role-aware.** Four scopes, decided by permission.
- **The running year is a date.** The year whose window contains today.
  The gap cases — before the first year, between two years, after the last —
  are documented and handled.
- **A year can be opened, and changed.** One year runs at a time; making a
  year the running one retires the previous in the same transaction.

### Phase 6 — The user's experience

- **One class context**, shared and remembered, on seven screens.
- **A failure is a kind.** Session-ended, no-access, not-found, invalid,
  conflict, too-many, server-error, network — and the network case is
  deliberately *not* a server error, because the server was never asked.
- **Reports are archived**, not deleted.
- **The publication screen.** The last step of the cycle.

### Phase 7 and 8 — Verification and documentation

- **The matrix, verified against the running application.** 96 of 96.
- **The publication cycle, verified against the running application.** Every
  expectation met.
- **879 tests**, and four parity suites that keep the frontend, the backend
  and the shared catalogue in step.
- **Six documents** written.

---

## 4. The permission matrix, as it stands

Verified by signing in as each role against the running application.

| Role | May | May not |
|---|---|---|
| **Super Admin** | Configure branches, academic years, schemes, offerings, members and roles; read the whole college's academic data; read the audit trail | Enter marks, add students, upload results, allocate teachers, publish a result, write a score |
| **Admin** (exam cell) | Create students and subjects; enter marks; approve a whole extraction; generate and download reports; open and publish examinations; read the sensitive identity data and the guardian details | Write a score for a subject a teacher holds (that is a correction, with a reason and a record); allocate teachers; configure the college |
| **HOD** | Read their branch's students and marks; generate reports; write subjects and offerings; allocate teachers and class teachers | Enter marks; write students outside their branch; administer the college; write a score |
| **Principal** | Read the academic picture and the audit trail; generate reports | Write anything at all; see the sensitive identity data |
| **Teacher** | Enter marks for the subjects the HOD allocated to them; see their own students and their own class's statistics; upload a statement | Write a score for a subject they were not allocated; see another teacher's marks; administer anything; publish a result |
| **Student** | Their own result, their own marks, their own class's toppers, their own profile | The college's roster, the mark sheet, the reports, the administration, any other student's record |

**The two rules that carry it.** A route that names several permissions and
is used by roles with *different* permissions says "any of"; a route whose
permissions are meant to be held *together* says "all of". And a scope is
never taken from a parameter — the branch comes from the caller's role
assignment, and a request for a branch outside it is refused rather than
quietly redirected.

**Why each decision.** The exam cell defines what a subject is worth and the
teacher writes what a student scored — the user's own complaint was *"the
admin can put marks for a subject, and that is wrong"*. The Super Admin
configures the college and does not teach it. The Principal reads and does not
write. The teacher is bounded by their allocations. The student sees their
own record and nothing else. Every one of those is a **permission**, never a
role name, and the union of a member's roles is what the guard sees.

---

## 5. The scheme pipeline, end to end

```
Upload a scheme PDF
  → the server finds the table and reduces it to a compact positional slice
  → GROQ reads the slice and returns structured rows (temperature 0)
  → the server validates every row — the marks must add up to 100
  → the REVIEWER edits, deletes and adds rows in a table
  → the reviewer confirms
  → subjects and subject offerings are written
```

**What the AI does.** It reads a printed table and copies its cells across.
It does not decide anything.

**What the human does.** Everything that matters. The review table is
editable in every field; a row the parser got wrong can be deleted; a row
it missed can be added; every row's marks must add up to 100 before the
confirmation is offered.

**How it fails safely.**

| Failure | What happens |
|---|---|
| No key | The app works; the scheme is entered by hand. The screen says so. |
| The provider refuses | A clear message; the manual route stays open. |
| The model answers wrongly | Validation catches it — a course whose marks do not add to 100 is rejected, and the reviewer sees the reason. |
| The model answers with garbage | The schema refuses it; nothing reaches the database. |
| A page could not be checked | It is reported as **"Partly checked"** with the page numbers named — never as checked. |
| The reader is slower than the provider's limit | The calls are paced by a configurable gap, and a page too large for the answer budget is read **in pieces**, never truncated. |

**The one thing the model cannot do:** decide that a mark is right. It never
writes to the marks table.

---

## 6. Edge cases covered

| Case | Covered by |
|---|---|
| Writing a subject you were not allocated | `marks.authorisation.service.spec.ts` |
| The exam cell writing a teacher's subject | The same, plus `verify-publication.ts` live |
| A correction naming the teacher it overrode | The same |
| A bulk write refused whole | The same |
| A revoked teacher who still holds a token | `member-revocation.service.ts` — the tokens are revoked in the same transaction |
| A class teacher whose class has no other teacher | The "class teacher required" endpoint |
| A subject offered in two branches / semesters / schemes | `StudentEnrollment` and the unique constraints |
| An AI response that is malformed | `scheme-reader.service.spec.ts` |
| A PDF with no text layer | The OCR path, and the reader's own tests |
| A student with no linked login | `student-profile.permissions.spec.ts` |
| A student with marks in a previous semester | `StudentEnrollment`; the profile reads it |
| A bulk operation where one row is invalid | The bulk import reports per-row failures; the bulk mark write refuses the batch whole |
| An empty class, a class with no subjects, a subject with no teacher | The empty states on the screens; the "needs teacher" endpoint |
| A concurrent edit of the same mark | **NOT COVERED** — see the known gaps |
| An academic year whose dates have passed | `running-year-parity.spec.ts` |
| A class whose result is incomplete | `verify-publication.ts` live |
| A publication that is repeated | The same |
| A route that locks out the roles it was written for | `route-reachability.spec.ts` |
| A fixed width that overflows a phone | `responsive.spec.ts` |

---

## 7. Migrations

Ten migrations, all applied to the live Neon database.

| Migration | What it does |
|---|---|
| `20260101000000_init` | The base schema. |
| `20260101000100_add_invite_and_member_fields` | The invitation and member fields. |
| `20260101000200_add_password_reset_tokens` | The password-reset tokens. |
| `20260101000300_add_invite_superseded_by` | A superseded invitation. |
| `20261025000000_split_subject_offering` | Splits `Subject` from `SubjectOffering`. |
| `20261101000000_add_user_avatar_url` | The member's photograph. |
| `20261102000000_drop_redundant_year_columns` | Drops `SubjectOffering.year` and `Student.currentYear` — the year is derived from the semester. |
| `20261115000000_widen_student_model` | The real-world student fields, the status lifecycle, and `student_enrollments`. **Backfills** every existing student to `ACTIVE` with a status date, and creates one enrolment row per existing student. |
| `20261115000100_add_mark_revisions` | The revision history — the value a correction replaced, the reason, and the teacher whose work it replaced. |
| `20261115000200_archive_reports` | `isArchived`, `archivedAt`, `archivedBy` and `archiveReason` on `reports`. Existing rows are live. |

**The backfill.** The two migrations that touch existing rows backfill
them: every student becomes `ACTIVE` with a status date of its creation
date, and every existing student gets an enrolment row for the semester
they are currently in. No row is left without a value, and no row is left
violating a new constraint.

**The seed stays idempotent.** Its permission mapping is *declared*, not
accumulated: a permission removed from a role's list is deleted on the next
run rather than lingering. Re-running it is clean.

---

## 8. What was verified, and what was not

### Verified by running it

| What | How | Result |
|---|---|---|
| The build | `pnpm build` | 5/5 tasks, 40 frontend routes |
| The lint | `pnpm lint` | 0 errors |
| The tests | `pnpm test` | **879 tests, 37 suites, 0 failures** |
| The migrations | `pnpm db:migrate` | 10 applied, cleanly |
| The seed | `pnpm db:seed` | Idempotent, clean |
| **The authorisation matrix** | `prisma/verify-matrix.ts` — sign in as each of the six roles, call sixteen routes | **96 of 96** |
| **The publication cycle** | `prisma/verify-publication.ts` — the whole cycle, including the refusals | **Every expectation met** |
| **The browser walk** | A real Chrome, every screen of every role, at three widths | **Four real bugs found and fixed** |
| **The students' own result** | The live API | `/my-result` answers with the student's own result |
| **The 500s** | The live API | Gone — they were the schema/migration disagreement |

The accounts for the matrix were made **through the product's own
invitation flow**, and the acceptance link was read from the invitation
email. The application created the account, assigned the role, set the
branch scope and sent the email — nothing was written to the database
behind the product's back.

**The browser walk.** Chrome DevTools MCP could not connect in this
environment, so the walk was done with a small Chrome DevTools Protocol
driver (`test-data/cdp.js`) that drives a real Chrome over the same
protocol — clicking, typing, resizing, screenshotting, and reading the
console and the network. Every screen of every role was opened at **375,
820 and 1440 pixels**.

What it found — all four fixed and verified, written up in
`latest-bugs.md`:

1. **The student could not open the Toppers screen.** The link was offered
   and the screen refused. The screen now branches: a student sees their
   own class's leaderboard.
2. **There was no academic-structure screen** — the screen the college
   navigates by. Built: `GET /academic/structure` and the **Academic
   Structure** screen.
3. **The HOD and the Principal could not see any marks.** They held
   `marks:read` and had no screen behind it. The Marks screen now opens
   for them, read-only.
4. **Two touch targets were under 44 pixels** on a phone — the sidebar's
   toggle and the logo link. Both are now 44.

What it confirmed: **no screen scrolls sideways** at any width, and
**every refusal has a way back**. Not one dead end was found.

### Verified by reading the source

| What | How | Result |
|---|---|---|
| The responsive contract | `responsive.spec.ts` — reads every screen | No fixed width that could overflow a phone; every table scrollable, stacked or from the shared `DataTable`; every icon button 44 pixels |
| The PII gating | `student-profile.permissions.spec.ts` — 8 cases | The teacher's payload carries no national identity reference and no guardian phone; the Principal's carries no national identity reference; a section the caller may not see is **absent**, not blank |
| The calculators | `scheme-calculator.spec.ts` — all three schemes | The pending-versus-failed distinction, absent-as-failed, and the pass/fail counts |
| The reader | `scheme-reader.service.spec.ts` — 22 cases; `document-renderer.document.spec.ts` and `.real-pdf.spec.ts` — 16 cases against the real 38-page university document | Every course's marks add up to 100; no row shattered |
| The error filter | `http-exception.filter.spec.ts` | A Prisma error, a foreign-key error, a missing-file error and a connection-string error leak no table name, column name, file path or credential |
| The scope | `scope.service.spec.ts` | A branch-scoped read never returns a record outside the caller's branch |

### NOT verified

| What | Why |
|---|---|
| **The keyboard path.** | The browser walk was done with the mouse. Every action was done with a click; the keyboard route — tabbing to a control, pressing Enter to submit, escaping a dialog — was not walked. The components use Radix primitives, which manage focus and keyboard behaviour, but that was not verified in the browser. |
| **The contrast ratios.** | The colours come from the design system and were not re-measured. |
| **The forms were opened, not saved.** | Each "add" button was clicked and the dialog was read — but nothing was submitted, so a save that fails silently was not looked for. Submitting would write to the college's data, which a verification run should not do without being asked. |
| **The charts were not read for correctness.** | They were checked for rendering, for their size, and for not breaking the layout — not for whether the numbers they draw are the right numbers. |
| **The coverage percentage.** | No threshold is configured and no coverage run was made. The critical paths are covered by behaviour; the number is not measured. |
| **The concurrent-edit case.** | Not implemented — see the known gaps. |
| **The Redis cache path.** | Redis was not connected in the verification environment. The permission cache falls back to the database, so authorisation is unaffected, but the cached path was not exercised. |

---

## 9. Known gaps

Real, unfinished things. Not placeholders.

1. **Concurrent edits are not detected.** The `Mark` and `Student` models
   carry no version column, so two people editing the same record produce a
   silent overwrite. The fix is a version column and a 409 on a stale
   write. This is the one **data-integrity** gap, and it is the one that
   would matter on a busy day with two teachers entering marks.

2. **The calculator's edge cases are not all covered.** A practical-only
   subject, a withheld mark, a partial entry within a component and a
   co-curricular option choice have no test. The calculators are believed
   correct; "believed" is not "verified".

3. **The class-teacher assignment is on a different screen from the
   structure.** The new **Academic Structure** screen says *"No class
   teacher"* for a class that has none — but appointing one still happens on
   the Assignments screen. A member reading the gap has to know to go
   somewhere else to close it. Joining the two is a design decision, and it
   is recorded here rather than made silently.

4. **Notifications have no screen.** The routes are there and guarded, and
   `notifications:write` is granted to the exam cell — but there is no
   inbox and no composer.

5. **A student without a recorded email cannot be provisioned.** The flow
   exists for one student and for a class; a student whose email was never
   recorded cannot receive a login, and the screen says so.

6. **`packages/design-system` is empty.** It holds only a `.gitkeep`, and
   nothing imports it. `CLAUDE.md` names it as the token source of truth,
   but the tokens actually live in `apps/frontend/app/globals.css` and the
   components in `apps/frontend/components/ui/`. The rule is honoured; the
   package is not the place it is honoured from.

7. **The GROQ key should be rotated.** It was committed in plaintext in
   `AGENT-PROMPT.md` before this work began. The literal was removed, but
   it is in the file's history. The app must also be re-seeded after a
   rotation so the running configuration picks it up.

---

## 10. What the operator must run

```bash
# 1. Install
pnpm install

# 2. The environment
cp apps/backend/.env.example apps/backend/.env
#    Then set DATABASE_URL, JWT_SECRET, REFRESH_SECRET and the SMTP
#    settings. GROQ_API_KEY is optional — without it the scheme is
#    entered by hand.

# 3. The database
pnpm db:migrate
pnpm db:seed

# 4. Build, lint, test
pnpm build
pnpm lint
pnpm test

# 5. Run
pnpm dev
```

**The verification scripts** (against a running backend):

```bash
# The authorisation matrix — every role, sixteen routes.
pnpm --filter @result-analysis/backend exec ts-node -r tsconfig-paths/register prisma/verify-matrix.ts

# The publication cycle.
pnpm --filter @result-analysis/backend exec ts-node -r tsconfig-paths/register prisma/verify-publication.ts
```

**The mail capture** — a local postbox for the verification, so the
invitation email can be read:

```bash
pnpm --filter @result-analysis/backend exec ts-node -r tsconfig-paths/register prisma/mail-capture.ts
# then start the backend with SMTP_HOST=127.0.0.1 SMTP_PORT=2525
```

**The seed prints the Super Admin's credentials.** Only that one account is
created; the other five roles are made through the invitation flow, exactly
as a college makes them.

---

## 11. In one paragraph

The authorisation spine is now one mechanism rather than a set of
disconnected checks, and it was verified by asking the running application
as each of the six roles — which found three real defects that no amount of
reading would have. The college's cycle is complete: it ends with the moment
a class's result becomes the college's answer, and that act is refused
unless every student's result is in. Marks are protected by a revision
history that keeps what a correction replaced and names whose work it
overrode. The raw JSON box is gone. The screens say what a college clerk
needs and nothing else. What is left is the calculator's untested edge
cases, the concurrent-edit guard, and a browser walk that this environment
could not provide.
