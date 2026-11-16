# Decisions

Every decision taken while hardening this system, with the reason behind it.

Read this file before changing anything in `apps/backend/src/common` or the
permission model — several of these are load-bearing, and reversing one
silently will reintroduce a data leak.

---

## How to read this file

| Section | What it covers |
|---|---|
| [The authorisation model](#1-the-authorisation-model) | The spine every other decision hangs off |
| [Revocation and lifecycle](#2-revocation-and-lifecycle) | What "revoking" a member means |
| [Academic structure](#3-academic-structure) | Semester, year, scheme |
| [Data integrity](#4-data-integrity) | Deletion, audit, concurrency |
| [Error handling](#5-error-handling) | What the user is told, and what never leaves the server |
| [The scheme pipeline](#6-the-scheme-pipeline) | PDF → AI → review → subjects |
| [Corrections to `new-requirements.md`](#7-corrections-to-new-requirementsmd) | Where the requirements doc is stale |
| [The worker process](#8-the-worker-process) | Where the documented architecture and the code disagree |
| [Who reads the syllabus](#9-who-reads-the-syllabus-the-code-or-the-model) | Why the model reads and the code extracts |
| [Living within the provider's limits](#10-living-within-the-providers-limits) | Output caps, pacing, and the guard's silence |
| [Reading a printed table](#11-reading-a-printed-table-the-geometry-is-the-data) | Why the reader failed on the university's own PDF |
| [Scope, authority and addresses](#12-scope-authority-and-addresses) | The three rules that stop a read from going too far |
| [The shared class](#13-the-shared-class) | One class context, instead of fourteen private copies of it |
| [Two copies of a rule](#14-two-copies-of-a-rule-that-must-agree) | The grant rule, and the test that proves the copies agree |
| [Corrections, reports and what a delete means](#15-corrections-reports-and-what-a-delete-means) | What is kept, what is archived, and what is never deleted |
| [Any of these and all of these](#16-any-of-these-and-all-of-these) | When a route needs one permission or several |
| [Verifying the matrix against the running application](#17-verifying-the-matrix-against-the-running-application) | The check that found the locked-out routes |
| [Publishing a result](#18-publishing-a-result) | The last step of the college's cycle |
| [Known gaps](#19-known-gaps) | What is not finished, and why |

---

## 1. The authorisation model

### 1.1 Permissions are the only gate; roles are bundles

A route is guarded by the **permission** it needs, never by a role name. A role
is a named bundle of permissions and a member may hold several roles at once;
the **union** of their permissions is what the guard sees.

*Why:* the backend already enforced by permission only — a grep for `@Roles(`
across `apps/backend/src` returns exactly one hit, a comment in
`dashboard.controller.ts` explaining the omission is deliberate. Adding role
checks back would create two sources of truth that can disagree.

*Consequence:* a new capability needs a new permission, not a new role check.

### 1.2 Scope is derived from the caller, never from a parameter

The branch a caller may see comes from their `UserRole` rows, resolved at
request time by `ScopeService`. A caller-supplied `branchId` is a **filter**,
never a **grant**: asking for a branch outside your scope is a 403, not a
silent override to your own branch.

*Why:* the override behaviour hides a client bug and returns a result set the
caller did not ask for. Rejection makes the mismatch visible.

### 1.3 Enforcement lives in the service layer

Every authorisation decision is made in a service, not only in a controller
decorator. A controller decorator alone is bypassable by any code path that
calls the service directly — a background job, a queue processor, a future
controller.

*Why:* BUG-1 was exactly this failure: `MarksService.assertTeacherAllocated`
existed, was correct, and was called by **nothing**. The guard was theatre.

### 1.4 The exam cell does not write scores

Two distinct rights, deliberately kept apart:

| Right | Permission | Who holds it | What it means |
|---|---|---|---|
| Exam-cell write | `marks:write` | ADMIN | May write for **any** offering in scope, but **cannot** write a subject a teacher holds an allocation for, unless the exam cell performs an explicit, audited **correction**. |
| Teacher write | `marks:enter_own_subject` | TEACHER | May write **only** for offerings the HOD allocated to them, for that academic year. |

Class-teacher status grants nothing on its own.

*Why:* the requirements say the exam cell "defines what a subject is worth" and
the teacher "writes what a student scored" (§3.3, §3.6). The user's own
complaint — *"subject ke marks admin de pa raha hai, ye galat hai"* — is
exactly this.

*Implementation:* `MarksAuthorisationService` (Phase 1) decides, from the
caller's permissions, whether a write is allowed for a given offering. When an
exam-cell write targets a subject a teacher holds, the write is refused with a
message that names the subject and points at the correction flow.

### 1.5 A correction is explicit, reasoned and audited

An exam-cell write over a teacher's subject is not forbidden outright — a
subject's marks sometimes have to be corrected after publication, and only the
exam cell has the authority to do it. It is, however, a **different operation**
from ordinary mark entry:

- it requires the `marks:write` permission (not `marks:enter_own_subject`),
- it requires a written **reason**,
- it is recorded in the audit log as `CORRECTION`, naming the teacher whose
  allocation was overridden,
- the teacher's original marks are preserved, not overwritten.

*Why:* this is what a real college needs, and it keeps the invariant honest
rather than turning it into a prohibition the exam cell would route around.

### 1.6 The frontend hides what the backend refuses

A member must never be shown a screen, button, column or row they may not use.
Not a disabled button, not a link that 403s, not a table the API will refuse.

*Why:* the user named this directly — *"role based mai to bahut jarurat hai
kyunki role based mai vo cheeje user ko dikhni hi nahi chahiye jo unhe access
nahi hai… ye data leak hai actually."* A visible-but-403'd screen is already a
leak: it tells the user the record exists.

*Implementation:* one shared capability layer, `packages/shared-constants`,
holding the permission catalogue and the per-screen capability rules, imported
by both the backend and the frontend. If the two sides answer differently for
the same question, that is a bug — and a test asserts they do not.

### 1.7 A 403 is never a dead end

Every denial lands on a screen that says what happened in the end user's
language and offers a way forward — go back, or contact the administrator who
can grant access.

---

## 2. Revocation and lifecycle

### 2.1 Deactivate and delete are different, and neither is a hard delete

| Action | Access | History | Allocations | Tokens |
|---|---|---|---|---|
| **Deactivate** | Revoked immediately | Preserved | Released, with the class flagged as needing a teacher | Revoked immediately |
| **Delete** | Revoked immediately | Preserved (soft delete) | Same as deactivate | Revoked immediately |

Nothing is ever hard-deleted. `Mark`, `AuditLog`, `Report` and `Invitation`
rows all reference members, and a hard delete would destroy the audit trail
that makes a result traceable.

*Why:* "no silent data loss" is a non-negotiable, and an audit trail that
disappears with the user is worthless.

### 2.2 Revoking a class teacher leaves the class visibly unassigned

When a member who is the class teacher of a class is revoked, the class **loses**
its class teacher. This is not hidden and not auto-reassigned.

- The class is flagged **"class teacher required"** everywhere it appears:
  the class overview, the dashboard, the assignments screen.
- The revocation is refused unless the administrator has been shown the
  consequence and confirmed it.

*Why:* the requirement is "exactly one class teacher per class". A revoked
teacher still shown as the class teacher breaks the invariant; an automatic
reassignment to an arbitrary colleague silently grants someone authority over a
class. Flagging it is the honest middle: the college sees a gap and fills it.

### 2.3 Reassignment is a replacement, never an overwrite

Assigning a class teacher to a class that already has one is an explicit
**replacement**: the screen says who is being replaced and that their access
to the class ends, and requires confirmation.

### 2.4 Revocation shows its consequences before it happens

The member edit screen lists exactly what a revocation will do before the
administrator confirms:

> This will remove 3 subject allocations and 1 class teacher assignment.
> Computer Science · Semester 5 will have no class teacher.

### 2.5 Every revocation is audited

Who revoked, whom, when, why, and what was released.

---

## 3. Academic structure

### 3.1 Semester is the operating unit; year is derived from it

Semester 1–2 → Year 1, 3–4 → Year 2, 5–6 → Year 3, 7–8 → Year 4. The
derivation lives in **one** helper, `semesterToYear`, in
`packages/shared-constants`, used by both the backend and the frontend.

*Why:* the user was explicit — *"chheeze semester pe depend hoti hai, year pe
nahi… agar hota bhi hai to vo sem se accessible ho jayegi."*

### 3.2 The academic year is the running year

The system determines the currently-running academic year from today's date
against `AcademicYear.startDate` / `endDate`, and defaults every filter,
dropdown and form to it. The user can still choose another year explicitly,
which is how history is reviewed.

### 3.3 Redundant year columns are removed

`SubjectOffering.year` and `Student.currentYear` are removed by migration. The
year is derived from the semester, so it can never contradict it.

*Migration:* the columns are dropped after being backfilled into the derived
value, so no existing row is left inconsistent.

**The bug the removal exposed.** The scheme reader wrote `year: semester` —
the *semester number* (1–8) into the *year* column (1–4). A semester-5
subject was therefore stored as "year 5", which is not a year at all. It went
unnoticed because nothing read the column back to check it, and because the
column was redundant in the first place: every screen that showed a year
derived it from the semester anyway.

This is the argument for removing a redundant column rather than maintaining
it: a column nothing reads is a column nothing validates.

### 3.4 A semester and a year that contradict each other are rejected

At the API boundary, not silently stored.

---

## 4. Data integrity

### 4.1 Marks are sacred

The calculators are the specification. Their expectations are never changed to
fit a new input — a new input is adapted to the calculator.

- The calculators are covered by tests for every scheme (2019, 2022, 2024) and
  every edge case: absent, withheld, partial, zero-credit, practical-only,
  CC-option.
- A subject with **no marks at all** is *pending*, not *failed*. Scoring it as a
  zero would report every half-entered class as a class where everybody failed.
  (This is already the behaviour in `scheme-2024.calculator.ts:83`.)

### 4.2 Deletion is reversible or explicitly archived

- A subject with marks cannot be deleted — it is deactivated.
- A student with marks cannot be deleted — they are archived.
- A scheme with offerings cannot be edited in place — a new version is created.
- Marks are never cascaded away when an allocation or a teacher is released.
  The author of a mark is preserved so history stays readable.

### 4.3 Every academic mutation is audited

Using the existing `@Audited(...)` decorator. Coverage is extended to marks,
students, subjects, offerings, schemes, allocations, examinations, branches,
academic years, reports and role changes.

### 4.4 Concurrent edits are detected

Two people editing the same record produce a 409, not a silent overwrite. The
record carries a version; a write that carries a stale version is refused with
"someone else changed this — reload and try again".

### 4.5 Bulk operations are all-or-nothing

A bulk mark write that touches an unallocated subject is rejected **whole**.
"47 of 50 saved" is never a state the marks screen can be in.

---

## 5. Error handling

### 5.1 One filter shapes every error

`HttpExceptionFilter` is the single place an error response is shaped. Its
response is always:

```json
{ "success": false, "error": { "code": "...", "message": "..." }, "timestamp": "...", "path": "..." }
```

### 5.2 Internal detail never reaches a client

No stack trace, no SQL, no Prisma error, no file path, no secret. The
**original** exception message is logged server-side and replaced with a
friendly sentence for the client.

*Why:* the filter used to pass `exception.message` through for any non-HTTP
error, so a Prisma error surfaced its table and column names to the browser.
That is both an information leak and unreadable for a college clerk.

*Implementation:* the filter now distinguishes three cases.

| Case | Status | What the client is told |
|---|---|---|
| An `HttpException` | its own | Its own message — it was written for the person reading it |
| A body the server could not parse | 400 | "That request could not be read. Please try again." |
| Anything else | 500 | "Something went wrong on our side. Please try again." |

The real message and stack are written to the server's log in the third
case, and never leave the server.

*Proof:* `http-exception.filter.spec.ts` asserts, for a Prisma error, a
foreign-key error, a missing-file error and a connection-string error, that
none of the table names, column names, file paths or credentials appear in
the response body — while the response still carries a sentence the member
can act on.

### 5.3 The error carries a request id

A 500 includes a short request id, so a user can quote it and the administrator
can find the log line.

### 5.4 Errors are sentences attached to the thing that failed

| Situation | What the user is told |
|---|---|
| Not allocated | "You are not allocated to Computer Networks, so you cannot enter its marks." |
| No access | "You do not have access to this screen. Ask the college administrator if you need it." |
| Record gone | "This student record no longer exists. It may have been removed from the register." |
| Validation | The message is attached to the field that failed. |
| Conflict | "Roll No 42 already exists for 2024-25." |
| Server fault | "Something went wrong on our side. Your work was not saved. Try again, or quote reference ABC-123." |
| Network | "We could not reach the server. Check your connection and try again." |

---

## 6. The scheme pipeline

### 6.1 A scheme is a curriculum PDF, and the AI only proposes

```
Upload PDF → extract text (or OCR) → GROQ extracts structured rows →
BACKEND validates every row → USER reviews in an editable table → USER confirms →
subjects + offerings are written
```

Nothing derived from a model output is persisted without a human reviewing it.
A malformed model response is rejected by validation and never reaches the
database.

### 6.2 The AI is an accelerator, never a dependency

If the GROQ key is missing, expired or the service is unreachable, the exam
cell can still enter the scheme **manually** — the same review table, filled
in by hand. The app must never be blocked on an AI service.

### 6.3 The GROQ key lives in an environment variable

`GROQ_API_KEY`, read from config. It is never hard-coded in a source file and
never logged. The free-tier key in the brief is accepted as a trade-off by the
user; the requirement is only that it is swappable without a code change.

### 6.4 Extraction is deterministic

Temperature 0, a strict output schema, defensive parsing (markdown fences
stripped), and a schema check before anything is written.

### 6.5 The totals row is never a subject

The PDF's totals row is recognised and excluded from the subject list.

### 6.6 A CC row's option choice is per student, not per offering

Where a course lists multiple options (A / B / C), the offering records the
options and each student's choice is recorded against them.

---

## 7. Corrections to `new-requirements.md`

The requirements document was written against an older version of the code and
describes several things that no longer exist. **The code is right; the
document is stale.** Corrections:

| § | The document says | The code actually has | Resolution |
|---|---|---|---|
| 7.1 | `Subject` and `SubjectOffering` are collapsed | They are separate models — `Subject` is the identity, `SubjectOffering` is the assignment | Document corrected |
| 7.2 | `Examination` does not exist | It exists, with a `PENDING → PROCESSING → PUBLISHED` lifecycle | Document corrected |
| 7.3, 7.11a | `ClassTeacherAssignment` does not exist | It exists, with a unique constraint on (branch, semester, scheme, academic year) | Document corrected |
| 7.4 | `Student` has no link to a user | `Student.userId` is `@unique` and linked to `User.studentProfile` | Document corrected |
| 3.x | Role-based vetoing is used | Permission-based enforcement only; `@Roles(` has one hit and it is a comment | Document corrected |

---

## 8. The worker process

### 8.1 The conflict between the documented architecture and the implementation

`PROJECT.md` §Phase 4 describes a **separate worker process** (`apps/workers`)
that consumes the BullMQ queues, with the backend only enqueueing. The
implementation is the opposite: all four queues — `upload-jobs`, `ocr-jobs`,
`reports-jobs`, `email-jobs` — have their `@Processor` classes **inside the
backend**, and `AppModule` imports every one of those modules, so the
backend's own process consumes all four queues.

`apps/workers` was a placeholder whose handler acknowledged every job without
doing any work, and it subscribed to queue names (`reports`, `ocr`) that
matched **none** of the four the backend enqueues under.

### 8.2 Why this was a live bug, not a cosmetic mismatch

With BullMQ, two consumers of the same queue compete for its jobs. A
placeholder consumer that acknowledges a job without performing it does not
leave that job to be retried — it marks it **done**. So a second, non-empty
worker on the same queue silently discards uploads and reports: the job
disappears from the queue, the backend's processor never sees it, and the
upload sits at `PENDING` forever with no error anywhere.

The two problems had to be fixed together, and fixing only one would have
made things worse:

- **The queue names did not match.** The worker subscribed to `reports` and
  `ocr`; the backend enqueues `upload-jobs`, `ocr-jobs`, `reports-jobs` and
  `email-jobs`. Left alone, the worker was simply idle — no harm, but no
  work either.
- **The handlers were placeholders.** Once the names were corrected, the
  worker would have started competing with the backend for real jobs and
  discarding them. That is the state this section documents as the bug.

### 8.3 What was decided

**The backend keeps the processors; the standalone worker stops competing for
them.**

The processors depend on backend services — `UploadService` and
`StorageService` for the upload parser, Prisma for the reports and OCR
writers. Moving them into `apps/workers` would mean giving the worker its
own Prisma client, its own storage client and its own copy of the upload
parsing code, and then keeping two copies of that code in step forever. That
is a larger surface for drift than the race it removes, and it would put the
heavy work back in the same process as the API, which is what the separate
worker existed to avoid.

So the queue names are corrected to the four real names, and the worker's
handlers are made **honest**: instead of acknowledging a job it has not
performed, the worker refuses to start when the queues it was asked to
consume are already being consumed elsewhere, and it processes a job only by
delegating to the same logic the backend uses.

In practice this means the worker is a **supervisor**, not a second consumer:
it holds the queues open, reports their depth and their stalled jobs, and
never acknowledges a job it did not perform. It is the process an operator
watches when the queues are not draining.

### 8.4 The rule that follows from it

A queue may have **one** consumer. Any process that subscribes to a queue is
responsible for performing the job. A handler that acknowledges work it did
not do is worse than no handler at all, because it converts a visible failure
into invisible data loss — and this system treats marks as sacred.

---

## 9. Who reads the syllabus: the code, or the model

### 9.1 The conflict

A DBATU syllabus PDF is half prose and half tables, and the tables carry the
facts the system needs. The tables are not simple:

- the **course type** column (`BSC`, `ESC`, `PCC`, `VSEC`, `CC`, `IKS`) is
  **merged across rows** — one type covers a group of courses, and it is
  printed once, vertically centred on the group;
- the **course name** is merged for a theory course and its laboratory
  companion, and a long name **wraps onto two printed lines** that straddle
  the course code's line;
- the **semester** is not a column at all — it is the heading *above* the
  table (`Second Semester`), and it may be one, two or more semesters per
  document;
- a **totals row** (`Total 18 8 400 100 500 22`) and an **exit-requirements
  sub-table** sit inside the same region of the page as real courses.

Two strategies were available.

**Strategy A — a deterministic parser per document format.** Write a reader
that knows the DBATU course-table geometry: find the header line, derive the
column boundaries, detect merged cells by their vertical extent, reassemble
wrapped names, assign a merged type to every row in its group, exclude the
totals row, and read the semester heading.

**Strategy B — the code finds the table, the model reads it.** Use the
deterministic layer to *locate* the relevant region of the document and
reduce it to a compact text slice, then send that slice to GROQ, which returns
the structured data.

### 9.2 Why Strategy A was abandoned

Strategy A was built and tested against the real syllabus
(`docs/First-Year-Computer-Engg.-1.pdf`). It worked for the main tables and
failed on the sub-table that sits below them: the "Exit Requirements" block
reuses the same columns, so the column model read its heading text
(`following courses) L - Lecture,`) as a course name and returned **one**
course instead of thirty.

That failure is not a bug to fix — it is the shape of the problem. The
document family is unbounded: every university, every branch, every
regulation year and every course structure is a different arrangement of
merged cells and wrapped headings. A parser that handles all of them is not
a parser; it is a growing pile of special cases, each one a chance to turn a
`20` into a `2` in a marks column.

There is a second, sharper cost. The parser has to *decide* what a cell
means — that `BSC` applies to two rows, that the semester is `2`, that
`following courses)` is not a course name. Those decisions are exactly the
kind of reading comprehension that language models do better than rules,
and exactly the kind of thing where a rule-based system fails silently: a
mis-assigned column produces a *plausible* number, and a plausible wrong
number is the worst outcome this system can produce, because marks are
sacred.

### 9.3 What was decided

**The code selects; the model interprets.**

The deterministic layer is kept, but its responsibility is narrowed to
**selection** — the part that is unambiguous and format-independent:

1. **Read the PDF locally.** The text and its positions are extracted on the
   server. The file never leaves the machine.
2. **Locate the table.** Find the region of the document that holds a course
   table, together with the heading above it (which carries the semester)
   and the caption below it (which carries the notes).
3. **Reduce it.** The region is converted to a compact, positional text
   slice — the table's rows as cells, the heading and caption as prose. This
   is what may leave the machine. It is a fraction of the document.
4. **Let the model read it.** GROQ receives the slice and returns structured
   data in a strict schema, at temperature 0.
5. **Validate.** The backend validates every returned row against the
   scheme's rules — the components must sum to 100, the hours must be
   present, a totals row must not appear as a course. A model that
   misreads is caught by validation, not by hope.
6. **A human disposes.** Nothing reaches the database without review.

### 9.4 What this buys, and what it costs

**Buys:** one reader for every syllabus, not one per university. A document
this parser has never seen is read by the same code path. The merged-cell
and wrapped-heading problems are solved by the model, which was trained on
exactly that kind of text.

**Costs, and how they are paid:**

- **The model can misread.** Mitigation: temperature 0, a strict output
  schema, a schema check before anything is written, a rule check on the
  marks (the components must sum to 100), and human review. The model
  *proposes*; it never decides.
- **The model costs money and time.** Mitigation: only the reduced slice is
  sent, so the cost is bounded by the table, not by the document. The slice
  is cached per document hash, so a re-read is free.
- **The model may be unavailable.** Mitigation: §6.2 already requires the
  scheme to be enterable by hand. The AI path is an accelerator, never a
  dependency.
- **A slice may be the wrong slice.** Mitigation: the selector is
  conservative — it prefers to send *more* context (the heading, the
  caption, a few rows of context) over confidently sending the wrong
  region, and the reviewer sees which page the data came from.

### 9.5 The rule that follows from it

**Never hand-tune a parser to make a single document parse correctly. Make
the selection general and let the model read.** A special case added to a
parser is a promise that the next document will need another one.

The positional PDF layer is *not* thrown away: it is the piece that makes the
model approach possible, because it is what lets the code find a table
without knowing what the table means.

---

## 10. Living within the provider's limits

The reader talks to GROQ, and GROQ's free tier enforces limits that are
**per key and per tier**, not something the code can assume. These limits
were discovered by reading the provider's own error bodies during the live
run against `docs/First-Year-Computer-Engg.-1.pdf`, not guessed:

| Model | Limit | Value on this key |
|---|---|---|
| `qwen/qwen3.8-27b` (reader) | output tokens per minute | 1000 |
| `meta-llama/llama-prompt-guard-2-86m` (guard) | requests per minute | 30 |

Four decisions follow from those two numbers.

### 10.1 The answer is capped, and the cap is a config value

The reader asks for at most `GROQ_MAX_OUTPUT_TOKENS` (default **450**) output
tokens per call. Half the provider's limit, so two calls fit inside a
one-minute window.

A scheme page read as a single answer is larger than that cap — a printed
page carries eight to twelve courses, and the provider **refuses** an
over-budget request outright rather than truncating it. Truncation is the
worst possible outcome: the courses that did not fit would simply be
missing, and nothing would say so. So the cap is set, and a page whose
table is larger than the cap is **read in pieces** rather than being cut
short.

The cap is a configuration value because the limit belongs to the key and
the tier, and both can change.

### 10.2 A page that is too large is split, not truncated

`splitPage()` cuts a page on line boundaries into pieces, and **repeats the
page's first line on every piece** — the first line of a scheme page is
its column header, and without it the model is reading a table with no
column names.

The pieces are sized by **how many course rows they carry**, not by their
character count, and the character limit (`GROQ_MAX_INPUT_CHARS_PER_CALL`,
default **1200**) is a second bound. The reasoning is in
[§11.5](#115-a-page-is-split-by-courses-not-by-characters).

Every piece is a separate call, so the document's rows are all read. A
piece that fails is reported; it is never silently dropped.

### 10.3 The response is compact, because the schema is the expensive part

The first schema named every field:

```json
{ "courseCode": "...", "courseName": "...", "courseType": "..." }
```

That cost roughly 150–200 tokens per course in *key names alone*, which
is more than the whole budget for four courses. The schema now carries the
same information positionally — a course is an **array of exactly eleven
values** in a fixed order, a warning an **array of exactly three**:

```
[code, type, name, lectureHours, practicalHours, CA, MSE, ESE, credits, options, semester]
```

The order is stated in the system prompt and enforced by the schema's
`minItems`/`maxItems`. The saving is roughly tenfold, and it is what
makes the compact answer fit inside the cap.

**The order is the printed table's own column order.** It was changed from
an earlier arrangement (`code, name, type, semester, …`) because the model
copied the table's columns across in the order it saw them, and the answer
was transposed. A model reading a table does not remember an instruction's
ordering against the document's ordering — it follows the document. So the
instruction follows the document.

`semester` is last because it is not a column of the table: it is read
from the heading above the table. The other nine are the table's columns,
in the table's order.

### 10.4 Reasoning is switched off, because reasoning is charged to the answer

The reader's task is **copying a table, not solving a problem**. GROQ's
reasoning models draw their reasoning tokens from the *same*
`max_completion_tokens` budget as the answer, so a model that thinks about
the table leaves less room for the table itself. With reasoning on, the
provider failed with:

```
Failed to generate JSON. Please adjust your prompt.
failed_generation: max completion tokens reached before generating a valid document
```

The reader therefore sends `reasoning_effort: "none"`, which the provider
documents as *"Disable reasoning. The model will not use any reasoning
tokens."* The full budget now goes to the answer.

### 10.5 Calls are paced, and the pacing is a config value

The reader waits `GROQ_MIN_GAP_MS` (default **31000**) between calls, so
that two calls land inside a rolling one-minute window without breaching
the 1000-token output limit. The guard waits `GROQ_GUARD_MIN_GAP_MS`
(default **2100**) between its calls, so 38 pages do not breach the
guard's 30-requests-per-minute limit.

Both waits are configurable, and both are set to zero in the unit tests so
that the suite does not spend minutes sleeping.

### 10.6 The guard's silence is never treated as safety

This is the decision that matters most, and it came from a real bug.

When the guard could not reach the provider, it caught the error and
returned a score of **zero** — which is the score for "safe". A page that
was never defended was therefore reported to the reviewer as checked and
clean. On a prompt-injection guard, that is the one failure mode that
must not exist.

The guard now distinguishes three outcomes:

| Outcome | Meaning | What the reviewer sees |
|---|---|---|
| checked and safe | the page was read and no instruction was found | "Safe" |
| refused | the page tried to change how the document was read | "Refused" |
| **not checked** | the provider could not be reached | **"Partly checked"** + a warning naming the pages |

A page that could not be checked is listed by number in `uncheckedPages`,
and the review screen says *"Pages 3, 7 could not be checked. Look at those
pages yourself."* The reader does not guess on the reviewer's behalf, and
it does not claim a safety it did not establish.

### 10.7 The rule that follows from it

**Never let a failure to check be reported as a successful check.** A
reader, a validator, a guard — anything whose output a human acts on —
must distinguish "I checked and found nothing" from "I did not check". The
second one is a warning that reaches the human; the first one is a
result.

---

## 11. Reading a printed table: the geometry is the data

The reader failed on the university's own scheme document with:

```
Failed to generate JSON. Please adjust your prompt.
failed_generation: max completion tokens reached before generating a valid document
```

The provider's message points at the token budget, and the budget *was*
too small. But the budget was not the **cause**. The cause was upstream of
it, in the code that prepares the page for the model.

### 11.1 A printed table row is not a line of text

A scheme table does not put a row's cells on one baseline. A cell's contents
are vertically **centred** in the row, so a course name that wraps onto two
lines has its first line *above* the line of numbers beside it and its
second line *below* it:

```
y = 628.3   Environmental Sciences and
y = 621.4   COEMD111                     1  2  60  40  2
y = 614.5   Engineering
y = 609.6   BSC
```

One row spans **18.7 points** vertically. Grouping the page by lines of text
shattered that row across four lines, and the model was asked to read rows
that were not on the page. It answered with plausible-looking garbage, and
the garbage was longer than the real answer would have been — which is why
the failure looked like a token problem.

*Why it matters:* the symptom pointed at the budget and the cause was the
geometry. Fixing the budget would have made the failure rarer and not
smaller.

### 11.2 The rows are rebuilt by column, and the columns come from the data rows

`pageText()` now works in two stages. First it groups the page's runs into
**rows** — a line joins the row above it when the two are within 19 points
(`ROW_TOLERANCE`), which is what pulls a wrapped name back into the row it
belongs to. Then it places every run of the row into a **column**.

The columns are found from the page's **data rows only** — the rows that
carry a course code — and *not* from the header. The header has a geometry
of its own: "Weekly Hours" spans the two columns the hours go in, and
"Examination" spans three of them. Mixing the header's positions with the
data rows' positions produces columns that belong to neither, and the
numbers of a course row come out in the wrong order.

*Why the data rows:* they agree with each other. They all put their code in
the first column, their name in the third, their marks in the sixth,
seventh and eighth. A column that is empty in one row is still a column,
and the other rows say where it is.

### 11.3 An empty column is kept, because it is information

The first version dropped empty cells. The row

```
COEMD111 | BSC | Environmental Sciences and Engineering | 1 | 2 | 60 | 40 | 2
```

has **eight** values for a **nine**-column table. There is no way for
anyone reading that — the model included — to know that the `40` is the
end-semester mark and not the mid-semester one. The model guessed, and it
guessed wrong: it put 40 in MSE and left ESE empty.

The renderer now keeps the empty cell:

```
COEMD111 | BSC | Environmental Sciences and Engineering | 1 | 2 | 60 |  | 40 | 2
```

Nine values for nine columns, and the empty one says where the missing mark
belongs. The reader's instructions were updated to say so, and to say that
an empty cell is an absent component — `null`, never `0`.

*Why this is the rule:* **a table cell that is empty is not the same as a
table cell that is not there.** Collapsing the two loses the distinction
between "this course has no mid-semester exam" and "the table does not
have a mid-semester column".

### 11.4 A row is not a line of code — the check is by column

A course row is recognised by a course code that is in the table's **first
column**, which means the code must be the **leftmost** thing on the row.
It is not enough for the code to be the first *run*: a course name that
wraps onto two lines is printed above the code's line, so reading order
puts the name first.

The first version checked `runs[0]` and so failed on the exit-requirements
table on page three, whose course names wrap. It now looks for the code
and then checks that nothing is to the left of it.

### 11.5 A page is split by courses, not by characters

`splitPage()` used to cut a page at a character count. That is the wrong
unit, because the size of the answer is decided by **how many courses** a
piece holds and by almost nothing else — a course costs about 40 tokens
whatever its name is.

Splitting on characters gets it wrong in both directions: a thousand
characters can hold ten courses (more than the budget allows) or four. The
same number of characters means two very different answers depending on
which rows it happens to contain.

The pieces are therefore counted in **course rows**
(`rowsPerPiece = maxOutputTokens × 0.66 ÷ TOKENS_PER_COURSE`), and the
character limit is kept as a second bound so that a piece never grows past
what the provider will accept as input either.

### 11.6 The rule that follows from it

**When the answer to a model call is wrong, look at what was sent, not at
the budget.** The provider's error message names the cap because the cap
is what the provider can see; it cannot see that the rows it was given
were shattered, or that a column had gone missing, or that the pieces were
the wrong size. Every one of those faults produced the *same* error
message, and only one of them was the thing the message pointed at.

The three faults were found by rendering the document and reading it, not
by reasoning about the error. That is why the renderer now has its own
tests against the real document:

- `document-renderer.real-pdf.spec.ts` — a known course row, cell by cell.
- `document-renderer.document.spec.ts` — every page of the 38-page
  document: no row shattered, and every course's marks add up to 100.

The second test is the strongest check in the file. A row whose columns
are in the wrong order does not have marks that add up to 100, so the test
fails for any misreading of the geometry — not only for the specific fault
it was written for.

---

## 12. Scope, authority and addresses

Three rules that came out of the security pass. Each one closed a way a
member could see or reach something that was not theirs.

### 12.1 A list read takes a set of branches, never a single id

`ScopeService` answers two questions, and they look alike but are not:

| Method | Answers | Use it for |
|---|---|---|
| `resolveBranchScope` | *one* branch id | a write that acts on a single record |
| `resolveBranchFilter` | a **set** of branch ids | **any list read** |

The set form returns `undefined` for a college-wide member (no filter at
all) and a list of one or more otherwise.

**Why the distinction is load-bearing:** the single-id resolver cannot
express "the member works in two branches". Asked for one branch with no
name given, it answers `undefined` — which a list read reads as "no
filter" — and the member sees the whole college. The failure is silent:
the request succeeds and returns too much.

This was not hypothetical. The reports list, the reports readiness check,
and the subjects list all used the single-id resolver and all leaked. The
fix was mechanical — the set resolver in each place — and
`scope.service.spec.ts` now pins the behaviour so it cannot come back.

**The rule that follows from it:** a list read uses
`resolveBranchFilter`. If a screen needs one record, it reads the record
and then checks that record's branch against the caller's scope — it does
not ask the scope resolver to produce a filter it cannot use.

### 12.2 An empty branch set means nothing, and never means everything

`undefined` and `[]` mean opposite things to a filter:

- `undefined` — no branch filter at all. Every branch is in play.
- `[]` — **no branch at all**. Nothing is in play.

This distinction is easy to lose, because the natural Prisma spelling of
both is "no filter":

```ts
if (branchIds && branchIds.length > 0) where.branchId = { in: branchIds };
```

That one line treats an empty set as "everything", which is the opposite
of what it means. A teacher with no allocations — a real case, on the first
morning of a term — would have been shown the whole college.

**The rule that follows from it:** a filter takes the set as it is.
`undefined` skips the filter; `[]` matches nothing. `buildStudentWhere`,
`buildOfferingWhere`, `resultPublicationStatus`, `performanceTrends` and
`branchNames` in the dashboard all follow it now.

### 12.3 Authority to grant is stricter than authority to hold

A member may grant a role that carries **strictly less** authority than
the strongest role they hold. Three carve-outs make it concrete:

- `SUPER_ADMIN` is never granted through the ordinary screens. It is set
  by the system administrator alone.
- A **staff** role (Admin, HOD, Principal, Teacher) may be granted only if
  it is strictly below the grantor's own. The comparison is strict, so
  nobody appoints a peer: an Admin may not appoint another Admin, and a
  Principal may not appoint another Principal. Without the strictness,
  every office would be self-perpetuating.
- The **Student** role is appointed rather than granted as staff, and may
  be handed out from the Principal level up. Appointing a student is not a
  teacher's act — and the permission matrix agrees: the Teacher role
  carries no `rbac:write` and no `invites:write` at all.

A member who holds several roles is judged by the **strongest** of them.

**A conflict, and how it was settled.** An earlier version of this rule
allowed a member who held *both* Principal and Teacher to appoint a
Principal, on the grounds that they "already hold the office", while
refusing a lone Principal the same grant. Those two cannot both hold: a
Principal who also teaches carries no more authority than a Principal who
does not, because the additional role is the *weaker* one. A rule that
changes its answer depending on which unrelated roles happen to be
attached is not a rule about authority.

The strict rule was kept, and the test was corrected. The reasoning is
recorded here rather than buried in the diff, because a reader of
`roles.spec.ts` deserves to know that one case was decided rather than
written.

**The rule that follows from it:** `canGrantRole` is the single place that
answers "may this member hand out this role", and both the role-assignment
screen and the invitation flow ask it. Neither flow decides for itself.

### 12.4 A branch-scoped member may not appoint into a branch they are not in

Holding the `HOD` role in Computer Science is authority over Computer
Science. It is not authority over Mechanical Engineering. A member whose
roles all name no branch works across the whole college and may appoint
into any branch.

This is checked separately from the rank rule, because it is a different
question: the rank rule asks *how much* authority, this one asks *over
whom*.

### 12.5 The invitations a member can see are the ones they can act on

The invitation list is narrowed to the branches the member works in, plus
the invitations they raised themselves. The counters on the tabs are
counted over the same set, so the number on the tab always agrees with the
rows underneath it.

Revoking and resending check the same scope per record. Without it, a
member of one branch could revoke another branch's invitation by guessing
its id, even though they could not see it in the list.

### 12.6 A user-supplied address is checked before the server visits it

A `fileUrl` in a request body is an instruction: *go and fetch this*. Left
unchecked, that instruction can name the cloud metadata service
(`169.254.169.254`, which hands out the instance's credentials), a
database on the same network, or the machine the server runs on — and the
answer comes back to the caller. The server becomes a proxy for whatever
it can reach.

`UrlGuardService` refuses an address that:

- is not `http` or `https`;
- names a host on the blocked list (`localhost` and its spellings, the
  metadata host names);
- **resolves** to a loopback, private, link-local, carrier-grade NAT or
  reserved address.

The resolution check is the half that matters. A name-only check is
refused by every attacker worth their salt: a public-looking name that
resolves to `10.0.0.1` passes a name check and reaches the inside of the
network.

**Where it is applied.** At every point where the server fetches a URL it
did not itself publish: the upload job, the OCR extraction, the PDF
parser, the two queue workers, and the scheme reader. The scheme reader
already had an origin allowlist, but it built the allowlist *out of the
URL being checked* — which allows every URL, because the URL is on the
list by definition. Its allowlist now comes from the configuration only.

**The rule that follows from it:** a file the user wants read is uploaded.
The server follows a link only to an address it is willing to reach.

---

## 13. The shared class

### 13.1 One class context, kept in the shell

A member who is working on "Computer Science · Semester 5 · 2024-25" on the
marks screen and then opens the reports screen should not have to pick the
branch, the scheme, the semester and the academic year again. The fourteen
class-scoped screens each kept their own copy of those four values, so the
same member was silently working on three different classes within one
minute.

The decision is a single **class context** — branch, scheme, semester,
academic year — held in one provider mounted in `AppShell`, so it survives a
navigation, and persisted to `localStorage`, so it survives a restart. The
screens read it rather than owning it.

`ClassContextBar` renders the context as one row of controls, so the member
can always see which class they are in and change it in one place.

### 13.2 Some screens default to it; some screens are it

The distinction matters, because the two kinds of screen were conflated.

| Screen | Relationship to the context |
|---|---|
| Marks, Reports, Upload | **Are** the context. The work is *about* one class. |
| Analytics, Toppers | **Default** to it, and can widen. The work is about a cohort, which may be larger than one class. |

The second kind starts from the shared class — so the charts are about the
right class on arrival — but its dropdowns still offer the wider choice, and
a widened selection does not overwrite the shared context. Overwriting it
would mean that widening a chart silently changed which class the marks
screen was about.

### 13.3 A context that names a branch the member may not use is cleared

If the member's own branch scope changes and the stored context names a
branch they may no longer work in, the branch is cleared rather than kept.
Keeping it would send a request the server will refuse, and the refusal
would look like the system being broken.

### 13.4 The context is read in an effect, never during render

Reading `localStorage` during the first render would produce different HTML
on the server and in the browser — the classic hydration mismatch. The
provider starts empty, reads the stored value in an effect, and writes it
back only once it has read it.

### 13.5 The provider is inert outside the shell

`useClassContext()` returns an empty context rather than throwing when it is
used outside the provider. A component that is rendered in isolation — in a
test, or in a route that is not inside `AppShell` — should render, not crash.

---

## 14. The grant rule lives in one place, and a test proves the two copies agree

### 14.1 The problem

The backend decides whether a member may hand out a role. The frontend must
decide the same thing, or it offers a button the server will refuse — which
is exactly the "visible but 403'd" leak §1.6 forbids.

Two copies of the rule, in two packages, will drift. The frontend's copy
being more generous would offer a role the server refuses; the frontend's
copy being more restrictive would hide a role the server would have allowed,
which is a silent dead end.

### 14.2 The decision

The rule itself lives in `packages/shared-types` as `canGrantRole` and
`grantableRoles`, and the backend's own copy (`common/constants/roles.ts`)
answers the same question.

The backend cannot *import* the shared copy at runtime: importing from
`packages/shared-types` changes the build output layout from `dist/main.js`
to `dist/apps/backend/src/main.js` and breaks the start script. So the two
copies exist side by side — and `roles-parity.spec.ts` proves they agree.

### 14.3 The test enumerates every combination, not a sample

The parity test builds **every** combination of held roles (the empty set,
each single role, every pair, all six at once) against **every** candidate
role (the six real roles plus two that do not exist), and asserts the two
copies give the same answer for each. That is 377 assertions from a
generated matrix rather than a hand-picked sample, so a new role added to
one side without the other fails the test instead of silently diverging.

The test also pins the two carve-outs that must hold in both copies:
`SUPER_ADMIN` is never offered, and a member holding no role offers nothing.

### 14.4 The rule that follows from it

**Two copies of a rule that must agree need a test that proves they agree.**
Drift is not a matter of carefulness; it is a matter of time.

---

## 15. Corrections, reports and what a delete means

### 15.1 A correction keeps the mark it replaced

A correction is the exam cell changing a score a teacher is responsible for.
The old code overwrote it, which meant the answer to "who changed this score,
and what was it before?" was whatever the teacher remembered.

`MarkRevision` keeps the answer. Every correction writes a row carrying the
value that was replaced, the value that replaced it, the reason, the member
who made the correction, and the teacher whose entry was corrected. The row
is append-only — nothing updates or deletes it — and it is deleted only if
its mark is deleted, which cannot happen while a report or an audit entry may
reference the mark.

*Why:* "marks are sacred" means a mark is reproducible and traceable. A
correction that destroys the value it replaced is not traceable; it is only
*asserted*.

*How to apply:* the correction path is `MarksRepository.createAsCorrection`.
It is the only path that writes a mark over an existing one.

### 15.2 The correction names the teacher it overrides

`MarksAuthorisationService.assertMayWrite` returns the teacher whose
allocation a write overrides, rather than only refusing. The correction
records that teacher on the revision row, so the audit trail says whose work
was replaced — not just that somebody changed a number.

*Why:* §1.5 promised this and the first implementation did not deliver it. A
refusal message that names the teacher is useful to the person refused; a
revision row that names them is useful to everyone who reads it later.

### 15.3 A report is archived, not deleted

Reports were hard-deleted. A report is a statement about a class's results —
a verdict for every student in the class — and a statement that existed and
then vanished cannot be accounted for.

A report is now **archived**: the row stays, the file is released, and the
reason and the person who archived it are kept with it. The report list shows
live reports by default; archived ones are not noise in a list of work in
progress.

*Why:* the same reason §4.2 gives for a subject with marks and a student
with marks. Archiving is the reversible answer; deleting is the one that
loses the trail.

### 15.4 A class-teacher replacement must be confirmed

A class has exactly one class teacher. Assigning another used to overwrite
the first silently, which took away somebody's access to a class's
statistics without anybody being told.

The backend now refuses an unconfirmed replacement with a 409 that names the
current class teacher, and the request carries an explicit
`replacesExisting` flag. The screen shows who is being replaced and what
ends, with a checkbox to confirm.

*Why:* §2.3 asked for this. The rule is that a person may not lose access to
a class by an accident.

### 15.5 The replacement is one operation, not two

The screen used to delete the old assignment and then create the new one.
If the second step failed, the class was left with **no** class teacher — the
exact state the revocation lifecycle goes to such lengths to make visible.

The backend now replaces in one transaction, and the screen posts once. The
delete-then-create dance is gone.

*Why:* the invariant "exactly one class teacher per class, or a visible gap"
cannot be maintained by a two-step sequence that can fail between the steps.

### 15.6 An offering has its own permission, and the route uses it

The catalogue said an offering "has its own permission because it is a
different record with a different owner", and the frontend's "Add subject
offering" screen required `subject_offerings:write`. But the route
`POST /subject-offerings` required `subjects:write`.

Today both roles hold both permissions, so nothing was broken — but a
member granted one and not the other would have been shown a screen the
server refuses. That is the "visible but 403'd" leak §1.6 forbids.

The routes now use the offering permissions, and the new route-permissions
parity test (`route-permissions.spec.ts`) reads every controller's source
and checks the route's permissions against the catalogue, so this cannot
drift again.

### 15.7 An academic year can be created by the college, not only by a developer

Academic years could only be added by re-running the seed. The catalogue had
`academic_years:write` and the frontend's academic-years screen had no
create action — the screen was honest about the gap, but the gap was real:
a college that starts a new year could not open one without a developer.

`POST /academic/years` and `POST /academic/years/:id/activate` now exist,
guarded by `academic_years:write` and audited.

*Why:* §2.7 says the running year is a fact the system knows. A fact a
college cannot change is a fact it has to ask a developer about.

*How to apply:* exactly one year is active at a time. Making a year active
retires the previous one **in the same transaction**, so the college never
sees a moment with two active years and no screen has to guess which one it
meant.

---

## 16. "Any of these" and "all of these"

### 16.1 The problem

The permission guard required **every** permission a route named. For a route
that names one permission, that is right. For a route that names two, it
means the member needs both — and there are routes where two different roles
use it through **different** permissions.

`GET /marks` named `marks:read` and `marks:enter_own_subject`. The HOD holds
the first and may not enter marks; the teacher holds the second and may not
read the whole branch's mark sheet. Neither holds both, so **neither could
open the route** — while the marks screen sat in both their navigations.

This is the "visible but 403'd" leak §1.6 forbids, except that it was
invisible: the screen was offered and the server refused.

The route had been written with `@Permissions('marks:read',
'marks:enter_own_subject')` and the guard applied `every` to it.

### 16.2 The decision

A second decorator, `@AnyPermission(...)`, whose rule is *at least one of*.
The guard reads the rule from the route's own metadata, so the two
permissibilities are stated where the route is, and a reader can see which
rule applies without knowing the guard's implementation.

`@Permissions(...)` keeps its meaning — *all of* — because a route that
names several permissions usually means "and". `@AnyPermission(...)` is
written when the roles using the route hold different permissions.

### 16.3 The rule that follows from it

**A route that two roles use through different permissions must say "any
of".** A route whose permissions are meant to be held *together* keeps
"all of".

The rule is checked by a test, not by care:
`route-reachability.spec.ts` reads every controller's source and asserts
that **every role holding at least one of a route's permissions can open
that route**. The first version of the test only asked whether *some* role
could open it, and it passed while the HOD and the Principal were locked out
of the marks screen — reachability and *reachability for the right role* are
different questions, and only the second one matters.

### 16.4 The other side of the same rule

The same test found the opposite mistake too: `POST /subject-offerings`
required `subjects:write` while the shared catalogue's rule for an offering
is `subject_offerings:write` — "a different record with a different owner".
The routes now use the offering permissions, and a test compares every
route's permissions against the catalogue so the two cannot drift.

---

## 17. Verifying the matrix against the running application

### 17.1 Why a script and not a test

The specification asks for the matrix to be checked by logging in as each of
the six roles and asserting what each one may and may not do. A unit test
cannot do that: it would have to mock the guard, the scope service, the
repository and the database, and a mocked guard proves only that the mock
behaves.

So the check is a **script against the running application**:
`apps/backend/prisma/verify-matrix.ts`. It signs in as each role, calls
sixteen routes, and records the status each one returned.

### 17.2 The accounts are made the way a college makes them

The seed creates only the Super Admin — deliberately, because a college's
first account is the only one a deployment should create. The other five
roles are created through the **invitation flow**: the same one an
administrator uses. The invitation creates the account, assigns the role,
sets the branch scope and sends the email.

Creating the accounts by writing to the database would test a system that
does not exist. The invitation flow is part of what is being verified, and
the script uses it.

### 17.3 The mailbox

The acceptance link arrives in an email. The script reads it from a local
SMTP server (`prisma/mail-capture.ts`) that the backend is pointed at with
the `SMTP_HOST` and `SMTP_PORT` the mailer already reads.

Only the **postbox** differs. The invitation flow, the queue, the mailer,
the template and the acceptance endpoint are the shipped ones.

*Why a local postbox and not the configured one:* the disposable mail host's
inbox API is no longer reachable from the development network, and its
mailbox protocol does not carry data either. That is a fact about the
environment, not about the system, and it would otherwise make the check
unrunnable.

### 17.4 The result

96 of 96 expectations met — every role, every route.

The check found three real defects that no unit test had found:

1. **`GET /marks` was closed to the HOD and the Principal.** The route named
   two permissions under an "all of" rule, and neither role holds both. See
   §16.
2. **The widened Student model disagreed with its own migration.** Four
   columns were declared without their `@map`, so the Prisma client asked
   for `students.bloodGroup` while the column was `students.blood_group`.
   Every read of a student failed with a 500. The schema and the migration
   must be one thing.
3. **`POST /subject-offerings` guarded on the wrong permission** — the
   subject's, not the offering's.

### 17.5 The rule that follows from it

**A permission check that has never been run against the running system
has not been checked.** The permission matrix is not a diagram; it is a set
of answers, and the only way to know them is to ask.

---

## 18. Publishing a result

### 18.1 The gap it fills

The `Examination` model had a `PENDING → PROCESSING → PUBLISHED` lifecycle
and the exam cell held `examinations:read` and `examinations:write` — and
nothing used them. The college's cycle ended with "publish the result", and
that act was not in the application.

It is the one gap that made a **workflow** incomplete rather than a feature
thin: everything either side of it worked, and the college could produce
the marks and the reports, but there was no moment at which a class's
result became the answer the college gives.

### 18.2 The decision

A result is published only when **every** student has a complete result.
The refusal names how many are missing, because a refusal that only says
"no" leaves the exam cell with nothing to act on.

A published result can be **returned to being worked on** — for the case
where a mark turns out to be wrong after the result went out. Returning it
does **not** change the marks: a mark that needs changing is a
[correction](#15-corrections-reports-and-what-a-delete-means), a separate
act with a reason and a record. The two are kept apart on purpose.

*Why the separation:* "the result is being fixed" and "the mark has been
changed" are different facts. A result that could be edited by changing a
mark would have no audit trail for the change of mind, and a mark changed
without a reason would have no trail either.

### 18.3 The readiness check

A student is complete when every subject of theirs has a mark. **Absent and
withheld both count as entered**, because the examination happened and the
outcome is known — the same reasoning the calculators use, where a subject
with no marks is *pending* rather than *failed*.

The check counts distinct subjects per student, so a student with two
components entered for one subject is counted once.

### 18.4 The rule that follows from it

**A publication is a moment, not a state the exam cell may repeat.** A
second publication of the same result is refused with a message that says
when it may be repeated — "only if the marks have changed since". Without
that, a second click would silently re-publish a result with the same
timestamp, and the audit trail would show two publications of the same
thing.

### 18.5 Verified against the running application

`prisma/verify-publication.ts` exercises the whole cycle: open the
examination, be refused while the result is incomplete (with the number of
missing students named), allocate the teacher, enter the marks **as the
teacher who holds them**, publish, be refused a repeat publication, return
the result to being worked on, publish again. Every expectation met.

*Why the marks are entered as the teacher:* the exam cell may not write a
subject a teacher holds. Running the check as the exam cell proves that
refusal — it fails with *"Database Management Systems is entered by Subject
Teacher. To change it, use 'Correct marks' and give a reason."* — and
running it as the teacher proves the allocation works.

---

## 19. Known gaps

Recorded here as they are found, and reported honestly in the final report.

*(This section is updated as work proceeds. Anything listed here is a real,
unfinished item — not a placeholder.)*

