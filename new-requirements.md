# Result Analysis System — Requirements

**Source of truth:** this document. Where the implementation disagrees with this
document, this document wins and the implementation is wrong.

**Scope:** one college. Multi-college / tenant isolation is explicitly out of
scope — do not build for it.

**Audience:** the end users of the college — Super Admin, Exam Cell Admin, HOD,
Principal, Teachers, Class Teacher, Students. Not developers. Every capability
in this document must be reachable through the UI, not only through an API.

---

## 1. Purpose

A platform to manage a college's complete student data and result analysis:
students, subjects, marks, results, analytics, and reporting.

---

## 2. Academic hierarchy

The college's structure, top to bottom:

```
College
└── Branch                     (CS, ME, CE, EE, ENT — BTech)
    └── Year                   (1st year, 2nd year, 3rd year, 4th year)
        └── Semester           (1–2 per year; systems run on semester)
            └── Examination    (one per semester)
                └── Subjects   (the subject list for that semester)
```

**Terminology — use "semester" as the operating unit.** Systems are commonly
spoken of in terms of year, but every academic operation — subject assignment,
marks entry, examination, result computation — runs per **semester**. Year is
a grouping above it.

**Subjects are assigned per semester, not created fresh each time.** A subject
code (`CS301`) is a single entity; its *assignment* to a particular
semester/branch/scheme is what makes it appear in that semester's list.

**Consequence for the data model:** a subject must NOT be duplicated as a new
row per semester. There are two distinct concepts:

| Concept | Meaning | Repeats per semester? |
|---|---|---|
| **Subject** | The subject identity — code, name, credits, max marks, component breakdown | No — one row per subject |
| **Subject offering** | Subject X is offered in Branch CS, Semester 5, Scheme 2024, Year 3 | Yes — one row per offering |

The current schema collapses these into one (`Subject` carries `branchId`,
`semester`, `year`, `schemeId`), which forces a subject to be re-created for
every branch/semester/scheme it appears in. This must be split.

**"Class" = a semester** — i.e. the set of students in a branch studying a
given semester under a given scheme. A class has **exactly one class teacher**.

---

## 3. Roles and responsibilities

### 3.1 The principle

**The app is driven by permissions, not by role.** Roles exist only as bundles
of permissions that can be assigned. A person may hold several roles at once
(e.g. an HOD who also teaches a subject and is also a class teacher). The
effective capability set of every user is the union of the permissions granted
through all of their role assignments.

Therefore: no feature may be gated on a hard-coded role name. Every check is a
permission check. Role names are only labels for permission bundles.

### 3.2 Super Admin

The college's onboarding and governance owner. **View-only on academic data.**

| Can | Cannot |
|---|---|
| Invite users, configure roles and permissions, deactivate/remove members | Create, edit or delete students |
| **Create and manage branches** | Create, edit or delete subjects |
| **Create and manage academic years** | Enter, edit or delete marks |
| Configure schemes (pass rules) | Upload marks |
| View **all** data across the whole college | Generate academic data |
| See a college-wide dashboard | |

**Super Admin's dashboard is the exception.** It is not a generic summary — it
shows the administrative and academic-health metrics that matter for running
the college: total students, students per branch, students per semester,
subjects per branch/semester, marks uploaded vs. pending, pass percentage
across the college, toppers per branch, departments with missing data, and the
status of each semester's result publication. Because Super Admin has no
branch scope, this dashboard aggregates the entire college, not one class.

**Super Admin does not edit student or marks data.** Someone with the
permission does that; Super Admin only supervises, onboards people, and
configures the college's academic skeleton (branches, years, schemes).

### 3.3 Admin (Exam Cell)

The exam cell owns admissions of academic data into the system and the student
roster. **The only role that adds students.**

| Can | Cannot |
|---|---|
| **Create students** (single + bulk) | Manage branches, years, schemes |
| **Create subjects and their details** — subject code, name, credits, total/max marks, component breakdown (e.g. a 75-mark paper), passing marks, semester and branch assignment | Enter actual marks |
| Edit subject metadata and offerings | Configure roles or permissions |
| Enter marks (upload CSV / PDF / image-PDF, or manual entry) | Invite users |
| Generate reports, run analytics, publish results | Manage members |
| View branches, years, subjects | |

**Key distinction — the subject is a template, not a result.** The exam cell
defines *what a subject is worth* (max marks, credits, component split like
CA1 20 + CA2 20 + Mid-Sem 30 + Written 75, passing marks). The **teacher**
then fills in *what each student scored* against that template. The exam cell
never writes a student's score.

### 3.4 HOD

Mostly a **reader**. A person holding the HOD role may simultaneously hold
teaching or class-teacher duties, which is why permissions — not roles — decide
what they can do.

| Can | Cannot |
|---|---|
| View all data for their branch | Edit marks (unless also granted a marks-writing permission) |
| View branch analytics, toppers, pass-fail | Create students |
| Manage subjects for their branch | Invite users or configure permissions |
| Manage students for their branch | Change the college's structure |
| **Assign subjects to teachers of their branch** | |
| **Assign the class teacher for each class in their branch** | |

**Each branch has its own HOD.** There is one HOD per branch — the CS branch
has its HOD, the ME branch has its own, and so on. The HOD role is therefore
always **branch-scoped**: an HOD sees and manages their own branch only, never
another branch's.

**The HOD allocates the branch's teaching staff.** Two assignments, both made
by the HOD, both scoped to their own branch:

1. **Subject assignment** — which teacher teaches which subject in which
   semester.
2. **Class teacher assignment** — who is the class teacher for each class
   (branch + semester + scheme + academic year). Exactly one per class.

Both are assignments the HOD makes to teachers already onboarded by the Super
Admin, for subjects already created by the Exam Cell. The HOD does not create
teachers or subjects — only allocates the ones that exist.

Because the two duties are separate, they are separate permissions: granting
one does not grant the other.

### 3.5 Principal

**Read-only, statistical.** The principal's job is to see progress and status —
nothing else.

| Can | Cannot |
|---|---|
| View statistics, graphs, trends, pass-fail, toppers | Write anything at all |
| View college-wide analytics | Generate or edit academic data |
| Download reports | Manage users or structure |

The principal has **zero write permissions**.

### 3.6 Teacher

Two distinct kinds of teaching responsibility. Both are the same role; they
differ by which permissions/assignments are granted.

**(a) Subject Teacher** — teaches specific subjects.

- Enters marks for the subjects they are allocated to, and only those.
- Cannot enter marks for a subject they are not allocated to.
- Can view data for their subjects and their students.

**(b) Class Teacher** — exactly one per class (branch + semester + scheme +
academic year). May or may not also teach a subject.

- Views class-level statistics: class performance, percentages, who the
  toppers are, subject-wise toppers.
- Enters marks **only** for the subjects they are allocated to as a subject
  teacher. Being the class teacher does **not** by itself grant marks-entry
  rights.

**Both kinds require an explicit allocation.** A teacher with the role but no
subject allocation, and no class-teacher assignment, cannot enter any marks.
Both allocations are made by the HOD of that branch (§3.4).

### 3.7 Student

Minimal. Almost nothing.

| Can | Cannot |
|---|---|
| See **own** result only | See any other student |
| See **own** class's toppers on the toppers page | See college/branch analytics |
| See own marks | See anything administrative |

The student sees only their own marks and their class's toppers. Nothing
more.

---

## 4. Marks entry — the three ways

Marks arrive by **three input paths**, all required:

1. **CSV** — spreadsheet export from the exam system.
2. **PDF** — a text-layer PDF of the marks statement.
3. **Image PDF** — a scanned PDF requiring OCR.

All three converge on: upload → detect type → parse/extract → **review
extracted rows** → confirm → marks written. The review-and-confirm step is
mandatory; nothing is written without a human confirming the extraction.

Marks are written **per subject offering**, against the subject's template
(max marks, component breakdown, passing marks).

---

## 5. Screens the end user must have

The UI is the product. Every capability named above must be reachable by
clicking through the app.

| Screen | Purpose | Roles |
|---|---|---|
| Dashboard | Role-specific landing. Super Admin → college-wide metrics. Others → their scope's metrics. | All |
| Admin ▸ Branches | Create/edit branches | Super Admin |
| Admin ▸ Academic Years | Create/edit years | Super Admin |
| Admin ▸ Schemes | Pass rules per scheme | Super Admin |
| Admin ▸ Members | Invite, deactivate, assign roles + branch scope | Super Admin |
| Roles & Permissions | Configure the permission matrix and role bundles | Super Admin |
| Subjects | Subject catalogue + offerings per branch/semester/scheme | Admin (Exam Cell), HOD (own branch) |
| Assignments | Assign subjects to teachers; assign each class's class teacher | HOD (own branch) |
| Students | Add/edit students, single + bulk import | Admin (Exam Cell) |
| Upload Results | CSV / PDF / image-PDF entry | Admin, Teacher (allocated subjects) |
| Marks | Manual entry + review of entered marks | Teacher (allocated subjects), Admin, HOD |
| Reports | Generate/download result statements | Admin, HOD, Principal, Teacher (own) |
| Toppers | Subject-wise and class-wise toppers | Admin, HOD, Principal, Teacher, Student (own class only) |
| Analytics | Pass-fail, trends, subject difficulty, performance | Admin, HOD, Principal |
| My Result | Student's own result | Student |
| Class Overview | Class teacher's class stats + subject toppers | Class Teacher |

---

## 6. Permission model

**A permission is `resource:action`.** The app checks permissions, never role
names. Roles are presets that bundle permissions.

Resources that need permissions:

`branches`, `academic_years`, `schemes`, `subjects`, `subject_offerings`,
`students`, `marks`, `teacher_allocations`, `class_teacher_assignments`,
`reports`, `analytics`, `toppers`, `users`, `roles`, `permissions`, `invites`,
`audit`, `dashboard`.

Actions: `read`, `create`, `update`, `delete`, `publish`, `export`, plus
resource-specific ones such as `marks:enter_own_subject`,
`students:read_own`, `teacher_allocations:write` and
`class_teacher_assignments:write`.

**The two allocation permissions are separate on purpose.**
`teacher_allocations:write` lets an HOD give a subject to a teacher;
`class_teacher_assignments:write` lets an HOD decide a class's class teacher.
Granting one does not grant the other, so a college can, if it wants, let one
HOD allocate subjects while another handles class-teacher duties.

**Scope** is a property of the assignment, not the permission:

| Scope | Applies to | Means |
|---|---|---|
| College-wide | Super Admin, Principal | No branch filter applied |
| Branch | HOD, Teacher, Principal | Data filtered to the assigned branch |
| Class | Class Teacher | Data filtered to branch + semester + scheme + academic year |
| Own | Student | Data filtered to the student's own records |

**Who grants the allocation permissions.** The Super Admin sets the permission
matrix and grants permissions to roles and members — including granting an
Admin the right to allocate teaching staff, and granting an HOD the right to
allocate subjects and class teachers within their own branch. The Super Admin
does not make these allocations themselves; they delegate that to the roles
they have granted the permissions to.

---

## 7. Current implementation vs. this requirement

Differences found by reading the code, not by assumption.

### 7.1 Data model — subject/offering are collapsed

**Requirement:** Subject (identity) and subject offering (per semester) are
separate.

**Current:** `Subject` carries `branchId`, `semester`, `year`, `schemeId` with
`@@unique([code, schemeId, branchId])`. A subject offered in two branches, two
semesters, or two schemes must be **inserted again** as a separate row with
its own `id`. `Mark` then points at the offering-row, not at the subject, so
marks for the "same" subject live under different subject ids. `TeacherSubject`
allocations point at the offering-row too.

**Impact:** subject catalogue cannot be maintained as a single list; reports and
analytics that try to aggregate "DBMS across branches" join on a subject id
that is not shared.

**Needed:** split into `Subject` (code, name, credits, max marks, component
breakdown, passing marks) and `SubjectOffering` (subjectId, branchId,
semester, schemeId, academicYearId). `Mark`, `TeacherSubject` and `Teacher`'s
teaching load point at the offering.

### 7.2 There is no academic-year-per-semester examination entity

**Requirement:** each semester has an examination; results are published per
examination.

**Current:** `AcademicYear` exists (`"2024-25"`, start/end dates) and
`Student.semester` + `Student.currentYear` are plain integers. There is **no**
`Examination` model — no entity for "Semester 5 examination, branch CS, scheme
2024". `Report.type` has a `PASS_FAIL` and `COMPLETE` variant but nothing
tracks publication state per examination.

**Impact:** "result published" cannot be represented, so a student cannot be
told "your result is not declared yet" versus "you failed".

### 7.3 Class teacher is not modelled at all

**Requirement:** exactly one class teacher per class.

**Current:** no `ClassTeacher` assignment entity, no column, no relation. The
grep for `classTeacher` across the schema and the whole backend returns
nothing. `TeacherSubject` exists for subject allocation only.

**Impact:** the class teacher's class statistics, class toppers, and class-scoped
dashboard are unimplementable, and there is no way to enforce "one class
teacher per class".

### 7.4 Student has no link to a user account

**Requirement:** a student logs in and sees their own result.

**Current:** `Student` has no `userId`. `User` has no `students` relation. The
`STUDENT` role is assignable to a `User`, but there is no way to bind that
account to a `Student` row, so the backend cannot work out "whose result is
this" from a JWT.

**Impact:** student scoping is impossible to enforce. The `STUDENT` role's only
permission is `dashboard:read`, so the student can reach `/dashboard` and
nothing else — the student role's described behaviour is entirely unimplemented.

### 7.5 Student data access is not owner-scoped

**Requirement:** a student sees only their own marks.

**Current:** `GET /marks` requires only `marks:read` with **no** `@Roles` and
no owner check. `GET /students` requires only `students:read`. A student given
`marks:read` would receive **every student's** marks — the filters
(`studentId`, `subjectId`, `examType`, `academicYearId`) are caller-supplied and
optional.

**Impact:** granting a student read access to their own result would expose the
whole college's marks. Owner-scoping must be applied server-side based on the
authenticated user, not a request parameter.

### 7.6 Super Admin can currently edit academic data

**Requirement:** Super Admin is view-only on students, subjects and marks.

**Current:** Super Admin holds every permission in the seed
(`SUPER_ADMIN: PERMISSIONS.map(p => p.name)`), which includes
`students:write`, `marks:write`, `upload:create`, `upload:process`,
`schemes:write`, `subjects:write`, `subjects:delete`, `branches:write`,
`branches:delete`.

**Impact:** Super Admin has write access to everything, directly contradicting
§3.2. The role must be re-scoped to configuration + read.

### 7.7 Permissions are role-gated, which defeats permission-driven access

**Requirement:** access is decided by permissions alone; a person may hold
several roles and the union applies.

**Current:** every write route carries a hard-coded `@Roles(...)` list in
addition to `@Permissions(...)`. Examples — `POST /students` is
`@Roles('SUPER_ADMIN','ADMIN')`; `POST /marks` is
`@Roles('SUPER_ADMIN','ADMIN','TEACHER')`; `GET /users/members` is
`@Roles('SUPER_ADMIN')`. The `RolesGuard` therefore vetoes a user who holds
the right permission but a role not on the hard-coded list — for example a
Principal granted `reports:generate`, or a Teacher granted `students:write`.

**Impact:** the "permissions drive everything" principle is not implemented. The
role lists and the permission matrix are two parallel authorisation systems
that can disagree, and the role list silently overrides the permission grant.

**Needed:** remove role-based vetoes from route guards; keep only
`@Permissions`. Role assignment remains a way of *granting* permissions.

### 7.8 Branches and academic years have no UI

**Requirement:** Super Admin creates branches and years (§3.2, §5).

**Current:** the backend has full CRUD — `POST/PUT/DELETE /api/v1/branches`
and `GET /api/v1/academic-years` — but **no frontend page exists** for either.
The frontend has exactly 21 routes; `branches` and `subjects` are absent from
`NAV_ITEMS` and from the sidebar's `ROLE_ALLOW` map.

**Impact:** Super Admin cannot add a branch or a year through the app. Branch
creation is currently only possible by editing the seed file.

### 7.9 Subjects have no UI

**Requirement:** the exam cell defines subjects — code, name, credits, max
marks, component breakdown, passing marks, semester/branch assignment (§3.3).

**Current:** `POST/PUT/DELETE /api/v1/subjects` exist in the backend with
`maxMarks`, `passingMarks`, `credits`, `components` (JSON) and
`branchId`/`semester`/`year`/`schemeId` on the model — but there is **no
subjects page**. No frontend route, no nav entry.

**Impact:** the exam cell cannot create a subject through the app, so the marks
template that §3.3 and §4 depend on cannot be created by the intended role.

### 7.10 Roles and permissions have no editable UI

**Requirement:** Super Admin configures roles and permissions (§3.2, §5).

**Current:** `GET/POST/PUT/DELETE /api/v1/permissions` and
`GET /api/v1/roles` exist in the backend. The frontend shows a **read-only**
"Roles" tab inside Admin ▸ Members (cards with member counts and permission
counts). There is no way to assign a permission to a role or create a role.

**Impact:** Super Admin can view the permission matrix but cannot change it.
The role bundle is frozen at seed time.

### 7.11 Teacher allocation cannot be managed in the UI

**Requirement:** a teacher enters marks only for allocated subjects; a class
teacher is assigned to a class; the HOD makes both allocations (§3.4, §3.6).

**Current:** `TeacherSubject` rows exist and `TeacherSubject` has a unique
constraint on `(teacherId, subjectId, academicYearId)`, but there is **no UI**
to allocate a subject to a teacher, and no UI to assign a class teacher. There
is no class-teacher assignment entity at all (see §7.3).

**Impact:** allocation can only be done by editing the database directly.

### 7.11a Class-teacher assignment has no backend either

**Requirement:** the HOD assigns one class teacher per class (§3.4), and the
class teacher then sees that class's statistics (§3.6).

**Current:** the class-teacher concept does not exist in the backend. The
`TeacherSubject` table covers subject allocation only. There is no way to
record "Teacher-C is the class teacher for CS / semester 5 / scheme 2024 /
academic year 2025-26", and no way to enforce "exactly one class teacher per
class".

**Impact:** the class teacher role cannot be exercised at all. §7.13's class
statistics cannot be scoped to a class, and there is no assignment record to
audit.

### 7.12 Teacher allocation is not enforced when entering marks

**Requirement:** a teacher may enter marks only for subjects allocated to them.

**Current:** `POST /marks` checks `@Roles('SUPER_ADMIN','ADMIN','TEACHER')` and
`@Permissions('marks:write')`. The service writes the mark without checking
whether the teacher is allocated to that subject for that academic year.
`marks:edit_own_subject` exists as a permission in the seed and is granted to
`TEACHER`, but **no route uses it**.

**Impact:** any teacher can enter or overwrite marks for any subject in the
college. This is the central authorisation rule of §3.6 and it is not enforced.

### 7.13 Class scope is not enforced for class-teacher statistics

**Requirement:** the class teacher sees their class's stats, percentages and
subject-wise toppers — and only their class's (§3.6).

**Current:** `GET /marks/calculate/class` is `@Roles('SUPER_ADMIN','ADMIN','HOD')`
and takes `branchId`, `semester`, `schemeId`, `academicYearId` as caller-supplied
query parameters with **no check** that the caller is the class teacher of that
class.

**Impact:** any teacher could query class statistics for any class by changing
the query parameters.

### 7.14 The student role's described behaviour is entirely unimplemented

**Requirement:** the student sees their own result and their class's toppers,
nothing more (§3.7).

**Current:** the `STUDENT` role holds exactly one permission, `dashboard:read`.
`GET /toppers/class` is `@Roles('SUPER_ADMIN','ADMIN','HOD','PRINCIPAL')` —
students are excluded outright. There is no "my result" endpoint or page, and
no link between a user account and a student record (§7.4).

**Impact:** a student can log in, see the dashboard shell, and nothing else.

### 7.15 Dashboard is not role-aware

**Requirement:** the Super Admin dashboard shows college-wide academic-health
metrics (§3.2); every other role sees metrics for their own scope.

**Current:** `GET /dashboard` is `@Roles(...)` over all six roles with
`dashboard:read` and returns one undifferentiated payload. The frontend
`/dashboard` page renders a single fixed set of cards.

**Impact:** Super Admin sees the same cards as a class teacher, with none of
the college-wide operational metrics (subjects per semester, marks uploaded vs.
pending, departments with missing data, result publication status).

### 7.16 HOD branch scope is not enforced on reads

**Requirement:** HOD sees their branch's data (§3.4).

**Current:** `UserRole.branchId` exists and `BRANCH_SCOPED_ROLES` is defined,
but that constant is referenced in exactly one place — `invites.service.ts` — to
decide whether an invite needs a branch. **No read path filters by the user's
branch.** `GET /students`, `GET /marks`, `GET /analytics/*` and `GET /toppers/*`
apply only caller-supplied `branchId` filters, defaulting to no filter, i.e.
all branches.

**Impact:** an HOD or Principal with branch scope can see every branch's data
by omitting the `branchId` parameter.

### 7.17 Student ID and Student Account are separate concepts that collide

**Requirement:** the exam cell adds students; a student later logs in to see
their result.

**Current:** `STUDENT` is one of the six invitable roles, so a student is
minted through the *invite* flow — the same flow as staff — and the invite
requires an email. But `Student` (the academic record, with `rollNo`, `branchId`,
`semester`, `batchId`) has no `userId` and the `Student` table has no email
column at all.

**Impact:** there is no defined way to provision a login for a student who was
added by the exam cell, and no way to match a logged-in student to their
academic record. See §7.4.

### 7.18 Audit log exists but records little

**Requirement:** the principal and Super Admin need to see who changed what.

**Current:** an `AuditLog` model exists with `action`, `resource`, `resourceId`,
`details`, `ipAddress`, `userAgent`, and `GET /audit-logs` exists. The audit
module writes login and user-management events, but there is **no frontend
page** for audit logs, and marks/student/subject mutations are not recorded.

**Impact:** no end user can see the audit trail, and academic changes are not
audited.

### 7.19 The app has no academic-structure screen to navigate by

**Requirement:** the college's structure — branches → years → semesters →
subject offerings — is the spine of the product (§2).

**Current:** the only structural navigation is Admin ▸ Schemes. There is no
screen that shows "Branch CS → Semester 5 → which subjects, which teachers,
which students, marks status".

**Impact:** a new academic year or semester cannot be set up without knowing
the API.

---

## 8. Summary of gaps

Ordered by how much they block the stated requirements.

| # | Gap | Requirement violated | Size |
|---|---|---|---|
| 1 | Subject / subject-offering not split | §2, §3.3, §4 | Large — schema + all subject/marks code |
| 2 | No `Examination` entity; result publication unstateable | §2 | Medium — schema + result service |
| 3 | No class-teacher assignment entity (backend or UI) | §3.4, §3.6, §7.11a | Medium — schema + stats scope + UI |
| 4 | No `Student`↔`User` link; student login unimplementable | §3.7, §7.4 | Medium |
| 5 | Student data access not owner-scoped | §3.7, §7.5 | Medium |
| 6 | Role guards veto permission grants | §3.1, §7.7 | Medium — every controller |
| 7 | Teacher allocation not enforced on marks entry | §3.6, §7.12 | Medium |
| 7a | HOD has no allocation screen (subjects or class teacher) | §3.4, §7.11 | Medium |
| 8 | Branch scope not enforced on reads | §3.4, §3.5, §7.16 | Medium — all read paths |
| 9 | Super Admin holds every write permission | §3.2, §7.6 | Small — seed + permission set |
| 10 | No branches page | §3.2, §5, §7.8 | Medium — new page + API wiring |
| 11 | No academic-years page | §3.2, §5 | Small — new page + API wiring |
| 12 | No subjects page | §3.3, §5, §7.9 | Large — new page + offerings UI |
| 13 | No roles/permissions editing UI | §3.1, §3.2, §7.10 | Medium |
| 14 | No teacher-allocation UI | §3.4, §3.6, §7.11 | Medium |
| 15 | No class-teacher assignment UI | §3.4, §3.6, §7.11, §7.11a | Medium |
| 16 | Dashboard not role-aware | §3.2, §7.15 | Medium |
| 17 | No "my result" screen | §3.7, §7.14 | Medium |
| 18 | Student excluded from class toppers | §3.7, §7.14 | Small |
| 19 | No audit-log screen; academic changes unaudited | §7.18 | Medium |
| 20 | No academic-structure navigation | §2, §7.19 | Medium |

---

## 9. What already works and should not be disturbed

- Permission-based enforcement infrastructure (`PermissionsGuard`) — Redis-cached
  with a database fallback, and a global RBAC version for O(1) cache
  invalidation. The mechanism is sound; it needs to be the *only* mechanism.
- The three-way marks ingestion pipeline (CSV / text PDF / image-PDF OCR) with
  review-before-confirm. The parsing engines work.
- Invitation lifecycle, with superseded vs. revoked distinguished and an
  audit trail of who invited whom.
- Token rotation on refresh, token revocation, and the inactive-user check on
  every authenticated request.
- Report generation with background jobs.
- Password reset, forced password change on first login.
- Responsive layout and the design system — these are production-quality and
  new screens must follow them.
