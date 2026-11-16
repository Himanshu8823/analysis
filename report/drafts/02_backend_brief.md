# Backend Brief — Result Analysis System (DBATU)

Factual description of what the backend actually does, read from the source. Business language: no code, no file paths, no identifiers.

---

## 1. What the modules do

### Foundation

**Bootstrap.** NestJS service on port 3001, URI-versioned under `/api/v`. Swagger is generated at runtime in non-production only, so the document cannot drift from the code. Helmet headers, cookie parsing, CORS allow-list from an environment variable. A global validation pipe strips unknown properties and *rejects* requests carrying them. Three global guards run in order: rate limiting, JWT authentication (public routes opt out), forced-password-change, permission enforcement. A global audit interceptor sits outermost so the audit write is awaited before the response returns.

**Cache.** Redis, exposed globally. Explicitly an accelerator and never a source of truth: if Redis is unreachable every operation degrades to a no-op and the API keeps serving correct results from the database. Connections fail fast rather than queueing; pattern invalidation uses cursor-based scanning, not the blocking key-listing command.

**Storage.** Files live in an S3-compatible bucket (Neon Storage here; also works with AWS S3, R2, MinIO), with a local-disk fallback for fresh checkouts and CI. Local paths are resolved and checked against the storage root so a crafted file name cannot escape it. The served-files route requires authentication *and* an ownership check.

**Health.** Reports database and cache reachability, overall status, uptime. A separate readiness check reports only the database, since the API is correct without the cache.

**Common services.** Three shared services carry the authorisation spine: a scope service resolving which branches a member may see; an authorisation service separating *permission* (may this member do this kind of thing) from *scope* (which records) from *ownership/allocation* (is this specific record theirs); and a URL guard refusing server-side fetches to private, loopback, link-local or cloud-metadata addresses — checking the hostname *and* every address it resolves to. A separate audit service is the single write path for audit rows; it never throws, because the mutation it describes has already committed.

### Identity and governance

**Auth.** Email/password login, bcrypt (12 rounds default). Short-lived access token (15 min) plus a separate refresh token (7 days) signed with a *different* secret. Refresh tokens are stored hashed and **rotated on every use** — the presented token is revoked and a replacement issued, so a stolen refresh token works at most once. Login returns the full role list and the union of permissions. Password change clears the forced-change flag, revokes every other session, and invalidates the cached permission set. Accepting an invitation creates the account, assigns role and branch, and consumes the invite in one transaction, so a token cannot be replayed. Profile editing is limited to the display name — the email is never self-service-editable. Avatars are validated by magic bytes, and the stored extension comes from the detected type.

**Password reset.** Always answers with the same generic message whether or not the address exists, so it cannot enumerate registered addresses. A random token is issued, stored hashed, expires in 30 minutes; only the latest link stays valid. Every request is audited.

**Invites.** Creates an invitation for a named role in a named branch and emails a one-time acceptance link. The Super Admin role is deliberately excluded from what can be invited. Role-granting follows a strict authority rule (section 2). Invitations expire (168 hours default), can be revoked, and every state change is audited. All invalid tokens produce one indistinguishable message.

**Users / members.** Directory: create, list with search and role/branch filters, view, update, activate, archive. Passwords are always hashed in the service layer; plaintext never reaches the repository and no client-supplied hash is ever stored. Two supporting services handle the consequences of removing a member: revocation (ending access end-to-end — tokens, allocations, roles, invitations) and impact (reporting what the member currently holds first). Archiving and revocation are the same act here.

**RBAC.** Three sub-capabilities: role catalogue, permission catalogue, and member-role assignment. Effective permissions are resolved by joining member-role → role-permission → permission — the union across all roles a member holds. There is one implementation of that join in the whole system, so the guard, the authorisation service and the client session can never disagree. Granting or revoking a role is audited and immediately bumps a global RBAC version counter, orphaning every cached permission set in constant time so the change bites on the member's next request.

**Audit logs.** Paginated listing, single-row read, and facet queries (distinct actions, resources, actors) for filter dropdowns. A college-scoped reader sees everything; a branch-scoped reader sees only entries by members of their branch, plus their own entries always. Facets are scoped identically, so a dropdown never offers a value the list would refuse.

**Notifications.** Per-member in-app notifications: create, list (unread-only filter), mark one read, mark all read, delete — all owner-checked.

### Academic structure

**Branches.** Departments: create, list (narrowed to caller's scope), view, update, delete. Seeded with Computer Science, Mechanical, Civil, Electrical, Electronics & Telecommunication.

**Academic.** Academic years (active one first, so the UI can preselect) and batches/cohorts, filterable by admission year.

**Schemes.** Curriculum schemes: create, list, view, update, delete. Seeded with SCHEME_2019, SCHEME_2022, SCHEME_2024, each with its own pass rules and effective date.

**Subjects.** Subject catalogue plus offerings. A subject carries a unique code, credits, maximum marks and a component configuration. An *offering* is a subject as it actually runs — in a branch, semester and scheme — and is the unit marks hang off. Duplicate codes are rejected legibly; offering the same subject twice in the same branch/semester/scheme is refused, since that would silently split one class's marks across two rows.

**Allocations.** Two relationships. A teacher allocation says "this teacher teaches this offering, this academic year" — the single source of the "own subject" boundary. A class-teacher assignment says "this teacher is class teacher of this class". Allocating checks teacher active, offering active, no duplicate for the year, and that the offering belongs to the *caller's* branch — so one branch's head cannot hand another branch's subject to their own teacher. The assignable-teacher list is scoped to the caller's branches rather than exposing the whole member directory.

**Students.** Roster: create, list with pagination and filters (branch, scheme, semester, year, free-text), view, update, archive. Every write is checked against branch scope — including the branch a student is being moved *into*, so the edit form cannot transfer a student across branches. Bulk import from JSON rows or spreadsheet; scope may come from the file, the request, or both, and every row's branch is checked even when the row names its own. Import cap: 5 MB, 5,000 rows.

**My result.** The student-facing surface: own result (marks per component, totals, percentage, credits earned, failed subjects) and own class leaderboard. The student is resolved from the token — there is no client-supplied student id, so a student cannot ask for anyone else's result. A result is visible only once an examination has been scheduled for the class *and* published; otherwise the student is told it has not been declared, rather than being shown a zeroed marksheet that reads like a fail.

**Student provisioning.** Creating student accounts (optionally linked to user accounts) and bulk-provisioning a cohort, linking each student record to the owning account.

**Class overview.** A class teacher's view. Classes are listed from their own class-teacher assignments, and a class is identified by the *assignment id* rather than branch+semester, so the client cannot address a class the teacher does not hold. Carries headline statistics (student count, subject count, average/highest/lowest percentage, students with complete marks, students with no marks, students with missing marks, passed and failed counts) plus per-subject standing and a per-student roster with standing, missing subjects and failed subjects. The pass/fail split is decided per student, so a student who failed two subjects counts once.

### Marks, results and output

**Marks** — detailed in sections 3 and 4. Holds the per-scheme calculator factory, a scope service narrowing reads, and an authorisation service gating every write.

**Upload / OCR / PDF parser / Scheme reader** — detailed in section 4.

**Analytics / Dashboard / Toppers** — detailed in sections 5 and 10. **Reports** — detailed in section 6.

---

## 2. The RBAC model

### Roles

Six, in descending authority: **SUPER_ADMIN** (configuration and governance, view-only on academic data), **ADMIN** (examination cell, operational control of results), **HOD** (department head, branch-scoped), **PRINCIPAL** (read-only analytics and oversight), **TEACHER** (subject teacher), **STUDENT** (own result only).

### Model type

**Permission-based, with roles as named bundles.** There is deliberately *no* role guard. Every route declares the permission(s) it requires; role names are never consulted as a gate — they appear only in the seed's mapping, the grant-authority rule, and display labels.

A member may hold **several roles at once**; the effective permission set is the union. The token carries one primary role for display, but every authorisation decision reads the full union from the database through the cache. A member with a linked student record who also holds staff permissions keeps the student view.

Enforcement requires **all** listed permissions on a route, not any one. Where two different rights can legitimately land on the same operation, the route lists a common permission and the service resolves which specific right the caller holds — this is the case for confirming an upload, where the exam cell's administrative right and the teacher's allocation-limited right are deliberately distinct.

### What each role can and cannot do

**SUPER_ADMIN** — manages members, roles, permissions, invitations, branches, schemes, academic calendar. Reads students, marks, reports, analytics, toppers, audit trail. **Cannot** create students, enter marks, upload files or generate reports. This is deliberate: Super Admin is the configuration role, not the operational one.

**ADMIN (exam cell)** — the operational role. Creates students, creates and edits subject templates and offerings, enters marks for every subject in the class, uploads and approves result extractions for the whole batch, generates and downloads reports, reads full-college analytics and toppers, manages examinations, publishes notifications. **Cannot** manage members, roles, permissions, branches or schemes.

**HOD** — a branch-scoped reader plus allocator. Reads students, marks, reports, analytics, toppers; generates and downloads reports for their branch; reads uploads; creates and edits subjects and offerings for their branch; allocates teaching and class teachers within their branch. Holds the "read own department" analytics right, which is what puts it in the branch-scope dashboard. **Cannot** create students, enter marks for arbitrary subjects, or reach beyond its own branch.

**PRINCIPAL** — strictly read-only, holding **no write permission of any kind**. Reads students, marks, reports (and downloads them), full-college analytics, dashboard, branches, schemes, subjects, offerings, toppers, audit trail. **Cannot** upload, create students, write marks, generate reports, write allocations or publish notifications.

**TEACHER** — reads students, marks, reports, uploads, branches, schemes, subjects, offerings, toppers, analytics, and its own allocations and class-teacher assignments. Enters marks **only** for allocated subjects (the allocation check runs in the service layer against the academic year being written), and writes extracted upload scores **only** for those same subjects. **Cannot** create students, write marks for unallocated subjects, approve a whole-batch extraction, generate or download reports, or manage branches, schemes or allocations.

**STUDENT** — sees exactly four things: the dashboard shell, own student record, own marks, own class's toppers. Deliberately **does not** hold the general student-list or marks-read permissions, because those would expose the whole roster and the whole mark sheet. Requests for another student's record are refused.

### Branch / scope isolation

Isolation is **branch-based**, derived from the member's role-assignment rows rather than the token — a person can hold roles in several branches, and the union decides what they see.

- A member with at least one assignment naming a branch is **branch-scoped**: every read is filtered to those branches.
- A member whose assignments all name no branch is **college-scoped**: no branch filter applies.
- A branch-scoped member requesting a branch outside their scope is **refused**, not silently redirected — rejection makes the mismatch visible rather than hiding a client bug.
- A member scoped to several branches who names none still sees only those branches. The scope is a *set*, not a single id; a single-id implementation would drop the filter entirely and show the whole college.
- Reads and writes are separated: a college-scoped member may read any branch but is still bounded on writes to the class being worked on — writing a student into another branch is a different act from reading one.

Scope is applied in the **service layer**, not only in controller decorators, because a decorator alone is bypassable by any code path that calls the service directly — a background job, a queue processor. Every marks write path goes through one gate, so no path can drift.

### Who may grant what

A member may grant a **staff** role only if it carries strictly less authority than the strongest role they hold. Super Admin is never granted through the application — only by the system administrator. The Student role is appointed rather than granted as staff: it may be handed out from Principal level upward, since appointing a student is not a teacher's act. A member holding several roles is judged by the **strongest**, and the comparison is strict, so nobody may appoint a peer — an Admin cannot appoint another Admin, a Principal cannot appoint another Principal.

### Ownership and allocation

Beyond permission and scope, a third check applies at record level: the caller must be responsible for that specific record. A teacher may write marks only for offerings allocated to them for the year being written. The exam cell may write any offering in scope **except** one a teacher holds — overwriting a teacher's subject requires an explicit, audited correction carrying a written reason, recorded under its own audit action rather than as an ordinary entry. A mark's student must belong to the offering's branch. An upload's row must resolve to a student in the branch named in the upload metadata, and to a subject actually offered in that class.

---

## 3. Result and marks computation

### How marks are entered

Four routes, sharing one authorisation gate:

1. **Single entry** — upserts one mark for student + offering + exam type + academic year.
2. **Bulk entry** — many marks in one request; refused as a whole if any row fails a check, so the operator is never left guessing which rows saved.
3. **Correction** — a separate route for the exam cell to overwrite a mark a teacher holds. Requires the exam-cell write permission and a written reason; recorded under a distinct correction action with the reason attached, so "who changed this published score and why" always has an answer.
4. **Upload confirmation** — extracted rows written through the same upsert key, so re-confirming updates rather than duplicates.

Each mark stores marks obtained, maximum, and two flags: absent and withheld. An absent mark counts as zero in totals but is flagged, so an absence is distinguishable from a genuine zero.

### The calculators

Three scheme-aware strategies, selected by the scheme on the student's record. All three compute a subject result and a whole-student aggregate.

**2019 scheme.** Components: two continuous assessments, mid-semester, written theory paper, and where applicable the practical. Pass requires *all* of: each continuous assessment ≥ 6 of 20; mid-semester ≥ 8 of 20; internal total ≥ 30 of 60; written paper ≥ 45 of 100; practical ≥ 10 of 25 where applicable; aggregate ≥ 50%.

**2022 scheme.** Theory 100 = internal 40 (class test 15, mid-semester 15, micro-project 10) + external 60 (written); practical 25 assessed separately. Pass requires internal ≥ 20 of 40, external ≥ 30 of 60, practical ≥ 13 of 25 where applicable, aggregate ≥ 50%.

**2024 scheme.** Theory 100 = internal 40 (class test 1 of 15, mid-semester 15, quiz 10) + external 60; practical 25 separate. Same thresholds as 2022.

### Totals, percentage, credits

Subject obtained = sum of components (absent contributes zero); subject maximum = sum of component maxima; percentage = obtained ÷ maximum. Student totals sum across the offerings of *their class* — the subjects actually offered to that branch, semester and scheme for the year, not the whole catalogue. Overall percentage = student total obtained ÷ total maximum. Credits earned count only subjects that passed; total credits count all offered subjects. The calculators do not round — full precision is returned, rounded only for display.

### The pending/failed distinction

This is the most important rule in the computation, enforced consistently across calculators, reports, dashboard and analytics.

**A subject with no marks has no verdict yet.** It is *pending*, not failed. Scoring it as zero would report every half-entered class as a class where everybody failed. Each subject result therefore carries an explicit "has this been evaluated" flag, and the reason reads "Result not entered yet" rather than "Fail".

Consequences: a pending subject earns no credits but is counted separately rather than treated as a failure; a student's result is **complete** only when every offered subject has a verdict; a student **passes overall** only when the result is complete and every subject passes; and report generation is **refused** for an incomplete class, with the refusal naming exactly which subjects and students are missing.

### Grades, best-of, attendance, re-evaluation

- **Grades** — no letter grades at the calculator level; banding lives in the analytics layer (distinction ≥ 75%, first class ≥ 60%, second class ≥ 50%, borderline band at 40%).
- **Best-of** — does not exist. No component is chosen over another; every component contributes to the total.
- **Attendance** — not a computation input. Not modelled as a mark component; does not affect pass/fail.
- **Re-evaluation** — exists as a *withheld* flag on the mark record; withheld marks are excluded from every statistic, breakdown and report. Beyond that flag and the audited correction route, there is no re-evaluator workflow.

### Absent handling

An absent component contributes zero and is flagged. Absent components do not trigger the "below minimum" reasons, so a student absent for the written paper is reported as absent rather than as having failed the external threshold — though the aggregate still counts the zero.

### One inconsistency worth flagging

The scheme calculators use a **50%** aggregate pass threshold; the analytics module, dashboard and class overview use **40%**. A student at 45% is "Pass" in the calculator and "passing" in the analytics figures. This is a real divergence between reporting layers and computation layer, and should be reconciled.

---

## 4. The upload pipeline

### Accepted formats and detection

File type is decided from the **bytes**, not the extension or declared content type, using magic-byte signatures: PDF signature, ZIP signature for Excel, and a CSV heuristic (UTF-8 BOM, or printable ASCII with at least one separator and no NUL byte). PDFs are then classified text-based or image-only by an image-subtype marker in the header — image PDFs go to OCR, text PDFs to the text extractor. Extension is a last-resort fallback only.

Accepted: PDF (text and scanned), Excel, CSV, plain text. **Size limit 50 MB**, enforced at both the HTTP layer and in the service.

### Entry points

- **Register a file at a URL** — the client supplies an absolute URL to a file it already placed in storage. The URL is checked against the server-side-fetch guard *before* anything is written or queued, so a refused address leaves nothing behind.
- **Upload directly** — the browser posts the bytes; they are written to local storage first so the job gets a URL the server-side parser can fetch. This is the route the web app uses, because a browser cannot hand the server a `blob:` URL.

### Queues and workers

Three BullMQ queues share one Redis instance (same host, port and DB index as the cache):

- **`upload-jobs`** — the extraction worker: fetch, parse, write extracted rows and row-level errors onto the job. It reads backend-stored files straight from disk (the served-files route is authenticated, so an HTTP fetch would return 401); files elsewhere are fetched over HTTP, but only after the address guard passes.
- **`ocr-jobs`** — the OCR worker: read, pick the model, extract, write the result back.
- **`reports-jobs`** — report generation.

All use keep-last-N on completion and keep-failed for inspection. Email has its own queue with three attempts and exponential backoff.

### The parsers

**Printed DBATU result statement parser** — the format the examination cell actually receives: a wide table, one row per student, merged two-row header (first row names subjects, second names components under each subject, subject blocks separated by a pipe). The table is laid out in columns, not delimited, so cell boundaries come from runs of two or more spaces. The parser handles the awkward parts deliberately:

- A subject code is recognised by *shape* (letters then digits, optionally with an INT/PR part marker), so "Roll", "Percentage" and "SGPA" are never mistaken for subject headings — a mistake that would shift every later column out of alignment.
- Summary columns (Total Marks, Percentage, SGPA, Result) are deliberately ignored. They are the college's own arithmetic; re-deriving them from the components is the point of the system.
- One student row expands into one mark record per component.
- The **practical block** is kept separate from the theory block of the same subject. A mark is keyed on student + subject + exam type, so a practical recorded under the theory's component names would silently overwrite the theory's mark. In a wide practical block the components keep their names prefixed as practical parts, and the last column is recorded as the practical itself.
- **Default maximums** are used (CA1 20, CA2 20, mid-semester 30, written 100, practical 25, oral 10) — defaults only, since the statement prints marks, never maxima.
- "Absent" is recorded as zero with the absent flag; "Fail" as zero without it.
- A **blank cell** is not a zero — it means the component was not conducted. The omission is reported and the component left out; recording it as zero would silently fail the student.
- A mark **above** the default maximum is kept, not dropped, and reported later at the step that knows the real maximum.
- A row with no PRN or roll number is reported as an error rather than guessed at; a file naming no subject is rejected outright as "not a printed result statement".

**Tidy sheet extractor** — the long layout (one row per mark). Header aliases are generous: "Roll No", "Enrollment No", "PRN No" all resolve to the identifier; "Subject Code", "Subject", "Subject Name" to the subject. Cap 5,000 rows.

**PDF text extractor** — reads text and attempts a line-based table parse (rows by newline, columns by runs of two-plus spaces, tabs or pipes). The code itself calls this best-effort, suitable for tabular DBATU result PDFs but not production-grade.

### OCR

Two roles: the **worker** selects a Hugging Face model and runs the extraction; the **service** handles model selection, the standalone extraction endpoint, and job-status reads. Three models: a table transformer for table-like content, a handwriting recogniser for handwritten content, and a general-purpose OCR model otherwise. Table detection runs as a second, optional call — a failure there is logged and extraction continues.

The recognised text is fed through the **same tidy sheet parser**, so the OCR review screen has exactly the same shape as a spreadsheet upload. The header line is located by looking for a line naming both a roll number and a subject; if none exists, the user is told to upload a spreadsheet instead.

### Statuses

**PENDING** (created) → **PROCESSING** (worker started, progress recorded) → **EXTRACTED** (rows and errors written, awaiting human review) → **COMPLETED** (confirmed and written to the marks table). **FAILED** on dispatch, parsing or OCR error, with the message stored on the job.

Nothing is written to the marks table automatically. The job sits in EXTRACTED until a human reviews and confirms.

### The confirmation step

The security model is enforced most carefully here, and it is two-stage:

- The exam cell's right covers **every** offering in the class.
- The teacher's right covers **only** the offerings allocated to them for the academic year being written.

A row the teacher is not allocated to is **skipped, not rejected** — a statement commonly covers the whole class and the teacher's own subjects are part of it. The upload still reports completed, with skipped rows listed.

Other rules: branch, scheme, semester and academic year must all be in the upload metadata, with semester a positive integer; the confirmer must be allowed to write in the branch the metadata names (the branch is caller-supplied — it is a **filter, never a grant**); students are resolved by roll number **within the branch and year** (the branch filter is not optional — a roll number is only unique inside a branch, and without it a row could match the wrong student); the **subject's own configured maximum wins** over the parser default, and a mark exceeding it is reported and skipped rather than written, because a mark above the maximum would corrupt every percentage derived from it. All writes happen in one transaction.

### Error handling

Row-level problems are collected, not thrown: unreadable values, missing components, unknown students, subjects not offered in the class, unallocated subjects and over-maximum marks are each recorded with a reason. A parser failure marks the job FAILED with the message; a dispatch failure marks FAILED and re-throws.

---

## 5. Analytics and analysis

### Analytics module

**Overview** — total students, total subject offerings, total mark records, overall pass percentage, average percentage. The average is computed per mark row.

**Pass/fail statistics** — computed **per student**, not per mark: each student's marks are aggregated into one percentage, then banded. ≥ 75% distinction; ≥ 60% first class; ≥ 50% second class; ≥ 40% a borderline band that still counts as a pass; below 40% a fail. Totals report students, passes, fails, both percentages and each band's size.

**Subject statistics** — per subject: students, average marks, average percentage, highest and lowest mark, pass and fail counts, pass percentage, and a difficulty label from the pass rate (≥ 70% Easy, ≥ 50% Moderate, below Hard).

**Performance trends** — a point per academic year, oldest first: average percentage, pass percentage, student count. Years with no marks still appear, with zeroes.

**Filters** — academic year (explicit, or the active year resolved automatically), branch (one or many), scheme, semester. Marks carry no branch of their own, so branch filtering runs through the student relation for student-scope queries and the offering relation for subject-scope queries. Absent and withheld marks are excluded from every figure.

### Dashboard

Permission-driven, resolving one of four scopes before computing anything:

- **Own** — a member with a linked student record sees only their own result: overall percentage, pass/fail verdict, subjects graded, roll number, subject-wise performance chart.
- **Class** — a member who can enter marks only for their own allocations and holds no exam-cell write right (the teacher). Their world narrows to the offerings they are allocated and the classes they are class teacher for. A teacher with no allocation gets an **empty** dashboard, not the whole college — the empty set is treated as "no branch at all", which must match nothing.
- **Branch** — a member who can read their own department analytics (the HOD).
- **College** — a member who can read analytics across the college (Principal, exam-cell Admin). Their data is still narrowed to their branch scope if they hold one.

Metrics, filtered by what the scope makes meaningful: total students, total subject offerings, pass percentage, average percentage, and — for those who can act on it or supervise it — marks uploaded and marks pending. The upload-pipeline metrics are withheld from the Principal deliberately: they hold no write permission and could do nothing about a pending count.

Chart sections: students per branch (college scope only), students per semester, subject offerings per semester, pass percentage per branch, average performance by academic year (multi-year trend), toppers per branch, branches with missing data (governance view, college scope only), subject offerings awaiting marks (a to-do list), result publication status per semester (donut).

Two design points worth noting. The trend line aggregates **per student** first, because a student has many mark rows and averaging rows would weight a student with more components more heavily. And the publication-status query is wrapped in a guard because the examinations table may not be migrated yet — when it fails the dashboard still renders and reports the omission as a degraded item rather than showing a misleading zero.

### Class overview

Headline statistics, per-subject standing (students with marks, average percentage, highest mark and who got it, pass count) and a per-student roster (total marks, percentage, subjects with marks, missing subjects, failed subjects). Pass/fail is per student; students with no marks at all are counted separately so the pass and fail figures never double-count.

---

## 6. Reports

### Types and format

Seven types accepted: student-wise, scheme-wise, subject analysis, student analysis, class toppers, pass/fail, and a **complete** report bundling everything.

**Excel only.** A multi-sheet workbook produced with ExcelJS. No PDF report and no print-specific output exist on the backend. (A document renderer and scheme/course extractor exist under shared PDF utilities, but they serve the scheme reader, not reports.)

### The workbook

For a complete report, seven sheets: Student Wise Result, Scheme Wise Marks, Subject Analysis, Student Analysis, Class Toppers, Pass/Fail Analysis, Charts Data. Each row carries calculated percentage, pass verdict, credits earned against total credits, and a completeness flag, so the sheet can never print a verdict the student did not earn. The calculator used is the scheme-aware one for the class's scheme.

### The readiness gate

A report is a published statement about the class — every student on the sheet gets a pass or a fail — so it is **refused while any student's result is incomplete**. The refusal names what is missing: how many students complete, how many pending, which subjects are missing (with how many students missing each), and which students are pending (capped at 20 named, count beside them). A separate readiness check is exposed so the operator is told what is missing *before* pressing generate, not only after refusal.

### Generation and download

Generation is queued. If the queue is unavailable it falls back to running inline rather than losing the job. The download **regenerates the file fresh from current marks** rather than serving a stored copy — so the readiness check runs again at download time, because marks may have been added or withdrawn since the report was queued, and a download must never hand out a sheet stating a verdict for a result that is not in.

Branch scoping applies throughout: a branch-scoped member may only generate, read, download and delete reports for their own branches. Deletion is checked with the same scope as reading — otherwise the read scope would be theatre. Rate limit: 5 generations per hour per member.

---

## 7. Notifications, email and audit logging

### Notifications

In-app, per member: create, list (unread-only filter), mark one read, mark all read, delete — all owner-checked. The exam-cell Admin holds the notification write right.

### Email

Two emails, both queued through an SMTP transport:

1. **Invitation email** — invitee's name, role, a one-time acceptance link, expiry date. The invitee sets their own password on acceptance; no temporary password is ever generated or sent. The invite URL is escaped for HTML output.
2. **Password-reset email** — a reset link with an expiry timestamp.

Both render from a shared HTML layout with escaping applied to every interpolated value. The API never blocks on an SMTP round trip; if the queue is unavailable the email is sent inline, so an invitation is never silently dropped because Redis was down. When SMTP is unconfigured the module still boots, outgoing email is disabled, and the system logs that the link must be shared manually. Only recipient and message id are logged — never the body, never a token inside it.

### Audit logging

Every mutation is recorded: who, what, when, the entity changed, its id, free-form details (including a **reason** where the operation warrants one), and request context — IP, user agent, HTTP method and route.

The action vocabulary is a fixed, filterable set: **create, update, delete, bulk import, confirm, correction, grant, revoke, deactivate, archive**. Corrections get their own action rather than being filed as an ordinary update, because a correction overwrites work another person is responsible for; privilege changes get their own actions because they are the most consequential thing the system records. Resources covered: student, subject, subject offering, mark, branch, scheme, teacher allocation, class-teacher assignment, upload job, user.

Audit rows are written through a single service that never throws — a failed write is logged and dropped, because the mutation has already committed and failing the request afterwards would be worse than a missing row. Reads are scoped: college-scoped readers see everything; branch-scoped readers see only entries by members of their branch plus their own always.

Beyond audited routes, the system records logins, password changes, profile updates, avatar changes, invitation acceptances, password-reset requests, role grants and revocations, and member deactivations.

---

## 8. Security measures actually implemented

**Authentication.** Stateless JWT bearer tokens. Access tokens 15 minutes; refresh tokens 7 days, signed with a **separate secret**, stored hashed, and **rotated on every use** — the presented token is revoked and a replacement issued, so a stolen refresh token works at most once. Logout revokes one user's tokens; logout-all revokes every session.

**Password storage.** bcrypt, 12 rounds default (configurable). Refresh tokens are bcrypt-hashed before storage; reset tokens are SHA-256 hashed — only the raw token is emailed.

**Forced password change.** A global guard blocks every authenticated route while a member must still change their password. The frontend redirect is a convenience, not the control — without the guard a token holder could skip the page and keep using the API with the old password. The flag is cached 60 seconds.

**Authorisation.** Permission enforcement at the route, plus service-layer scope and ownership checks a decorator cannot express. The permission cache falls back to the database on a miss and on a Redis outage — the previous behaviour of returning "allow" on a miss would have silently disabled every permission check in the system.

**Rate limiting.** Three global tiers: 3 requests/second, 100/minute, 1000/hour, with per-route overrides: uploads 10/hour, report generation 5/hour, scheme reading 10/hour.

**Input validation.** Global pipe strips unknown properties and **rejects** requests carrying them, with implicit type conversion. DTOs use class-validator with type, format and range constraints throughout.

**Server-side request forgery protection.** Any URL the server is told to fetch is checked twice — at job creation and at the moment of fetching. The guard refuses non-HTTP(S) schemes, refuses known-local hostnames, and resolves the hostname, checking **every** resolved address against private, loopback, carrier-grade NAT, link-local (including the cloud metadata address), multicast and reserved ranges, for IPv4 and IPv6. The refusal message is identical for every refusal, so the check cannot be used to probe which addresses exist.

**File upload validation.** Type decided from magic bytes rather than extension or declared content type, for both result files and avatars. Avatars restricted to PNG, JPEG, GIF, WebP, capped 5 MB, stored extension taken from the detected type so the stored file always matches its bytes. Result uploads capped 50 MB, student imports 5 MB, syllabus documents 20 MB.

**Output encoding.** Email templates escape every interpolated value; URLs escaped separately.

**Path traversal.** Every local storage path is resolved and checked against the storage root.

**Error handling.** A global exception filter normalises errors into a consistent envelope; helmet sets the standard HTTP headers.

**Enumeration resistance.** Password reset returns the same message whether or not the address exists. All invalid invitation tokens produce one indistinguishable message. Upload jobs belonging to another member return **not found**, not forbidden, so id existence cannot be probed. A student requesting another student's record gets forbidden (the record does exist) rather than not found.

**CSRF.** No CSRF token mechanism. The application is token-authenticated via the Authorization header, though CORS has credentials enabled and a cookie parser is installed — the intent should be confirmed.

**Secrets in config.** JWT and refresh secrets fall back to a placeholder string when the environment variables are missing; a startup failure would be safer.

---

## 9. Caching strategy

Redis, used for four things:

1. **Effective permissions per member** — keyed by member id and the global RBAC version. Default TTL **300 seconds**. The version counter is bumped on any role or permission change, orphaning every previously cached permission set in constant time. On a miss or a Redis outage the guard falls back to the database — an outage downgrades performance, never authorisation.
2. **The forced-password-change flag** — TTL **60 seconds**, deliberately not versioned by the RBAC counter, since password state has its own lifecycle.
3. **The RBAC version counter** itself.
4. **Bulk deletion** — a multi-key delete for invalidation.

There is **no caching of report output, marks, analytics results or dashboard figures** — those are read fresh from the database on every request.

The cache service degrades to a no-op when Redis is unreachable: reads return null, writes are dropped, the API keeps serving correct results from the database. Health reporting shows the cache as a separate, non-blocking dependency.

---

## 10. The toppers module

**Subject-wise toppers.** For every subject offered in the class, the highest-scoring student or students, with mark, percentage, and whether the top mark is a tie. A tie is detected explicitly and every student at the top mark is listed at rank 1. Score is the sum of that subject's components.

**Class toppers.** The class leaderboard with each student's total marks, total possible marks, percentage and credits earned, computed through the scheme-aware calculator.

**Class toppers by rule.** The same leaderboard ranked by a chosen strategy — three, each a pure, separately testable algorithm:

- **Percentage** — overall percentage; ties broken by credits, then total marks, then roll number for stability.
- **Credits** — credits earned first (a proxy for passing more subjects), then percentage, then total marks, then roll number.
- **Marks** — raw total marks obtained, falling back to percentage, then roll number.

Client-facing aliases are accepted for rule names; an unknown rule is rejected with the list of supported rules.

**Student-facing toppers.** A student sees the leaderboard of **their own class only** — the class is derived entirely from their own record, so a student can never widen the window with query parameters.

Toppers are readable by the exam cell, HOD, Principal and teacher (within branch scope); the student's narrower right covers only their own class.

---

## Noteworthy findings

- **Pass-line inconsistency.** Scheme calculators use a 50% aggregate pass threshold; analytics, dashboard and class overview use 40%. A student at 45% passes in one layer and fails in another. Should be reconciled to one value.
- **No PDF or print report.** Reports are Excel only. A PDF result statement is a common examination-cell requirement and there is no backend support for it.
- **No re-evaluation workflow.** Withheld marks exist as a flag and audited corrections as a route, but there is no re-evaluator role and no provisional/final result states.
- **No attendance model.** Attendance does not participate in pass/fail.
- **No CSRF token mechanism.** Appropriate for header-based token auth, but CORS enables credentials and a cookie parser is installed — the intent should be confirmed.
- **Default secrets.** Both JWT secrets fall back to a placeholder string when environment variables are absent.
- **Analytics averages are per mark row**, while pass/fail is per student — the two figures in the same response use different denominators.
