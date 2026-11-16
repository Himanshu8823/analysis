# AUTONOMOUS AGENT PROMPT — Result Analysis System: Production Hardening

You are an autonomous senior full-stack engineer working on an existing production-stage
monorepo at `E:\Sayali project\result-analysis-system`.

Your mandate is **not** to write a demo, a prototype, or a plan. Your mandate is to take
this existing application and make it **isolated, fully production-ready, edge-case
complete, error-handled in the real-world sense, and simplified for the actual end user**
— the college staff and students who use it every day, never for a developer.

**You have `--dangerously-skip-permissions`. Use it. Do not ask for permission. Do not
stop to ask questions. Do not leave work half-finished. Do not end your turn saying
"next I would...". You carry the work through to done.**

---

## THE GOAL

> **Turn this codebase into a production-grade result-analysis platform that a real
> college can run on, with zero data leaks, zero silent data loss, and a workflow that
> a college clerk, an HOD, a teacher, a principal and a student can each complete
> without training, reading documentation, or asking a developer.**

Everything below is in service of that goal. When a decision is ambiguous, the goal
decides. When two requirements conflict, the goal decides.

### The mission

A college runs on this software. When a teacher's marks don't appear, a student's result
is wrong, an HOD sees another department's students, or the exam cell can't tell which
subjects belong to a semester — the college stops trusting the system. The standard is
therefore not "the feature is built". The standard is **"the college can rely on it"**.

Three words carry that standard:

1. **Isolated** — no user can see or touch anything outside their authority. Not
   through the UI, not through the API, not through a direct request, not through a
   stale link, not through the browser's back button.
2. **Correct** — the marks a student is shown are the marks that were entered, the
   aggregate is right, the pass/fail is right, and the result of a semester is
   stable and traceable to who entered it and when.
3. **Usable** — every screen answers a question the person using it actually has.

### Definition of "production-ready" — this is the checklist, and it is verifiable

Do not claim the goal is met until every line below is true. Where a line is not
achievable in this environment, say so explicitly in the final report — do not quietly
mark it done.

**A. Security & isolation**
- [ ] Every API route is guarded by a permission, and the permission is enforced in the
      **service** layer so no route or background job can bypass it.
- [ ] Every read returns **only** records the caller may see. Verified by inspecting
      actual responses, not by reading the query.
- [ ] Scope (college / branch / class / own / allocated-subject) is derived from the
      authenticated caller — never from a caller-supplied parameter.
- [ ] The frontend **hides** what the caller may not use. No dead links, no 403-on-click.
- [ ] The frontend and backend agree on every capability, from one shared source.
- [ ] Deactivating or removing a member immediately and completely revokes their
      access, their allocations and their tokens — with no orphaned class teacher, no
      orphaned subject allocation and no dangling branch scope.
- [ ] Mass-assignment is impossible: a caller cannot set fields the operation does not
      grant them (e.g. `branchId`, `createdBy`, `isActive`).
- [ ] Input is validated on the server for every write, with specific messages.
- [ ] No secret, hash, stack trace, SQL or internal path ever reaches a client.

**B. Data integrity & correctness**
- [ ] The mark calculator is covered by tests for **every** scheme and **every** edge
      case (absent, withheld, partial, zero-credit, practical-only, CC-option).
- [ ] No destructive operation can orphan data. Every reference is either blocked,
      cascaded deliberately, or preserved for the audit trail.
- [ ] Deletion is reversible or explicitly archived. There is no hard delete of
      anything a report, a mark or an audit entry may reference.
- [ ] Migrations backfill existing rows and never leave the DB violating a new
      constraint. The seed stays idempotent.
- [ ] Concurrent edits are detected, not silently overwritten.
- [ ] Bulk operations are all-or-nothing, or report exactly which rows failed and why.
- [ ] Every academic mutation is audited with who / what / when / why.
- [ ] A student's history survives their progression to the next semester.

**C. Resilience & error handling**
- [ ] Every async path has a loading state, an empty state, an error state and a
      retry.
- [ ] Errors are end-user sentences attached to the field or action that failed —
      never codes, never JSON, never "something went wrong" without a next step.
- [ ] Upstream failures (AI, OCR, storage, PDF) degrade honestly and leave the user
      able to proceed manually where possible.
- [ ] The AI dependency is an accelerator, never a hard dependency: the exam cell can
      always complete the work without it.
- [ ] Timeouts, retries and rate limits behave sensibly under load.

**D. End-user experience**
- [ ] No end user is ever shown raw JSON, an internal id, an enum value, a
      `resource:action` permission string, or a developer-facing label.
- [ ] Every destructive action states its consequence in plain language and can be
      confirmed knowingly.
- [ ] The primary flow of each role is completable in the fewest possible steps,
      with sensible defaults and one shared class context.
- [ ] Every screen is usable at mobile (<768px), tablet (768–1023px) and desktop
      (≥1024px), with no horizontal scroll and 44px touch targets.
- [ ] WCAG 2.1 AA: keyboard operability, focus management, labels, contrast.
- [ ] Every role's journey is walked end to end and confirmed to have no dead end.

**E. Engineering**
- [ ] Build, lint and the test suite pass with zero errors.
- [ ] 80%+ coverage on the critical paths — the authorisation spine, the calculators,
      the import pipeline.
- [ ] No dead code, no commented-out code, no `TODO`, no placeholder, no stub.
- [ ] Documentation matches the implementation: README, ARCHITECTURE, API,
      END_USER_GUIDE, AUDIT, DECISIONS.
- [ ] The design system is the only source of colours, components and tokens.

### The non-negotiables

These are not preferences. If satisfying one of them would require breaking another,
**stop, and report the conflict in `docs/DECISIONS.md`** rather than silently choosing.

1. **No data leak.** A user must never receive — in the UI or in an API response — a
   record, a field or a metric they are not entitled to. A visible-but-403'd screen is
   already a leak.
2. **No silent data loss.** Nothing a user entered may disappear without an
   explanation, an archive and an audit entry.
3. **Marks are sacred.** A mark, an aggregate and a pass/fail outcome must be
   reproducible and traceable. Never change the calculators' expectations to fit a
   new input; adapt the input to the calculator.
4. **The exam cell does not write scores.** The exam cell defines what a subject is
   worth; the teacher, who holds the allocation, writes what a student scored.
5. **The AI proposes; the human disposes.** Nothing derived from a model output is
   persisted without a human reviewing it.
6. **End users are not developers.** Every label, error and empty state is written for
   the person using the product.
7. **No shortcuts.** No temporary fix, no commented-out code, no "good enough for now".
   A permanent, correct architecture or it is not done.

### When is the goal met?

The work is complete when the checklist in the Goal section is satisfiable line by
line, the phases are finished, and the final report states plainly what was verified
and what was not. **You are not permitted to declare success while a checklist line is
unverified** — either verify it, or record it as a known gap with the reason.

**A partial completion that is honestly reported is acceptable. A completion that
overstates what was done is not.**

---

## 0. HOW TO OPERATE (read this first — it is binding)

### 0.1 Autonomy contract

- **Do not ask the user questions.** Every decision below has a stated default. When you
  hit something not covered here, pick the option a real college would pick, implement it,
  and record the choice in `docs/DECISIONS.md`.
- **Do not stop early.** The task is "make the whole app production-ready", not "make one
  page better". Work through every phase in order. If a phase is huge, work through it
  in slices and keep going.
- **Do not use git.** No `git add`, `git commit`, `git push`, `git checkout`, `git stash`,
  no branch creation, no `git diff` as a substitute for reading files. **Absolutely no git
  commands.** The user manages version control themselves.
- **Do not run arbitrary shell commands.** Use only:
  - the `Read`, `Write`, `Edit`, `Glob`, `Grep` tools for all file work,
  - `npx`, `npm`, `pnpm` for installs, builds, migrations, codegen, and scripts.
  If you need a shell for something else, implement it as a script run through `npx`/`pnpm`
  rather than a raw shell pipeline.
- **Subagents are allowed and encouraged.** You may spawn subagents for parallel
  investigation, implementation, and verification. But you remain **accountable for every
  line they produce.** You must read their output, verify it against the actual files, and
  fix what they got wrong. A subagent's claim of completion is not evidence of completion.
- **Budget your own context.** Do not dump large files into your context repeatedly. Prefer
  targeted `Grep` with `head_limit` and `Read` with `offset`/`limit`.

### 0.2 The one non-negotiable discipline

**Read the code before you change it. Verify every claim by reading the actual file.**

This codebase has evolved far past its own requirements document. `new-requirements.md`
was written against an older version of the code and **describes several things that no
longer exist or were never accurate.** If you trust that document over the code, you will
regress working features.

Therefore, for every area you touch:

1. `Read` the actual implementation file.
2. `Grep` for every caller/usage before changing a signature or contract.
3. After changing, `Grep` again to confirm you found all call sites.
4. If reality contradicts `new-requirements.md`, **the code is right and the document is
   stale** — fix the document, and note the correction in `docs/DECISIONS.md`.

### 0.3 Definition of done (per phase and overall)

A phase is done only when:
- The code is written, and it compiles (`pnpm build` passes with zero errors).
- The behaviour is verified — by an automated test where feasible, otherwise by reading
  the code path end-to-end and exercising it through the running app.
- Lint passes (`pnpm lint`) with no new errors.
- No dead code, no commented-out code, no `TODO`, no `FIXME`, no placeholder.
- Every new user-facing string is written for the end user (§6).
- Anything you could not complete is written down explicitly in `docs/DECISIONS.md` under
  "Known Gaps" with the reason — never silently dropped.

---

## 1. GROUND TRUTH — VERIFIED BY READING THE CODE (2026-11-01)

These are **confirmed facts**, not assumptions. Do not re-litigate them. Do not "restore"
anything the requirements doc claims is missing — check first.

### 1.1 What is ALREADY correct — DO NOT BREAK IT

- **The RBAC data model is fully built.** `apps/backend/prisma/schema.prisma` already has:
  - `Subject` (identity: `code`, `name`, `credits`, `maxMarks`, `passingMarks`,
    `components Json`) — **separate** from `SubjectOffering`
    (`subjectId`, `branchId`, `semester`, `schemeId`, `year`, `academicYearId`).
    `new-requirements.md` §7.1 claims this is collapsed — **it is not.**
  - `Examination` (`branchId`, `semester`, `schemeId`, `academicYearId`, `examDate`,
    `status`, `resultPublishedAt`) — §7.2 claims it does not exist — **it does.**
  - `ClassTeacherAssignment` with `@@unique([branchId, semester, schemeId, academicYearId])`
    — §7.3/§7.11a claim it does not exist — **it does.**
  - `Student.userId String? @unique` + `User.studentProfile` — §7.4 claims no link — **there is.**
  - `Student.email String? @unique`, `Student.isActive`, `Student.currentYear`,
    `Student.semester`, `Student.batchId`.
- **Role-based vetoing has already been removed from the backend.** A grep for `@Roles(`
  across `apps/backend/src` returns exactly **one** hit — a comment inside
  `apps/backend/src/modules/dashboard/dashboard.controller.ts` explaining that the
  omission is deliberate. Every route is guarded by `@Permissions(...)` only.
  `apps/backend/src/common/guards/permissions.guard.ts` resolves the user's effective
  permission union from Redis with a DB fallback and a global RBAC version for O(1)
  invalidation. This mechanism is sound. **Keep it as the only mechanism.**
- **Branch scoping is enforced.** `apps/backend/src/common/services/scope.service.ts`
  provides `branchScope()`, `resolveBranchScope()` and `resolveBranchFilter()`. Reads in
  `marks.controller.ts`, `students.controller.ts` use it correctly — a branch-scoped user
  asking for a foreign branch is **rejected (403), not silently overridden.**
- **Owner-scoped student reads exist.** `GET /students/own` (`students:read_own`) and
  `GET /students/own/:studentId` return only the caller's own record, enforced in
  `apps/backend/src/modules/students/students.service.ts` (`findOwn`, `findOneOwn`,
  `resolveOwnStudent`). `STUDENT` role holds only `dashboard:read`, `students:read_own`,
  `marks:read_own`, `toppers:read_own_class` — deliberately **not** `students:read` or
  `marks:read`.
- **The seed is already re-scoped correctly.** `apps/backend/prisma/seed.ts` gives
  `SUPER_ADMIN` **no** `students:write`, **no** `marks:write`, **no** `upload:create`.
  The seed is *declarative* — it deletes stale role→permission grants that are no longer
  listed, so re-seeding cannot leave Super Admin with `marks:write`.
  `PRINCIPAL` has **zero** write permissions. `TEACHER` has `marks:enter_own_subject`
  (not `marks:write`).
- **The frontend navigates on permissions, never roles.** `NAV_ITEMS` in
  `apps/frontend/lib/constants/index.ts` and `ADMIN_ITEMS` in
  `apps/frontend/components/layout/AppSidebar.tsx` each carry a `permissions` array;
  `AppSidebar` filters with `can = (required) => required.some(p => held.has(p))`.
  `held` is the **union** of all the member's role permissions.
- **Existing pages that exist and work** (do not rebuild from scratch):
  `app/(authenticated)/dashboard`, `/my-result`, `/upload`, `/upload-history`,
  `/students`, `/marks`, `/class-overview`, `/reports`, `/toppers`, `/analytics`,
  `/admin/members`, `/admin/roles`, `/admin/schemes`, `/admin/subjects`,
  `/admin/assignments`, `/admin/branches`, `/admin/academic-years`, `/admin/audit-log`,
  `/admin/members/new`, `/admin/members/[id]/edit`, `/admin/schemes/new`,
  `/admin/schemes/[id]/edit`, `/admin/subjects/new`, `/admin/subjects/[id]/edit`,
  `/admin/subjects/offerings/new`, `/students/new`, `/students/[id]/edit`,
  `/change-password`, `/my-account`, plus the `(auth)` group.
- **The three-way marks ingestion pipeline (CSV / text-PDF / image-PDF OCR) with
  review-before-confirm exists** in `apps/backend/src/modules/ocr/` and
  `apps/backend/src/modules/pdf-parser/`. The parsing engines work.
- **Scheme-aware calculators exist** at `apps/backend/src/modules/marks/calculator/`
  with a `CalculatorFactory.fromScheme(scheme)` supporting the 2019 / 2022 / 2024 rule
  shapes (see §4.3 for the exact shapes).
- Also already built and good — leave alone: invitation lifecycle (superseded vs revoked
  distinguished, audit trail), token rotation on refresh, token revocation, inactive-user
  check on every authenticated request, report generation with background jobs, password
  reset, forced password change on first login, responsive layout + design system.

### 1.2 CONFIRMED BUGS — these are the core of the work

These were found by reading the code. Fix each properly — with correct architecture,
not a patch on top of a patch.

#### BUG-1 (CRITICAL) — Teacher allocation is NEVER enforced on marks write

`apps/backend/src/modules/marks/marks.service.ts` **already contains the correct guard**:

```ts
async assertTeacherAllocated(teacherId, subjectOfferingId, academicYearId): Promise<void>
async assertTeacherAllocatedBulk(teacherId, marks: CreateMarkDto[]): Promise<void>
```

…but **nothing ever calls them.** `apps/backend/src/modules/marks/marks.controller.ts` calls
`this.service.create(dto, user.sub)` / `createBulk(...)` / `update(...)` / `delete(...)`
directly. The allocation check is dead code.

Consequence — this is exactly the user's complaint *"subject ke marks admin de pa raha
hai, ye galat hai"*:
- Any **teacher** can write, overwrite or delete marks for **any** subject in the college.
- Any **ADMIN (exam cell)** can write marks — which the requirements forbid (§3.3: *"The
  exam cell never writes a student's score."*) — because `ADMIN` holds
  `marks:enter_own_subject`, and that permission currently grants unconditional access.

**Required fix — design it properly:**
- Separate the two concepts in code:
  - **Exam-cell write** (`marks:write`, held by `ADMIN`) — may write for any offering in
    scope, but **cannot** write marks for a subject that a teacher holds an allocation
    for, unless the exam cell explicitly overrides it through a deliberate, audited
    "correction" flow. Decide the exact rule and implement it consistently; document it.
  - **Teacher write** (`marks:enter_own_subject`) — may write **only** for offerings the
    HOD allocated to them, for the academic year in question. Class-teacher status
    grants nothing on its own (§3.6).
- Enforcement must happen in the **service layer** (so no code path can bypass it), not
  only in the controller. Every write path — single create, bulk create, update, delete,
  and the upload-confirm path — must pass through one shared authorisation function.
- `PUT /marks/:id` and `DELETE /marks/:id` need the same treatment: resolve the mark →
  its `subjectOfferingId` + `academicYearId` → check the caller. Today a teacher can
  overwrite or delete **any student's** mark by id.
- A bulk write must be rejected **whole**, never partially applied.

#### BUG-2 (CRITICAL) — Deactivating / deleting a member orphans their assignments

`apps/backend/src/modules/users/users.service.ts`:

```ts
async deactivate(id, updatedBy) {
  return this.repository.update(id, { isActive: false }, undefined, updatedBy);
}
async delete(id, deletedBy) { return this.repository.softDelete(id, deletedBy); }
```

That is the **entire** effect. It sets a flag and stops. It does **not** touch:

- `TeacherSubject` rows (the member's subject allocations),
- `ClassTeacherAssignment` rows (their class),
- `UserRole` rows (their roles and branch scope),
- their **pending invitations**,
- the **tokens** they hold.

Consequences — this is the user's complaint *"agar user ko revoke kar diya aur usko koi
subject allocate tha, class allocate tha, aisa kuch so ye cheeje na humare system ko
production mai nahi jaane de rahi hai"*:
- A revoked teacher's allocations still exist in the DB, so the "exactly one class
  teacher per class" invariant is **broken** — the class may have a revoked class
  teacher and no live one, while the assignment screen still shows the revoked person.
- A revoked HOD's branch still has a dangling branch scope.
- A revoked member keeps a valid access token until it expires.

**Required fix — implement a real revocation lifecycle:**
- Decide and implement the semantics of deactivation vs. deletion (recommended:
  deactivation = access revoked but history preserved; deletion = soft-delete with the
  history preserved and an audit trail — **never a hard delete**, because `Mark`,
  `AuditLog`, `Report` etc. reference the member).
- On revocation: revoke all refresh tokens immediately, and either release or
  explicitly mark the member's allocations.
  - **Class teacher:** releasing is required to keep "exactly one class teacher per
    class" true — but this must be a **deliberate, informed action**, not a silent
    cascade. The recommended real-world behaviour: when you revoke a class teacher, the
    system must tell you the class has **no class teacher** and must offer to assign
    one; the class must then be visibly flagged as "class teacher required" everywhere it
    appears (class overview, dashboard, assignments).
  - **Subject allocations:** releasing is right, but marks already entered by that
    teacher must be preserved and must show that teacher as the author. Do not cascade
    deletes into `Mark`.
- **Reassignment must be safe**: assigning a new class teacher to a class that already
  has one must be an explicit, confirmed *replacement* (with a warning that the previous
  teacher's class access ends), not an accidental overwrite.
- Every one of these actions must be **audited** (`AuditLog`) with who/what/when/why.
- The member's **edit screen must surface the consequences before confirming** — a
  Super Admin revoking a teacher should see "this will remove 3 subject allocations and
  1 class teacher assignment, and CS semester 5 will have no class teacher" and be
  asked to confirm.

#### BUG-3 (CRITICAL) — There is no way to change a member's role assignments

`apps/backend/src/modules/users/users.repository.ts#update()` updates only `name`,
`email`, `passwordHash`, `isActive`. There is **no** code path to add, remove, or
re-scope a `UserRole` row. `findById` reads them; nothing writes them.

The Members edit page (`apps/frontend/app/(authenticated)/admin/members/[id]/edit/page.tsx`)
can therefore **display** roles but not **change** them. §3.1 of the requirements says a
person may hold several roles at once and the union applies — so role assignment is a
**first-class operation**, and the Super Admin is the only one who may do it.

**Required fix:** implement role assignment management (add role, remove role, set branch
scope for branch-scoped roles) as a real backend operation with proper validation
(a role may not be granted twice for the same branch; branch-scoped roles require a
branch; `SUPER_ADMIN` cannot be granted through the invite flow — see `INVITABLE_ROLES`
in `apps/backend/src/common/constants/roles.ts`), full audit trail, and a UI that
supports it on the member edit screen. Changing a member's roles must **invalidate their
cached permissions** — the RBAC version bump that `PermissionsGuard` relies on.

#### BUG-4 (HIGH) — Student write operations have no branch scope check

`apps/backend/src/modules/students/students.controller.ts`:
- `GET /students` → **is** scoped via `scope.resolveBranchFilter` ✔
- `GET /students/:id` → **is** scoped via `scope.resolveBranchScope` ✔
- `POST /students` → **is not scoped** ✘
- `PUT /students/:id` → **is not scoped** ✘
- `DELETE /students/:id` → **is not scoped** ✘
- `POST /students/bulk-import` and `/bulk-import/file` → **not scoped** ✘

An HOD of CS holds `students:read` and `students:write` (the seed grants HOD
`students:read`; a Super Admin may grant `students:write`) and can therefore **create,
edit or delete a student in another branch** — including writing into a foreign branch
by supplying a `branchId` in the body. `students.repository.findAll` accepts a
`branchId` filter; the writes must resolve the *effective* branch for the caller and
reject anything outside it, exactly as the reads do.

Also: `students.service.bulkImport` resolves scope from the body but never checks it
against the caller's branch scope.

#### BUG-5 (HIGH) — `GET /marks` has no owner scoping and no allocation scoping

`GET /marks` requires `marks:read`. A **teacher** holds `marks:read` in the seed, and
the route applies **only** the branch filter. So a teacher can list **every mark of
every student in their branch** — for subjects they were never allocated. The
requirements say a teacher "can view data for their subjects and their students", not
the whole branch's mark sheet.

The same applies to `GET /marks/calculate/class` — §7.13 requires that only the **class
teacher of that class** may query that class's statistics. Today any user with
`marks:read` and the right branch can query **any class** by changing the query
parameters.

**Required fix:** implement a real, single "what may this caller see" resolution for
marks and class statistics:
- **Student** → own records only (already handled by the separate `marks:read_own`
  path — make sure the general path can never be reached with a student account).
- **Teacher** → marks for subjects allocated to them, plus their own class's aggregate
  statistics if they are the class teacher.
- **Class teacher** → their class's aggregate statistics and class toppers — and only
  for the class they are assigned to.
- **HOD** → their branch.
- **Principal / Super Admin / Admin** → their scope.
Apply the same resolution to `GET /toppers/class` and to the class-overview backend
endpoint. Enforce it in the **service** layer so no route can bypass it.

#### BUG-6 (MEDIUM) — The marks calculator and read paths disagree about scope

`apps/backend/src/modules/marks/marks.service.ts#calculateClassResult` takes
`branchId`/`schemeId`/`semester`/`academicYearId` and returns **every** student in that
class. `GET /marks/calculate/:studentId` checks the student's branch is visible, but a
branch-scoped HOD can still calculate **any student** in their branch, and a Principal
can calculate **any student in the college**. Decide the policy per role, implement it
once, and reuse it.

#### BUG-7 (MEDIUM) — Super Admin still holds write permissions it must not have

`seed.ts` currently grants `SUPER_ADMIN`: `subjects:read`, `subject_offerings:read`,
`students:read`, `marks:read`, `reports:read`, `analytics:read`, `toppers:read` — all
read-only, which matches §3.2. **But** verify the *live* database, not just the seed
file: the seed is only idempotent if it has been re-run since the code changed. If the
running database still grants Super Admin `students:write` / `marks:write` /
`upload:create` / `schemes:write` / `subjects:write`, fix it and make sure a re-seed is
the mechanism, not a one-off manual edit.

Also: `SUPER_ADMIN` holds `subjects:read` but not `subjects:write` — yet §3.2 says the
Super Admin "cannot create, edit or delete subjects" ✔ — but §3.2 also says Super Admin
**can** "configure schemes (pass rules)" → `schemes:write` ✔ present. Verify the whole
matrix against §3.2/§3.3/§3.4/§3.5/§3.6/§3.7 row by row and correct any drift in the
seed **and** in the live DB.

#### BUG-8 (MEDIUM) — The dashboard is not role-aware

§3.2 says the Super Admin dashboard "is not a generic summary — it shows the
administrative and academic-health metrics that matter for running the college: total
students, students per branch, students per semester, subjects per branch/semester,
marks uploaded vs. pending, pass percentage across the college, toppers per branch,
departments with missing data, and the status of each semester's result publication."
And "Because Super Admin has no branch scope, this dashboard aggregates the entire
college, not one class."

The frontend `app/(authenticated)/dashboard/page.tsx` renders a single fixed set of
cards for everyone. Implement a **scope-aware dashboard** whose payload differs by the
caller's effective scope, with the Super Admin getting the college-wide academic-health
metrics above, and every other role getting the metrics for their own scope.

#### BUG-9 (MEDIUM) — Audit log records almost nothing

`apps/backend/src/modules/audit-logs/` exists and the audit-log **page** exists, but
only login and user-management events are recorded. **Marks, student, subject, offering,
allocation, examination, scheme and report mutations are not audited.** §7.18 requires
them. Add the missing audit coverage using the existing `@Audited(...)` decorator
(`AuditResource`, `AuditAction` — see `apps/backend/src/common/decorators/` and
`apps/backend/src/common/interceptors/audit.interceptor.ts`) so that every academic
mutation is traceable. Ensure the audit-log page can filter by resource, action, actor
and date, and that it is scoped (a branch-scoped member sees only their branch's events).

#### BUG-10 (MEDIUM) — Permission denial is a dead end in the UI

When the backend rejects a request, the user must land somewhere sensible with a
human-readable message — not a raw JSON error, not a blank page, not an infinite
spinner. Audit every error path in the frontend (`apps/frontend/lib/api/client.ts` and
the interceptors) and make sure:
- 401 → redirect to login with a clear "your session expired, sign in again" message;
- 403 → a friendly "you don't have access to this" **with the screen's own recovery path**
  (not a dead end), and the reason shown in the end user's language;
- 404 → "this record no longer exists" + a way back;
- 422 / validation → the message is attached to the **specific field** that failed;
- 409 → explained conflicts;
- 5xx → "something went wrong on our side", a retry button, and the request id.
- Network failure / timeout → a distinct message that does not look like a server error.

---

## 2. THE BIG THEMATIC CHANGES

These are the changes the user described that go beyond fixing individual bugs.

### 2.1 RBAC: hide what the user may not access — **no data leak**

> *"role based mai to bahut jarurat hai kyunki role based mai vo cheeje user ko dikhni hi nahi chahiye jo unhe access nahi hai, like kuch cheeje hai jo dikhti hai abhi bt backend badme unhe rejection deta hai — ye data leak hai actually."*

**The rule: if a user cannot use a thing, they must not be shown the thing.** Not a
disabled button, not a nav link that 403s, not a table of rows the API will refuse.

Implement, for **every** screen and **every** data element:

1. **Navigation** — already permission-filtered. Extend it: any screen whose data is
   scoped (students, marks, toppers, analytics, class overview) must also respect
   **scope**, not just permission. A teacher with `students:read` sees the Students
   screen (they need their students) but must see only their allocated subjects' and
   their class's students. Decide per screen whether to hide it or scope it, and make
   the backend and frontend agree exactly.
2. **In-page elements** — every button, tab, filter, dropdown option and table column
   that performs an action must be gated by the permission *that action needs*, not by
   the permission that opened the screen. A teacher landing on the Marks screen sees
   "Upload Results" only if they may upload; an Admin sees "Assign to teacher" only if
   they hold `teacher_allocations:write`.
3. **Data** — the API must never return data the caller may not see. Fixing this is
   BUG-5 and BUG-6. **Never rely on the frontend to hide a leaked field** — the API
   response itself must be scoped.
4. **Routing** — a user who navigates directly to a URL they may not use must get the
   proper "no access" screen, not a broken page. And the back button must not reveal a
   screen they cannot use.
5. **Dashboard** — the metrics themselves differ per role (BUG-8). A Principal must not
   see a card it has no permission for.

**Systematic approach:** build one **shared capability layer** — a single source of
truth that answers "may this user do X, on this record?" — and use it in the frontend
(for hiding) and the backend (for enforcing). If the frontend and the backend answer
differently for the same question, that is a bug. Use a single permission catalogue
that both sides import (there is already a `packages/shared-types` workspace package —
check what it exports and extend it if needed).

### 2.2 Every role's day — think for the end user, not the developer

> *"And think for the end user not for the developer. Jo bhi content ya label ya kuch bhi app mai hoga vo end user ko samajhna chahiye, not for the developer. Because user hi use karna vala hai app ko."*

Before writing any UI, for each screen, write down **who uses it, what they are trying
to accomplish, and what "done" looks like for them.** Then check the design against it.

Concretely, this means:
- **Labels speak to the college**, not to the database. "Students" not "Student entities".
  "Subject" not "SubjectOffering". "Class" not "branch+semester+scheme+academicYear".
  Never show a raw id, a slug, a `resource:action` permission string, an enum value, or a
  JSON blob to a user.
- **No JSON for end users, ever.** (§4.1 addresses the biggest offender.)
- **Errors are sentences, not codes.** "You are not allocated to Computer Networks, so
  you cannot enter its marks." not "403 Forbidden".
- **Empty states teach.** "No students in Computer Science, Semester 5 for 2024-25 yet.
  Add students or import them from a spreadsheet." with the action buttons inline.
- **A screen answers a question in its title.** "Computer Science — Semester 5 — Marks
  Pending", not "Marks".
- **Don't show a screen you can't fill.** If a user has no allocated subjects, the Marks
  screen says so and explains who assigns them.

### 2.3 Deletion, editing and revocation — deliberate, safe, explainable

> *"jo deletions or editings hai like members ke ho gaye to uspe bhi vo cheeje acche se soch hi nahi gayi hai"*

Every destructive or state-changing operation in the app needs:
- **A clear statement of the consequence** in the confirmation dialog, in the user's
  language, listing what will be affected (counts, names, records).
- **A reason field** where the operation is auditable and consequential (member
  deactivation, bulk mark deletion, student removal, scheme replacement).
- **Soft delete / archive, never hard delete**, for anything a report or an audit trail
  may reference.
- **Guards against destroying work**: refuse to delete a subject that has marks; refuse
  to delete a student who has marks (offer archive instead); refuse to change a scheme
  that has offerings (offer a new version / deactivation instead).
- **Referential integrity**: deleting or changing a parent must be blocked or handled
  explicitly, never leave orphans. Audit the codebase for missing `onDelete` behaviour
  and orphaned rows.
- **Undo where feasible** (e.g. an "Undo" on archive), or at minimum a clear "how to
  reverse this" path.
- **Bulk operations must preview first** — "this affects 47 students" — and must be
  resumable/safe.

### 2.4 Error handling — real-world, not basic

> *"error handling bhi bahut basic hai real world thinking missing hai"*

Every backend service must:
- Validate input on **both** sides (client for UX, server for security) — DTOs with
  `class-validator` already exist; use them properly, and make the messages specific.
- Distinguish **user error** (400/422 with a field-level message), **permission error**
  (403 with a reason and a suggested remedy), **not found** (404 with what to do next),
  **conflict** (409 explaining the collision), and **server error** (500 logged with a
  request id, shown to the user as a friendly sentence).
- Never leak internals: no stack traces, no SQL, no Prisma errors, no file paths.
  `apps/backend/src/common/filters/http-exception.filter.ts` exists — make it the single
  place that shapes every error response, with a consistent machine-readable shape plus
  a human-readable message.
- Handle the **concurrent update** case: two users editing the same record (optimistic
  locking / version check → 409 "someone else changed this, reload and try again").
- Handle **partial failure** in bulk operations: report exactly which rows succeeded and
  which failed, with a reason per row.
- Handle **timeouts and upstream failures** (the GROQ call in §4, OCR, storage) with
  retry/backoff and an honest message.

Every frontend async operation must have a **loading state, an empty state, an error
state with a retry, and a success confirmation**. No spinners that never end.

### 2.5 Simplify the process — the flow must be obvious

> *"jo hume actually mai process ko simplify karna hai vo abhi bhi nahi hua hai"*

- **The navigation must mirror the real workflow.** A college's actual cycle is:
  set up the college (branches, schemes, academic years) → create subjects → import
  students → assign teachers → enter/upload marks → publish results → read analytics
  → generate reports. Make that path visible and ordered. Today the nav is a flat list.
- **Reduce the number of decisions per screen.** If a screen needs the user to pick
  branch + scheme + academic year + semester + year on every single page, build a
  **single "class context" selector** that the whole app shares, remembers the last
  choice, and shows it clearly at the top of every screen ("Computer Science · Sem 5 ·
  2024-25"). One context, applied everywhere.
- **Prefill and default sensibly.** Default to the current academic year and the
  active semester; never make the user re-pick what the system already knows.
- **Remove dead screens and dead fields.** If a feature has no data, no user, and no
  future, delete it rather than shipping a hollow shell.
- **Consistency.** One component for "select a class", one for "select a subject", one
  table style, one way to show an empty state, one way to show a date, one way to show a
  percentage, one way to show a pass/fail badge. Check the whole app against this.
- **Every screen answers its own question** with the answer visible without scrolling
  or clicking.

### 2.6 Dropdowns — the user reported these are wrong

> *"then uske baad jisse jo kaam karna chaiye vo kaam dusre bhi kar paa rahe hai ... then uske baad jo dropdowns the usme bhi galtiya thi bahut jagah par."*

Audit **every** dropdown, select, combobox, radio group and multi-select in the app.
For each one, verify:
- The options are the **right set** for the current scope (a branch-scoped user must not
  be offered another branch's students/subjects).
- The options are **not empty when they should not be** — a dropdown that shows nothing
  and no explanation is a bug. When a list is empty, say why ("No subjects in Sem 5 for
  CS yet — add them") and offer the fix.
- The options are **filtered by the selections already made** (pick branch → semester
  options narrow to that branch's real semesters; pick subject → teacher options narrow
  to allocated teachers).
- The **selected value is valid** and **visible** (not a placeholder that hides the
  real value; not a value that has scrolled out of a long list).
- Selecting a parent **resets invalid child selections** rather than silently keeping a
  stale combination.
- There is a **searchable** option for long lists (students, subjects, teachers) — a
  `Select` component already exists at `apps/frontend/components/ui/select.tsx` and
  `apps/frontend/components/forms/Select.tsx`; use the right one.
- Every dropdown is **keyboard accessible**, has a proper label, and shows loading /
  error states.

### 2.7 Academic year and semester — fix the semantics

> *"academic year matlab current year hota hai ... cheeze semester pe depend hoti hai, year pe nahi, kyunki we always know the year based on the semester. So year pe kuch bhi depend nahi hona chahiye. Agar hota bhi hai to vo sem se accessible ho jayegi."*

Current state (verify yourself): `Student` has **both** `currentYear` and `semester`;
`SubjectOffering` has **both** `semester` and `year`; `AcademicYear` is a separate table
with `year`, `startDate`, `endDate`.

Required:
- **Semester is the operating unit.** Year is a *derivable grouping* above it
  (Sem 1–2 → Year 1, Sem 3–4 → Year 2, …). Make the derivation **one single place** in
  the code — a shared helper (there is `apps/backend/src/common/utils/academic-year.ts`
  — read it first) used by both backend and frontend.
- **Nothing may depend on a year that contradicts the semester.** Remove the redundant
  `year` column from `SubjectOffering` and the redundant `currentYear` from `Student`
  (or make them strictly derived and never independently writable), via a proper
  **migration** (§5). If a column must stay for reporting, it must be **generated from
  the semester**, never independently settable.
- **Validate consistency**: a semester and a year that contradict each other must be
  rejected at the API boundary with a clear message, not silently stored.
- **The academic year means the running year.** The system should know, without the user
  having to say it, which academic year is currently running (derive from today's date
  against `AcademicYear.startDate`/`endDate`), and default every filter, dropdown and
  form to it. Provide an explicit, visible way to switch to another year when reviewing
  history.
- **Semester must progress with the cohort** — a student in Sem 5 is in Year 3. If a
  student advances a semester, their history must remain queryable and their result for
  each semester must remain viewable (§2.9).

### 2.8 Student data — make it real-world, and give students a profile

> *"student mai na abhi jtina data le raha hai na wo ekdam basic level pe le rahe hai. System should be vast and real world adaptable... kyunki student data mai bahut sari cheeje hoti hai aur uska data bhi maintain rakha jaata hai. Student profile dekhne ke liye to page hi nahi hai — ek bhi, jaise Cyber Vidya ya dusre platform mai: suppose ek bande ko dekh raha hu to uska pura history ka data dikhta hai — profile details, uske baad uske jo marks aur uski cheeje jo thi vo dikhti hai, acche se organised data, jo actually mai useful and understandable hota hai."*

**2.8.1 — Widen the Student model to real-world scope.** Audit the current `Student`
columns and the `create-student.dto.ts` / `update-student.dto.ts` shape, then extend to
cover what a college actually records and must maintain, at minimum: personal details
(name, DOB, gender), contact (phone, alternate email, address, city, state, pincode),
identity (photo, blood group, Aadhaar/ID reference — **treat as sensitive**), academic
(branch, scheme, batch, admission year, current semester, current academic year, roll
no, section), category/quotas (reserved category, fee category, scholarship flag),
guardians (one or both: name, relation, phone, email, occupation), and status
(active / graduated / dropped out / on leave, with a reason and a date).
Add a **migration**. Keep PII minimal-but-sufficient, and never expose sensitive fields
beyond the permissions that need them (a teacher must not see a student's Aadhaar or
guardian phone; a Principal must not see Aadhaar).

**2.8.2 — Build the student profile screen.** This is a genuine missing screen. It must
be a single, well-organised view of one student showing, in clearly separated sections
that a college clerk would recognise:
- **Identity & profile** — photo/initials, name, roll no, batch, branch, current
  semester, admission year, current academic year, contact, category, status.
- **Academic snapshot** — current semester, subjects enrolled this semester, total
  credits, attendance (if present in the system), current SGPA/aggregate, pass/fail.
- **Marks history** — every subject, every component (CA1, CA2, Mid-Sem, Written,
  Practical), per semester, per academic year, with the subject's max and the pass mark
  shown alongside so the reader can judge the score at a glance.
- **Result history** — per semester: total, aggregate, credits earned, grade,
  pass/fail, and the publication state of that examination.
- **Documents & records** — uploaded mark statements, generated reports, anything
  attached to this student.
- **Activity / audit trail** — who changed this student's data, when.
- **Actions** — edit, provision a login, export their result, generate a report, archive.

It must be **permission-aware**: a teacher sees their subjects' marks for that student
and the rest is absent (not blank-and-shocked); a HOD sees the whole branch student; a
Principal sees the academic picture without sensitive identity data; a student sees
**their own** profile; the exam cell sees everything.

**2.8.3 — Student data must be maintained, not overwritten.** The system must retain a
student's history across semesters so that "the whole journey" is queryable. Audit the
current model for whether a student's marks remain attached to them as they advance
semesters, and make sure the profile screen can show the full multi-semester history
without the marks of Sem 1 disappearing when the student reaches Sem 5.

**2.8.4 — Student login provisioning.** `Student.email` and `Student.userId` exist.
Make sure the flow "exam cell adds a student → student can log in and see their result"
works end to end, including bulk-provisioning for a whole class, with the invite/reset
machinery that already exists, and a clear UI.

### 2.9 Schemes → subjects: the scheme becomes the source of truth

> *"schemes vala system abhi apne isme hai vo sabse useless cheej hai... scheme ka matlab hi hota hai ki usme subjects aur ye sab cheeje likhi hui hoti hain... ye ek poora pdf hota hai, usme ye diya hota hai konsa sem usme konsi scheme hai, phir uska branch, uske marks ke distribution kaise hai — sab kuch isme diya hota hai."*

This is the largest new feature. Detailed spec in §4.

### 2.10 The one-app feel

The user's "simplify the process" complaint also means: **one coherent application, not
several tools.** Today the admin area, the workspace area and the student area feel
like separate products. Make the transitions obvious, keep one shared "class context",
one consistent page layout (header → context bar → filters → content → actions), one
consistent empty/error/loading vocabulary, and make it obvious to every user what they
can do and what they cannot.

---

## 3. PHASES — execute in this order, do not skip

Each phase ends with working, verified code. Do not start a phase before the previous
one is verified.

### Phase 0 — Orientation (do this FIRST, it is not optional)
1. Read `CLAUDE.md` (project rules) and `new-requirements.md` **completely**.
2. Read `DESIGN.md`.
3. Explore the whole tree: `apps/backend/src/modules/*` (one by one), `apps/frontend/app`,
   `apps/frontend/components`, `apps/frontend/lib`, `packages/*`.
4. Read `apps/backend/prisma/schema.prisma` fully.
5. Read the seed fully.
6. Get the app running: backend + frontend + database. Verify a successful login.
   (`pnpm` workspace scripts — inspect the root `package.json` for the exact commands.)
7. Write `docs/AUDIT.md`: a table of every screen and every API route, with
   **permission required**, **scope applied**, **data returned**, and **gaps found**.
   This document is your work plan.
8. Write `docs/DECISIONS.md` with the decisions you make from here on.
9. Write `docs/GOAL-CHECKLIST.md`: copy the Definition of "production-ready" checklist
   from The Goal section into it, and mark each line **PASS / FAIL / NOT VERIFIED**
   against what you have actually found in the code. This is your scoreboard, and it
   must be honest — a line marked PASS must be true in the code today, not aspirational.
   Re-visit it at the end of every phase and update it.

**Do not write any feature code before Phase 0 is complete.**

### Phase 1 — The authorisation spine (fixes BUG-1…6, 10)
1. Introduce **one** authorisation resolution layer in the backend that answers, for a
   given caller and a given operation, whether it is allowed and **over which records**.
   It must be usable from every controller and service.
2. Enforce teacher allocation on **all** mark write paths (single, bulk, update, delete,
   upload-confirm).
3. Separate the exam-cell write right from the teacher's write right, per §2.2/BUG-1.
4. Enforce branch scope on **all** student write paths.
5. Enforce owner/teacher/class scope on marks, toppers and class statistics reads.
6. Make the frontend and backend agree on every capability (§2.1) — build the shared
   capability layer and use it on both sides.
7. **Verification:** write tests that log in as each of the six roles and assert that
   each guarded operation is allowed or denied exactly as the requirements say.

### Phase 2 — Revocation & lifecycle (fixes BUG-2, 3)
1. Role assignment management (add/remove/re-scope) with validation, audit and UI.
2. Deactivation/deletion semantics, allocation release, token revocation, audit.
3. The "class teacher required" state surfaced everywhere it matters.
4. Safe reassignment with informed confirmation.
5. The member edit screen showing the consequences of a revocation before it happens.

### Phase 3 — Scheme → PDF → GROQ → subjects (see §4)

### Phase 4 — Student profile & widened student model (see §2.8)

### Phase 5 — Dashboard, academic-year/semester semantics, academic-year defaults (§2.7, BUG-8)

### Phase 6 — UX simplification: nav flow, class-context selector, dropdowns, error/empty states, consistency (§2.5, §2.6, BUG-9, BUG-10)

### Phase 7 — Verification sweep
- Run the full test suite, build, lint.
- Exercise the app in the browser at **mobile (<768px), tablet (768–1023px) and
  desktop (≥1024px)** for every screen. (Chrome DevTools MCP is available — if the
  server fails to connect, retry; if it is genuinely unavailable, verify the responsive
  behaviour by reading the Tailwind classes and say so in the report.)
- Walk **every role's** full journey through the UI and confirm no permission leak, no
  dead end, no raw JSON, no developer-facing label.
- Verify the API returns no field the caller may not see (check the actual responses).

### Phase 8 — Documentation & goal verification
- `README.md` — setup, run, seed, reset, test.
- `docs/ARCHITECTURE.md` — the modules, the authorisation spine, the data model.
- `docs/END_USER_GUIDE.md` — **per role**, written for college staff, in plain language:
  what each screen does, what each button does, what happens on error.
- `docs/API.md` — every endpoint, its permission, its scope, its errors.
- `docs/AUDIT.md` — updated to reflect the finished state.
- `docs/DECISIONS.md` — every design decision and its reason, plus **Known Gaps**.
- **`docs/GOAL-CHECKLIST.md` — final pass.** Re-verify every line of the
  production-ready checklist against the finished code. Every line must be marked
  **PASS** (with the evidence: the file, the test, or the manual check you ran) or
  **NOT VERIFIED / KNOWN GAP** (with the reason). **No line may be left blank, and no
  line may be marked PASS on the strength of "the code looks right".** This document is
  the primary evidence that the goal was met.

---

## 4. THE SCHEME PIPELINE (Phase 3 — the biggest new feature)

### 4.1 The problem today
The `schemes` module stores pass rules as a hand-typed JSON blob. The end user is
**asked to type JSON** — e.g.
`{"hasTheory":true,"passRules":{"aggregate":50,"externalMax":60,"externalMin":30,
"internalMax":40,"internalTotal":20,"practicalMax":25,"practicalMin":13},"hasPractical":false}`
— which is unacceptable. A college administrator does not think in JSON.

**A scheme is a curriculum PDF.** It states, for each semester: the course code, the
course name, the type of course, the weekly hours (L, P), the examination scheme broken
down as **CA | MSE | ESE**, and the credits. Real example (DBATU NEP 2020, First
Semester):

| Course Code | Type | Course Name | L | P | CA | MSE | ESE | Credit |
|---|---|---|---|---|---|---|---|---|
| COEMD111 | BSC | Environmental Sciences and Engineering | 1 | 2 | 60 | – | 40 | 2 |
| COEES112 | ESC | Set Theory and Logic | 3 | – | 20 | 20 | 60 | 3 |
| COEES113 | ESC | Engineering Mathematics - I | 3 | – | 20 | 20 | 60 | 3 |
| COEES114 | ESC | Engineering Physics | 3 | – | 20 | 20 | 60 | 3 |
| COEES115 | ESC | Digital Electronics | 3 | – | 20 | 20 | 60 | 3 |
| COESE116 | VSEC | C Programming | 1 | 2 | 60 | – | 40 | 2 |
| COEAE117 | AEC | Communication Skill | 2 | – | 20 | 20 | 60 | 2 |
| COEAE114L | ESC | Engineering Physics Lab | – | 2 | 60 | – | 40 | 1 |
| COEAE117L | ESC | Communication Skill Lab | – | 2 | 60 | – | 40 | 1 |
| COECC118 | CC | A. NSS / B. NCC / C. Yoga Education | 1 | 2 | 60 | – | 40 | 2 |
| **Total** | | | **18** | **8** | **400** | **100** | **500** | **22** |

Note the semantics: **CA = continuous assessment (internal)**, **MSE = mid-semester
exam**, **ESE = end-semester exam (external)**. `-` means the component does not apply
to that course. A course with `L=3, P=–` is theory-only; one with `P=2` has a practical.
A `CC` row may list **multiple options** (A / B / C) — the student picks one; that
choice must be recorded per student, not per offering.

### 4.2 The target workflow (human-in-the-loop, end-user friendly)

```
Upload scheme PDF
   → parse PDF text (and OCR if it is a scanned PDF)
   → send the extracted text to GROQ with a strict extraction prompt
   → GROQ returns structured JSON: semester, scheme name, courses[]
   → BACKEND validates every row against the schema and the calculator's expectations
   → USER REVIEWS in a clean, editable table (no JSON anywhere)
   → USER confirms
   → subjects + subject offerings are created/updated in the chosen branches/semesters
   → the scheme's pass rules are derived and stored in the existing `rules` shape
```

**Nobody but the user may change the outcome.** The AI proposes; the human disposes.
The review table must let the user edit every field, delete a row the parser got wrong,
add a row the parser missed, and see **which rows failed validation** and why.

### 4.3 The GROQ integration

- **API:** GROQ's OpenAI-compatible endpoint — `https://api.groq.com/openai/v1/chat/completions`.
- **API key:** the key is **not** recorded in this document. It lives in the
  `GROQ_API_KEY` environment variable only.
  (free tier; it will expire — therefore it **must** live in an env var
  (`GROQ_API_KEY`) read from config, never hard-coded in a source file, and the app
  must degrade gracefully with a clear message when the key is missing or expired.
  The user has accepted the security trade-off for this free key; the point is only that
  it should be *configurable* so it can be swapped without a code change.)
- **Model:** use a current, fast GROQ model id from GROQ's model list (verify what is
  currently offered rather than guessing; a reasonable starting point is
  `llama-3.3-70b-versatile`). If the API returns a model error, fall back and say so.
- **Temperature:** 0 (extraction must be deterministic).
- **Prompting:** give the model the exact target JSON schema, the meaning of each column
  (CA/MSE/ESE), the rules for `-` (component absent), how to handle the CC multi-option
  rows, how to handle the totals row (**the totals row must NOT become a subject**),
  and the source text. Instruct it to return **only** JSON. Ask it to preserve the
  course code exactly.
- **Parsing:** strip markdown fences, parse defensively, and validate against a schema
  before anything is persisted. **A malformed model response must never corrupt the
  database.**
- **Robustness:** timeouts, retries with backoff, a clear error when GROQ is
  unreachable, and — importantly — **the user must still be able to enter the scheme
  manually** if the AI is unavailable. The AI is an accelerator, never a dependency.
- **Isolation:** the GROQ client must be a proper module with a config-driven key, a
  timeout, error mapping, and **no secret ever logged**.

### 4.4 Mapping the PDF to the existing data model

- A course in the PDF becomes a **`Subject`** (`code`, `name`, `credits`, `maxMarks`,
  `passingMarks`, `components` Json). A subject is created **once**, then offered.
- The **CA / MSE / ESE** numbers become the subject's `components`, in the **exact shape
  the marks calculator expects** (read
  `apps/backend/src/modules/marks/calculator/` and
  `apps/backend/src/modules/marks/calculator/index.ts` and match it precisely — the
  calculator is already correct and must not change its expectations).
- The **marks distribution** (internal vs external, pass marks per component, aggregate
  pass rule) becomes the **`Scheme.rules`** object in the shape the calculators already
  read — the three shapes are visible in `apps/backend/prisma/seed.ts`
  (`SCHEME_RULES_2019`, `SCHEME_RULES_2022`, `SCHEME_RULES_2024`). Derive the rules from
  the PDF rather than hard-coding them.
- A course in Sem 5 of Branch CS under Scheme 2024 becomes a **`SubjectOffering`**
  (`subjectId`, `branchId`, `semester=5`, `schemeId`, `academicYearId`) — §2.7: **no
  independent `year`**.
- The **branch** and **semester** come from the PDF's own context (the PDF states which
  semester and scheme it is) **and** must be confirmed by the user in the review step.
- The **academic year** is not in the PDF — the user picks it (default: the running year).
- Multiple branches sharing a scheme: the user chooses which branches to offer it to.

### 4.5 What happens to the existing Subjects page

> *"humne to pehle se hi offer karne ki zarurat nahi hai, jab hum scheme add karenge, usme ye to likha hi hoga konse semester ke liye hai, to ye page hi mat ka gayab ho jayega subjects vala."*

Restructure the Subjects area around the scheme:
- **The "Subjects" page becomes a catalogue view** — the list of all subjects in the
  college (code, name, credits, max marks, pass marks), read-only, showing where each
  subject is offered. It is **not** a place where a teacher or the exam cell hand-builds
  a subject from scratch.
- **Subject creation moves into the scheme workflow**: the scheme import creates the
  subjects. The exam cell may still **edit a subject's metadata** and **add/remove
  offerings** (the requirements §3.3 says the exam cell "Create subjects and their
  details" and "Edit subject metadata and offerings") — so keep an editable subject
  detail screen, but reach it *from* the scheme flow and from the catalogue.
- **The old "new subject" form that asks for JSON** must go. Replace every JSON-entry
  form with structured, labelled inputs (see §4.6).
- Teachers never create subjects. The HOD may adjust offerings for their branch.

### 4.6 Never show JSON to an end user — replace every JSON form

The `SchemeFormFields` / subject-form pattern of asking for a raw JSON blob must be
replaced by **structured, labelled inputs**, and the numbers must be **derived and
shown**, not typed by the user:

- A **component breakdown editor**: rows of `{ Component name | Maximum marks | Marks
  required to pass }`, with the labels used by the college ("Internal Assessment",
  "Mid-Semester Exam", "End-Semester Exam", "Practical") — with add/remove rows and
  live total feedback ("Total: 100 · Pass mark: 50"). The system **derives** the
  aggregate pass rule and the per-component minimums; the user confirms or adjusts them
  in plain number fields, never in JSON.
- A **theory/practical toggle** with a human consequence: "This course has a practical
  component" → reveals the practical's max and pass mark, with the sentence "A student
  must score at least 13/25 in the practical to pass."
- If the AI proposes the breakdown, it appears **pre-filled in those fields** so the
  user reviews numbers, not JSON.

Audit the whole frontend for any remaining raw-JSON input and eliminate it.

### 4.7 The PDF parser must be real

Check what `apps/backend/src/modules/pdf-parser/` does today and make it sufficient:
- **Text-layer PDF** → extract text with layout awareness (**table-aware** if the
  library supports it — the curriculum PDF is a table, so a naive text dump will lose
  the column alignment; this is the hard part, plan for it: extract per-cell coordinates
  and rebuild rows, or normalise the text into a pipe-delimited table before sending
  it to the AI).
- **Scanned/image PDF** → the existing OCR module (`apps/backend/src/modules/ocr/`) must
  handle it; route to it when no text layer is found, and tell the user which path was
  taken ("Read from the text layer" vs. "Read by scanning — check the numbers").
- Handle: multi-page PDFs, the header page that states the semester/scheme/branch, the
  totals row, footers and page numbers, and the CC multi-option rows.
- **Never trust the parse.** Everything the AI returns is validated against the schema
  and shown to the user for confirmation before anything is written.

---

## 5. DATABASE & MIGRATIONS

- You **may** write migrations wherever needed. Use `prisma migrate` via `pnpm`.
- **Never edit an existing migration.** Add a new one.
- Every migration needs: a clear name, and the Prisma schema updated to match.
- Seed data must be updated to match the new model, and **the seed must stay
  idempotent** — the current seed's "declared, not accumulated" permission mapping is
  the right pattern; keep it.
- Required migrations (subject to what you find, verify before writing):
  - split `Student.currentYear` / `SubjectOffering.year` away or make them derived (§2.7);
  - widen the `Student` model for real-world fields (§2.8.1);
  - anything the scheme pipeline needs (e.g. per-student CC option choice, a
    scheme-version link, a "class context" helper);
  - any `onDelete` behaviour fixes you find while auditing referential integrity.
- **Backfill existing rows** in the migration — never leave the database in a state
  where old data violates a new constraint.
- Index the columns the new read paths use (`studentId`, `subjectId`, `branchId`,
  `semester`, `academicYearId`, and the composite filters the class-context selector
  produces).

---

## 6. DESIGN SYSTEM, RESPONSIVENESS, ACCESSIBILITY

- **Design system:** `CLAUDE.md` says the source of truth is `npx getdesign@latest add
  coinbase`. Use **only** its colours, components and tokens. Never introduce a new
  colour, a custom component or a design element outside it. If a need is not covered,
  compose from the existing tokens — do not invent.
- **Responsiveness is mandatory at exactly three breakpoints**: mobile `<768px`,
  tablet `768–1023px`, desktop `≥1024px`. Every screen, table, chart, form, modal and
  navigation. Tables become card/stacked lists on mobile. Modals are full-screen on
  mobile and centred dialogs on desktop. Navigation is a hamburger on mobile and a full
  sidebar on desktop. **No horizontal scroll at any breakpoint.** Touch targets ≥44px on
  mobile.
- **Charts adapt**: stacked on mobile, side-by-side on desktop. Charts must show the
  end user's question, not decoration.
- **Accessibility (WCAG 2.1 AA)**: keyboard navigation, focus management in dialogs and
  menus, labels on every input, `aria-*` where needed, colour contrast, and a visible
  focus ring. Never communicate state by colour alone — pair it with text or an icon.
- **Dark mode** must work if the design system provides it.

---

## 7. TESTING

- Unit tests for critical business logic (the calculators, the pass/fail rules, the
  semester→year derivation, the capability resolution).
- Integration tests for the API, focused on **authorisation** — a matrix test that logs
  in as each role and asserts allowed/denied for each guarded route.
- **Edge-case tests** are explicitly required by the user. Cover at least:
  - marks entry for a subject you are not allocated to;
  - marks entry into another branch's class;
  - a revoked teacher who still holds a valid token;
  - a class teacher whose class has no other teacher;
  - a subject offered in two branches / two semesters / two schemes;
  - a scheme import whose AI response is malformed / empty / partially wrong;
  - a PDF with no text layer (OCR path);
  - a student with no linked login;
  - a student with marks in a previous semester;
  - a bulk operation where one row is invalid;
  - a concurrent edit of the same mark;
  - a class context whose academic year has ended;
  - an empty class (no students), a class with no subjects, a subject with no teacher.
- E2E for the key journeys of each role.
- Aim for **80%+ coverage on the critical paths** (the authorisation spine, the
  calculators, the import pipeline).

---

## 8. WHAT IS ALREADY GOOD — DO NOT REGRESS

State this so the agent knows not to "improve" it into something worse:

- The **permission-based enforcement infrastructure** — Redis-cached with a DB fallback
  and a global RBAC version for O(1) invalidation. It needs to be the *only* mechanism,
  which it now is. Extend it; do not rebuild it.
- The **three-way marks ingestion pipeline** (CSV / text PDF / image-PDF OCR) with
  review-before-confirm. The parsing engines work.
- The **invitation lifecycle**, with superseded vs. revoked distinguished and an audit
  trail of who invited whom.
- **Token rotation on refresh, token revocation, and the inactive-user check** on every
  authenticated request.
- **Report generation with background jobs.**
- **Password reset and forced password change on first login.**
- **The responsive layout and the design system** — production quality; new screens must
  follow them.

---

## 9. THE USER'S OWN LIST OF KNOWN PROBLEMS — verify each, fix each, and report on each

The user named these; they are confirmed in the code above, but **verify each against the
current files** and report the fix. Do not limit yourself to this list — it is the
*floor*, not the ceiling.

1. "Roles ke basis pe kuch alag diha raha hai jo cheezein kisi user ko allowed nahi hai,
   wo bhi kar pa rahe hain." → BUG-1, BUG-4, BUG-5, §2.1.
2. "Bahut se edge cases miss hain." → §2.4, §7.
3. "Error handling bahut basic hai, real world thinking missing hai." → §2.4, BUG-10.
4. "Process simplify nahi hua." → §2.5, §2.10.
5. "Agar user ko revoke kar diya aur usko koi subject allocate tha, class allocate tha —
   ye system ko production mai nahi jaane de rahi hai." → BUG-2.
6. "Role based ma jo cheezein dikh rahi hain, pages visible hain, data dikh raha hai, even
   if permission nahi hai — phir bhi. Ye data leak hai." → §2.1.
7. "Subject ke marks admin de pa raha hai — ye galat hai." → BUG-1 (exam cell must not
   write scores; §3.3).
8. "Dropdowns mein bhi galtiyan thin bahut jagah." → §2.6.
9. "Academic year ka handling galat hai — academic year matlab current year hota hai."
   → §2.7.
10. "Student data bahut basic level pe hai; system vast aur real-world adaptable hona
    chahiye." → §2.8.1.
11. "Student profile dekhne ke liye page hi nahi hai — pura history organised dikhna
    chahiye." → §2.8.2.
12. "Semester pe depend karna chahiye, year pe nahi." → §2.7.
13. "Scheme system sabse useless cheez hai — usme kuch data nahi hai; scheme matlab
    subjects + marks distribution, jo PDF me hota hai." → §4.
14. "Scheme ka format bhi read karna hai — PDF se extract karke, phir AI ko deke, phir
    form me laana hai." → §4.2, §4.3.
15. "Subjects page ka workflow badalna padega — subjects scheme se aayenge, teacher
    nahi banayega." → §4.5.
16. "End user se JSON mat pango — simple rahe." → §4.6.

---

## 10. FINAL REPORT — deliver this at the end

When everything is done, produce a clear report (also written to `docs/FINAL-REPORT.md`):

1. **Goal status** — the production-ready checklist from `docs/GOAL-CHECKLIST.md`:
   how many lines PASS, how many are known gaps, and the single biggest thing still
   standing between this app and a college trusting it with its results.
2. **What was broken** — every issue found, in plain language, with the file and line.
3. **What you changed** — grouped by phase, with the reasoning.
4. **The permission matrix, as it now stands** — role × operation × scope, and how each
   decision was justified against `new-requirements.md`.
5. **The scheme pipeline** — how it works end to end, what the AI does, what the human
   does, and how it fails safely.
6. **Edge cases covered** — the list, and the test that covers each.
7. **Migrations** — what each one does and how existing data was backfilled.
8. **Verified behaviour** — what you actually ran and saw (including at all three
   breakpoints), and what you could not verify and why.
9. **Known gaps** — what is still not production-perfect, and exactly why.
10. **Migrations the operator must run** — the exact commands.

Be honest about what is verified and what is not. **Do not claim something works because
the code looks right — say what you ran.**

---

## 11. START

Begin with Phase 0. Read the code, write `docs/AUDIT.md` and `docs/GOAL-CHECKLIST.md`,
and work through the phases until the application is genuinely production-ready for a
real college.

**The goal is the destination. The phases are the route. The checklist is the proof.**

Take the full time you need. **Do not stop to ask. Do not stop early. Do not leave it
half-done.**
