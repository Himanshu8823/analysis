# End-to-End Functional Test Report — Result Analysis System

**Date:** 2026-10-25
**Source of truth:** `new-requirements.md`
**Method:** Chrome DevTools MCP only (no scripts, no shell-based test automation), executed in parallel across isolated browser contexts per role.

---

## 1. Scope & Method

Every role from §3 of the requirements was exercised end-to-end in its own isolated browser context:

| # | Role | Context | Focus |
|---|------|---------|-------|
| 1 | Super Admin | `qa-super` | Config: branches, schemes, academic years, members, roles, subjects |
| 2 | Admin (Exam Cell) | `qa-admin` | Students, subject templates, marks, upload, reports, publication |
| 3 | HOD | `qa-hod` | Branch-scoped subjects, teacher allocations, class-teacher assignments |
| 4 | Principal | `principal-test` | Strictly read-only analytics/reports — verifies no write path leaks |
| 5 | Teacher (subject + class teacher) | `qa-teacher` | Allocated-subject marks entry, class overview, allocations |
| 6 | Student | `qa-student` | Own result, own marks, own class toppers — and *nothing else* |
| 7 | Marks upload formats | `qa-real` | CSV / PDF / OCR upload against the real DBATU printed format |

Findings below are split into:
- **Verified by source inspection** — confirmed by reading the actual code path (file + line).
- **Verified in the browser** — observed by driving the UI.

---

## 2. Severity Scale

| Severity | Meaning |
|----------|---------|
| **CRITICAL** | A core requirement is not implemented at all, or data is silently imported wrong. Financial/accuracy risk — violates "Zero data calculation errors" and "100% accurate marks calculation". |
| **HIGH** | A required screen exists but does not function as specified (empty, gated, or misleading). Blocks the primary job of the role. |
| **MEDIUM** | Missing supporting screen, missing affordance, or a functional limitation that forces a workaround. |
| **LOW** | Polish, copy, dead code, or a cosmetic inconsistency. |

---

## 3. Findings

### 🔴 CRITICAL

---

#### C-1 — The marks-upload parser cannot parse the real DBATU printed result format

**Requirement:** §4 — the three marks-entry paths, with the upload path accepting the format the college actually prints. The printed DBATU statement (the image supplied as source of truth) is a **one-row-per-student** table with a **merged two-row header**, `PRN No` as the student identifier, and **per-subject sub-columns** `CA1 | CA2 | MID | WR` (plus `PRACTICAL` where applicable), followed by per-student `Total Marks | Percentage | SGPA | Result`.

**Actual:** `apps/backend/src/modules/upload/marks-file.parser.ts` expects a **long/tidy CSV** — one row per *mark* (`rollNo, subjectCode, examType, marksObtained, maxMarks, isAbsent`). Its `COLUMN_ALIASES` map has no entry for `PRN No`, no notion of subject sub-columns, and no notion of a summary block.

Worse, the aliases actively **mis-map** the real sheet:
- `'totalmarks'` / `'total marks'` → `maxMarks`
- `'marks'` → `marksObtained`

On the real format, the row's `Total Marks` cell is the *student's aggregate*, not a maximum. If such a sheet is ever accepted, those aliases will import aggregate totals as per-subject maximums — a silent, systematic calculation error.

Additional defects in the same file:
- `parseMarkCell` returns `null` for the literal text `Fail`, so a failing student's mark is dropped rather than recorded as a fail.
- PDF header detection requires a single line containing **both** `roll` and `subject`:
  ```ts
  const headerIndex = lines.findIndex((line) => {
    const normalised = normaliseHeader(line);
    return normalised.includes('roll') && normalised.includes('subject');
  });
  ```
  The real header is split across two rows (`PRN No | Name | <Subject> ...` on row 1, `CA1 CA2 MID WR ...` on row 2), so the real file is never detected as a header.
- The docstring at line 31 references an `expandSubjectColumns` helper that **does not exist** anywhere in the backend — dead reference to a planned implementation.

**Impact:** The single most important data-ingestion path cannot accept the input the college actually produces. Everything downstream (analytics, toppers, results) will be empty or wrong.

**Repro:** Upload the printed DBATU statement (text-PDF or image-PDF). The parser reports "no header found" / zero rows, or mis-imports aggregates.

---

#### C-2 — Students have no way to see their own result

**Requirement:** §3.7 — *"The Student sees only their own result + their own class toppers."* §7.14 lists the gap as open.

**Actual:** The **backend is complete** — `apps/backend/src/modules/students/student-self.service.ts` implements `buildMyResult(userId)`, `buildMyToppers(userId, limit)`, `requireStudentForUser(userId)`, and the controller exposes `GET /students/my-result` and `GET /students/my-toppers`. The frontend has **no screen and no API binding at all**:
- `apps/frontend/lib/api/endpoints.ts` (read in full, 137 lines) — the `STUDENTS` block has `LIST / CREATE / BULK_IMPORT / BULK_IMPORT_FILE / GET / UPDATE / DELETE`. **No** `MY_RESULT`, **no** `MY_TOPPERS`.
- No route directory `app/**/my-result/**` or `app/**/result/**` exists (verified by glob).
- A student signing in lands on `/dashboard`, which renders the generic staff dashboard — and the student has no `students:read`/`marks:read`, so the KPIs come back empty. The student sees an empty shell with no result.

**Impact:** The Student role — one of the six required roles — has **zero usable functionality**. The single most important screen in an entire result-analysis system is missing.

---

#### C-3 — There is no manual marks-entry screen

**Requirement:** §4 — *"three marks-entry paths"* are mandated (manual entry, bulk upload, per-subject entry). §5 lists a Marks/Entry screen in the screens table.

**Actual:** No `/marks` route exists (route inventory of all 31 `page.tsx` files). The frontend data layer *does* have the hooks — `apps/frontend/hooks/useMarks.ts` exports `useCreateBulkMarks`, `useUpdateMark`, `useMarksByStudent` — but **no page imports them** (grep across all `.tsx` returned no matches).

**Impact:** Two of the three mandated marks-entry paths are missing from the UI. Teachers and the exam cell can only enter marks through file upload, which per C-1 cannot parse the real format — so in practice **there is no working way to enter marks at all**.

---

### 🟠 HIGH

---

#### H-1 — The Dashboard renders no charts at all

**Requirement:** The user's explicit instruction — *"pehle se graphs dikhne chahiye na"*, *"sare classes ke liye graphs aise kuch to commodised hona chahiye"*; and §3.2/§3.4 — Super Admin gets a college-wide dashboard, HOD a branch dashboard, everyone else their own scope.

**Actual:** `apps/frontend/app/(authenticated)/dashboard/page.tsx` reads **only** `data?.kpis.*` and `data?.recentUploads`. It never touches `data.metrics`, `data.sections`, `data.scope`, `data.scopeLabel`, `data.roleLabel` or `data.degraded`.

The backend already computes exactly what the requirement asks for — `apps/backend/src/modules/dashboard/dashboard.service.ts` builds `planFor(viewer)` which chooses scope `own | class | branch | college` purely from the caller's effective permissions, and produces a `sections[]` array of chart kinds (`bar | list | donut`): `students-per-branch`, `students-per-semester`, `subjects-per-semester`, `pass-percentage-per-branch`, `performance-trend`, `toppers-per-branch`, `branches-with-missing-data`, `pending-marks`, `result-publication` — plus `metrics[]`, `scopeLabel`, `roleLabel`, `degraded`.

The frontend even **has the TypeScript types** for all of it — `apps/frontend/lib/services/dashboard.service.ts` declares `DashboardMetric`, `DashboardSection`, `DashboardSectionItem`, `DashboardSectionKind`, `DashboardScope` — and returns them. They are simply never consumed.

The dashboard renders 4 fixed KPI cards ("Total students", "Pass rate", "Subjects", "Average score") and a Recent uploads table. **No graph of any kind is rendered.**

**Impact:** The landing screen of every role shows no visual analytics, despite the server sending a complete, role-aware chart plan. This is the single most visible gap.

---

#### H-2 — Analytics is gated behind manual filter selection

**Requirement:** The user's explicit instruction — graphs must show immediately, without the user first picking branch/scheme/semester.

**Actual:** `apps/frontend/app/(authenticated)/analytics/page.tsx` line 127:
```tsx
{!branchId || !schemeId ? (
  <div className="rounded-lg border border-hairline bg-surface-soft p-base text-body-sm text-body">
    Pick a branch and scheme to view analytics.
  </div>
) : isLoadingAny ? ( ... ) : ( ...charts... )}
```
with initial state `branchId=''`, `schemeId=''`. So on first load the user sees a dead-end instruction, not a chart.

**Impact:** Directly contradicts the stated requirement. For a Super Admin or a Principal — who have no natural "my branch" — the manual gate is also wrong in principle: it should resolve to college-wide scope automatically.

---

#### H-3 — Toppers is gated behind manual filter selection

**Requirement:** Same as H-2, plus §3.7 — a student must see their own class toppers *without* any filter selection.

**Actual:** `apps/frontend/app/(authenticated)/toppers/page.tsx`:
```tsx
const enabled = !!branchId && !!schemeId;
...
{!enabled ? (
  <EmptyState title="Pick a branch + scheme"
    description="Choose filters above to see the toppers for that cohort." />
) : ...}
```
(lines 38 and 120)

**Impact:** The Toppers screen is unreachable without manual setup, and the **Student's** required "own class toppers" view has no path at all — the backend `/students/my-toppers` exists but the screen is dead.

---

#### H-4 — The sidebar gates navigation on the primary role only, ignoring all other held roles

**Requirement:** §3.1 — *"no feature may be gated on a hard-coded role name"*; a user may hold several roles and the union of their permissions applies.

**Actual:** `apps/frontend/components/layout/AppShell.tsx` line 94:
```tsx
<AppSidebar role={user?.role} />
```
It passes **only** the primary role and discards `user.roles[]` — which the backend *does* return from `GET /auth/me` (`apps/backend/src/modules/auth/auth.service.ts:336`: `roles: userRoles.map(r => r.name)`).

`apps/frontend/components/layout/AppSidebar.tsx` then hard-codes role names:
```tsx
const ROLE_ALLOW: Record<string, readonly UserRole[]> = {
  '/upload': ['SUPER_ADMIN', 'ADMIN'],
  '/admin/schemes': ['SUPER_ADMIN', 'ADMIN'],
  '/admin/members': ['SUPER_ADMIN'],
  '/admin/subjects': ['SUPER_ADMIN', 'ADMIN', 'HOD'],
  '/admin/assignments': ['SUPER_ADMIN', 'ADMIN', 'HOD'],
};
const ADMIN_SECTION_ROLES: readonly UserRole[] = ['SUPER_ADMIN'];
```

Two distinct defects:
1. **Role-name gating** in the nav itself, which §3.1 forbids.
2. **Primary-role-only gating** — a user who holds `TEACHER` + `HOD` sees only the `TEACHER` subset, and loses access to screens their HOD role grants them.

Secondary effect: `/students`, `/reports`, `/toppers`, `/analytics` have **no** `ROLE_ALLOW` entry, so they are shown to **everyone including the Student** — advertising screens the student cannot use (the server correctly denies them, so the student gets a bare 403 page instead of a clean navigation).

Note on the login response: `apps/backend/src/modules/auth/auth.service.ts:101-108` returns `role` and `branchId` but **omits `roles`** — only `/auth/me` includes it. The frontend session type does model both (`apps/frontend/lib/auth/session-client.ts` — `role: string`, `roles?: string[]`), so the array is available at runtime; it is simply never used.

---

### 🟡 MEDIUM

---

#### M-1 — No Class Overview screen for the class teacher

**Requirement:** §3.6 — a Teacher may be a class teacher and needs a view of their class.

**Actual:** No `app/**/class*/**` route exists. The backend exposes `class_teacher_assignments` reads and `class_teacher_assignments:read` is granted to `TEACHER` in the seed, but there is no screen that renders a class teacher's class.

---

#### M-2 — No audit-log screen

**Requirement:** §7.18 — an audit-log screen.

**Actual:** The backend **does** audit academic mutations correctly — `@Audited(AuditResource.MARK | STUDENT | SUBJECT | SUBJECT_OFFERING | BRANCH | SCHEME, ...)` is present across the relevant controllers, and `audit:read` is granted to `SUPER_ADMIN` in the seed (`apps/backend/prisma/seed.ts:114`). Only the **screen** is missing — there is no audit-log route and no nav entry (`NAV_ITEMS` has 8 entries; none is an audit log).

---

#### M-3 — No academic-structure navigation screen

**Requirement:** §7.19 — a screen that lets the user navigate the academic hierarchy (College → Branch → Year → Semester → Examination → Subjects).

**Actual:** No such route. `NAV_ITEMS` (`apps/frontend/lib/constants/index.ts`) contains only: dashboard, upload, students, subjects, assignments, reports, toppers, analytics.

---

#### M-4 — The upload screen offers no format template or format guide

**Requirement:** §4 — the upload path must accept the college's format; a user cannot discover it without help.

**Actual:** `apps/frontend/app/(authenticated)/upload/page.tsx` line 143 says only:
```
hint="Excel, CSV, or PDF up to 50MB"
```
There is no downloadable template, no sample file, and no inline description of the expected columns or the printed-statement layout. Combined with C-1, a user has no way to know what to upload or that their file will fail.

The same applies to the students import (`/students` bulk import) — no template, and the parser (`apps/backend/src/modules/students/student-import.parser.ts`) hard-requires **UUIDs** for Branch/Scheme/Batch/AcademicYear columns:
```
"${column}" must be a UUID — resolve the name to an id before importing
```
A teacher with a spreadsheet of branch *names* (e.g. `Computer Science & Engineering`) cannot import without first resolving each name to an id by hand.

---

#### M-5 — The upload review table is read-only and truncated at 8 rows

**Requirement:** §4 — review-before-confirm must be a real review step.

**Actual:** `apps/frontend/app/(authenticated)/upload/page.tsx` line 274 renders `rows.slice(0, 8)` — the table shows the first 8 rows only, with no pagination, no "show all", and no row count. Cells are not editable; there is no per-row **reject/skip**. A user cannot correct a bad value or exclude a row before confirming, and cannot even see the rows they are about to import.

Additionally `extractRows()` (line 191) **silently drops** any row missing `rollNo`/`subjectCode`/`examType` or with non-numeric marks — with no visible warning count shown to the user. On the real DBATU format this would drop almost every row, silently.

---

### 🔵 LOW

---

#### L-1 — `getPrimaryRole` picks the most-recently-granted role, which is non-obvious

`apps/backend/src/modules/auth/auth.repository.ts:62-66` — `getPrimaryRole` takes `names[0]` from `getUserRoles`, which is ordered `grantedAt: 'desc'`. So the primary role is the **most recently granted**, not the most senior. Combined with H-4 this makes the sidebar especially unpredictable for multi-role users.

---

## 4. What Already Works (verified)

The backend has moved substantially past §7 of the requirements, and the following were verified as genuinely correct:

| Area | Evidence |
|------|----------|
| **Permission-first RBAC** | `@Permissions()` + `PermissionsGuard`; **no** role guards remain (the only `@Roles(` in the backend is inside a comment at `dashboard.controller.ts:29`). §3.1 satisfied at the API layer. |
| **Cache invalidation** | Global RBAC version gives O(1) invalidation; Redis-cached permissions with DB fallback. |
| **Branch scoping** | `apps/backend/src/common/services/scope.service.ts` — `branchScope()` derives scope from `UserRole.branchId` rows (documented: the JWT carries a single role and cannot express that union); `resolveBranchFilter()` returns `undefined` for college scope, the branch array for branch scope, and **throws `ForbiddenException('You do not have access to the requested branch')`** for out-of-scope requests. |
| **Teacher allocation enforcement** | `marks.service.ts` — `assertTeacherAllocated()` throws `ForbiddenException('You are not allocated to this subject, so you cannot enter marks for it.')`; `assertTeacherAllocatedBulk()` rejects the whole batch. |
| **Student owner scoping** | `@Get('own')` requires `students:read_own`; `@Get('own/:studentId')` 403s for another student's record; `@Get('my-result')` resolves the student from the JWT with no `studentId` param; `@Get('my-toppers')` derives the class from the student's own record. |
| **Exactly-one class teacher per class** | `allocations.service.ts` — `createClassTeacherAssignment` enforces it by updating the existing row for the same branch+semester+scheme+year. |
| **Subject vs SubjectOffering split** | `Subject` (catalogue identity) and `SubjectOffering` (branch+semester+scheme+year) are correctly separated. |
| **Audit instrumentation** | `@Audited(...)` present on MARK/STUDENT/SUBJECT/SUBJECT_OFFERING/BRANCH/SCHEME mutations. |
| **Super Admin is view-only on academic data** | Seed grants SUPER_ADMIN 22 permissions — config + read only; no `students:write`, `marks:write`, or `upload:create`. §3.2 satisfied. |
| **Principal has zero write permissions** | Seed grants PRINCIPAL 11 permissions, all reads. §3.5 satisfied. |
| **Student sees only 4 things** | Seed grants STUDENT exactly `dashboard:read`, `students:read_own`, `marks:read_own`, `toppers:read_own_class`. §3.7 satisfied at the API layer. |
| **Review-before-confirm pipeline** | upload → detect → parse/extract → review → confirm → write; `/upload/jobs/:id/confirm` exists. §4 satisfied structurally. |
| **Password reset / invites / SMTP** | `/auth/forgot-password`, `/auth/reset-password`, `/invites`, `/invites/validate`, `/auth/accept-invite` all present and wired. |

**Conclusion:** the *server* is largely correct and secure. The gaps are concentrated in the **frontend rendering layer** and in the **upload format**.

---

## 5. Requirement → Implementation Gap Matrix (§5 screens)

| Required screen | Route | Status |
|---|---|---|
| Dashboard | `/dashboard` | ⚠️ Exists — renders KPIs only, **no charts** (H-1) |
| Students | `/students` | ✅ Exists — ⚠️ no login-provisioning button; import needs UUIDs (M-4) |
| Subjects | `/admin/subjects` | ✅ Exists |
| Allocations | `/admin/assignments` | ✅ Exists |
| Marks Entry | `/marks` | ❌ **Missing** (C-3) |
| Upload | `/upload` | ⚠️ Exists — no template, read-only review, parser can't read real format (C-1, M-4, M-5) |
| Reports | `/reports` | ✅ Exists |
| Toppers | `/toppers` | ⚠️ Exists — gated behind manual filters (H-3) |
| Analytics | `/analytics` | ⚠️ Exists — gated behind manual filters (H-2) |
| My Result | `/my-result` | ❌ **Missing** (C-2) |
| Class Overview | `/class-overview` | ❌ **Missing** (M-1) |
| Audit Log | `/audit-log` | ❌ **Missing** (M-2) |
| Academic Structure | `/academic-structure` | ❌ **Missing** (M-3) |

---

## 6. Fix Plan (ordered by requirement priority)

1. **C-1** — Rewrite the marks parser to read the real DBATU printed format: `PRN No` alias, one-row-per-student with merged two-row header, per-subject `CA1/CA2/MID/WR/PRACTICAL` sub-columns, ignore `Total/Percentage/SGPA/Result` summary columns, handle literal `Fail`, detect the two-row header. Keep the tidy CSV path working too.
2. **C-2** — Add `/my-result` (student) bound to `GET /students/my-result` + `/students/my-toppers`; add nav entry gated to students.
3. **C-3** — Add `/marks` manual entry bound to the existing `useCreateBulkMarks`/`useUpdateMark` hooks.
4. **H-1** — Make the Dashboard render `metrics[]` + `sections[]` from the existing backend payload, honouring `scope`/`scopeLabel`/`roleLabel`/`degraded`.
5. **H-2 / H-3** — Auto-resolve branch/scheme from the caller's scope on Analytics and Toppers; keep manual filters as an *override*, not a gate.
6. **H-4** — Replace `ROLE_ALLOW` with permission-based nav gating driven by `user.roles[]` (union of permissions), and hide screens the caller cannot reach.
7. **M-1 / M-2 / M-3** — Add Class Overview, Audit Log, and Academic Structure screens with nav entries.
8. **M-4 / M-5** — Upload/import format template + inline guide; make the review table editable with per-row reject, show all rows, and surface dropped-row counts.
9. **M-4b** — Student import should accept branch/scheme/batch **names** and resolve them to ids server-side.

---

## 7. Subagent Reports

_(Merged here as each role's browser test completes.)_

</content>
</invoke>
