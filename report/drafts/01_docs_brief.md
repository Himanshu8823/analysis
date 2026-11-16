# Documentation Brief — Result Analysis System

Sources: PROJECT.md, README.md, new-requirements.md, DESIGN.md, docs/DECISIONS.md, docs/GOAL-CHECKLIST.md (plus AGENT-PROMPT.md and scripts.md for chronology). Precedence applied: the codebase and new-requirements.md outrank PROJECT.md; docs/DECISIONS.md is the latest statement of design intent.

## 1. Problem statement and core idea

The system automates the complete result-analysis workflow for a single DBATU-affiliated college. Student result data arrives as Excel/CSV and as PDFs (text-layer and scanned), is processed by scheme-aware calculation engines for DBATU schemes 2019, 2022 and 2024, has toppers identified with correct tie handling, and becomes multi-sheet Excel workbooks plus rich visualisations.

The problem, as stated: manual analysis of 100+ students takes 2–3 days; it produces human calculation errors; there is no standardised handling of the university's multiple schemes; toppers are not identified properly (especially ties); reports are inconsistent; and there is no role-based access, so users see everything or nothing. The product replaces that with an automated, audit-ready pipeline.

Domain: higher-education academic administration in an Indian engineering college — branches, semesters, subjects, credits, component-wise marks (CA / MSE / ESE / practical), aggregate pass rules, result publication, class toppers, pass-fail analytics. Audience: explicitly not developers; every capability must be reachable by clicking through the UI, not only through an API.

## 2. Feature set, grouped into modules

- **College setup.** Branches, academic years, schemes with pass rules, subjects and subject offerings per branch/semester/scheme/year. A "class" is one semester's cohort.
- **People and access.** Accounts, invitation lifecycle (superseded vs revoked distinguished, with audit trail), roles as permission bundles, permission matrix, branch-scoped role assignments, password reset, forced password change on first login, token rotation and revocation, inactive-user check on every request.
- **Student roster.** Single and bulk creation, import, edit, archive (never hard delete), real-world student profile (identity, contact, category, guardians, status), and a profile screen with academic snapshot, marks history, result history, documents and activity trail.
- **Marks ingestion.** Three mandatory paths — CSV, text-layer PDF, image PDF via OCR — converging on upload → detect type → parse → mandatory human review of extracted rows → confirm → marks written per subject offering against that subject's template.
- **Marks entry and calculation.** Manual entry alongside upload, per offering, against max marks, component breakdown and passing marks. Scheme-aware calculators (2019 / 2022 / 2024) via a strategy factory; results per student and per class; pass/fail; treatment of absent, withheld, partial, zero-credit, practical-only and CC-option cases; a subject with no marks is *pending*, not *failed*.
- **Toppers.** Subject topper (highest marks, all ties listed, absent and withheld excluded); class topper (sum of marks or percentage, configurable, subject-wise pass criteria applied first).
- **Reports.** Multi-sheet Excel workbooks — Student Wise Result, Scheme Wise Marks, Subject Analysis, Student Analysis, Class Toppers, Pass/Fail Analysis, Charts Data — as background jobs, downloadable, with a readiness check.
- **Analytics.** Pass/fail distribution, subject difficulty, topper comparison, marks distribution, credits summary, trends, performance analytics.
- **Governance.** Audit log of every academic mutation, notifications, health checks, role-specific dashboards, rate limiting with real-world per-endpoint limits, Redis plus React-Query caching.
- **Design and quality.** Coinbase design system as the only token source; exactly three breakpoints (mobile <768px, tablet 768–1023px, desktop ≥1024px); WCAG 2.1 AA; no horizontal scroll; 44px touch targets.

## 3. What new-requirements.md added or changed

Later than PROJECT.md and superseding it; the changes are structural:

- **Permission-driven, not role-driven.** Roles are only bundles; no feature may be gated on a role name. A person may hold several roles; effective capabilities are the union.
- **Scope as a first-class concept** — college-wide, branch, class, own — attached to the assignment, not the permission.
- **Six personas with separated duties.** Super Admin becomes view-only on academic data; Principal has zero writes; the Exam Cell becomes the only role that adds students.
- **Subject vs subject offering split.** A subject is an identity (code, name, credits, max marks, component breakdown, passing marks); an offering is its assignment to branch/semester/scheme/year. No duplication per semester.
- **Examination as a first-class entity** with a publication lifecycle, so "result not yet declared" is distinct from "failed".
- **Class teacher** as a distinct, separately-permissioned responsibility — exactly one per class.
- **Two separate allocation permissions** (subject allocation, class-teacher assignment), so one HOD can allocate subjects while another handles class-teacher duties.
- **Student self-service:** own result and own class's toppers only.
- **Audit-log screen and role-aware dashboards.** Super Admin gets college-wide academic-health metrics: students per branch/semester, subjects per branch/semester, marks uploaded vs pending, pass percentage, toppers per branch, departments with missing data, result-publication status.
- **Scope narrows to one college**; multi-college/tenant isolation is explicitly out of scope.

Two later additions, from the hardening brief and DECISIONS.md rather than new-requirements.md itself:

- **Scheme-as-PDF ingestion.** A scheme is a curriculum PDF (course code, type, name, lecture/practical hours, CA|MSE|ESE marks, credits). Pipeline: upload PDF → extract text or OCR → the code *selects* the table region → GROQ *interprets* it at temperature 0 under a strict schema → backend validates every row → human reviews in an editable table → confirms → subjects and offerings written, pass rules derived. The AI proposes; the human disposes. It is an accelerator, never a hard dependency: manual entry must always remain possible.
- **"The code selects, the model interprets."** A deterministic parser for DBATU table geometry was built and abandoned: the document family is unbounded and rule-based reading fails silently with plausible-but-wrong numbers. The deterministic layer is kept only for selection (locate the table, reduce to a positional slice); the model reads it.

## 4. Explicit non-goals, constraints and out-of-scope items

- Multi-college / tenant isolation — explicitly out of scope.
- AI as a hard dependency; the app must never be blocked on the AI service.
- Hard deletion of anything a report, mark or audit entry may reference. Students and members are soft-deleted; a subject with marks is deactivated; a scheme with offerings is versioned, not edited in place.
- Partial bulk writes — a bulk mark write is rejected whole; "47 of 50 saved" is never acceptable.
- Changing the calculators' expectations to fit a new input; a new input is adapted to the calculator. "Marks are sacred."
- Role-based vetoes — adding role checks back to route guards would create two sources of truth.
- JSON in the user interface — never show raw JSON, internal ids, enum values, permission strings or developer labels; the old raw-JSON scheme form is to be removed.
- Silent data loss; hard-coded secrets; colours or custom components outside the Coinbase design system.
- Hand-tuning a parser to make one document parse correctly.
- Treating "could not check" as "checked and safe" — a failed guard check must be reported as not checked.
- Two consumers on one queue — a handler that acknowledges work it did not perform is worse than no handler.
- Editing an existing migration — migrations are added, never modified; existing rows are backfilled.
- Dark mode, internationalisation and animation timings (dark mode only if the design system provides it; i18n is future scope).
- The design system's own marketing surfaces — in-product surfaces are not part of it.

## 5. Doc-vs-doc conflicts, with the correct reading

1. **PROJECT.md calls the tech stack "LOCKED" and names Hugging Face OCR models; the later work adds GROQ for scheme reading.** Both hold: OCR remains one of three ingestion paths and is on the "do not regress" list; GROQ is an additional dependency for scheme reading only.
2. **PROJECT.md Phase 4 describes a separate worker consuming the queues; the implementation keeps all four processors in the backend and reduces the worker to a supervisor.** DECISIONS.md resolves it: queue names corrected to the four real ones, worker handlers made honest, worker refuses to start if the queues are already consumed. The live bug was a placeholder worker acknowledging jobs it never performed, silently discarding uploads and reports. **Correct: DECISIONS.md — the code is right, the doc was stale.**
3. **new-requirements.md §7 claims the Subject/SubjectOffering split, the Examination entity, the ClassTeacherAssignment entity and the Student→User link do not exist.** DECISIONS.md §7 and an independent schema read confirm all four exist. **Correct: the code is right; §7.1–§7.4 and §7.11a are outdated.** Note the irony: the document's own header claims to be the source of truth and the implementation wrong — that claim does not survive the later code reading.
4. **new-requirements.md §7.6–§7.7 claims Super Admin holds every write permission and that role guards veto permission grants.** The seed was re-scoped (Super Admin read-only on academic data, Principal zero writes, Teacher holds `marks:enter_own_subject` not `marks:write`) and role guards were removed. **Correct: the code is right; the document is stale.**
5. **new-requirements.md has schemes configured as hand-typed JSON; the hardening work replaces this with PDF ingestion and structured labelled inputs.** The stored `rules` shape is unchanged (the calculators still read it); the entry method changes. **Correct: the later pipeline wins; the calculators are the specification.**
6. **new-requirements.md lists Class Overview and My Result screens that PROJECT.md's route map omits.** Both are real requirements; PROJECT.md's map is an earlier, shorter list.
7. **DESIGN.md documents a fourth "Wide" breakpoint (>1280px); CLAUDE.md and PROJECT.md mandate exactly three.** **Correct: CLAUDE.md's three-breakpoint rule governs the application.** DESIGN.md describes the reference design system's own marketing responsiveness, broader than the product's mandated three.
8. **PROJECT.md places the Prisma schema at a root `prisma/` folder; it actually lives under the backend app.** **Correct: the README and code win; the PROJECT.md tree is aspirational.**
9. **README.md's "Status: Bootstrapped" and its note that the design system is applied directly in the frontend Tailwind config are stale.** The design system now lives in its own workspace package, and the app is far past bootstrap. **Correct: the later docs and code win.**

## 6. Roles and personas

- **Super Admin** — onboarding and governance owner. Configures branches, academic years, schemes, the permission matrix; invites, deactivates and removes members; views all data and the college-wide academic-health dashboard. Cannot create/edit/delete students or subjects, or enter/edit/delete/upload marks. View-only on academic data.
- **Admin (Exam Cell)** — owns admission of academic data and the roster; the only role that adds students (single and bulk). Creates subjects with code, name, credits, total/max marks, component breakdown, passing marks, semester and branch assignment; edits subject metadata and offerings. Enters marks via CSV/PDF/image-PDF upload or manual entry; generates reports, runs analytics, publishes results. Cannot manage branches, years or schemes, configure roles, invite users or manage members. Critically: the exam cell defines *what a subject is worth*; the teacher fills in *what each student scored*. The exam cell never writes a score except through an explicit, reasoned, audited correction.
- **HOD** — mostly a reader, branch-scoped (one per branch; never another branch's). Views branch data, analytics, toppers, pass-fail; manages subjects and students for the branch; assigns subjects to teachers and assigns each class's class teacher. Cannot edit marks without a marks-writing permission, create students, invite users, configure permissions, or change the college's structure. The two allocation duties are separate permissions.
- **Principal** — read-only and statistical: statistics, graphs, trends, pass-fail, toppers, college-wide analytics, report downloads. Zero write permissions.
- **Teacher** — two responsibilities under one role, both requiring explicit HOD allocation. As *subject teacher*: enters marks only for allocated subjects; views data for their subjects and students. As *class teacher* (exactly one per class): views class statistics, percentages, class and subject-wise toppers; grants no marks-entry rights by itself. A teacher with the role but no allocation can enter nothing.
- **Student** — sees only their own result, own marks and their own class's toppers. Nothing else.
- **Class Teacher** — a responsibility within the Teacher role, defined by the class-teacher-assignment permission.

## 7. Described workflows

- **Academic setup (Super Admin).** Create branches → academic years → schemes and pass rules. Subjects arrive via the scheme workflow; the exam cell may still edit metadata and offerings.
- **Scheme import (Exam Cell).** Upload the curriculum PDF → extract text locally (or OCR if scanned) → the deterministic layer locates the course table and reduces it to a positional slice → GROQ returns structured course rows at temperature 0 under a strict schema → the backend validates every row (components sum to 100, hours present, totals row excluded, semester read from the heading above the table) → the exam cell reviews in an editable table (fix, delete or add rows; validation failures shown per row) → confirms → subjects and offerings created, pass rules derived. A CC row's option choice is recorded per student, not per offering. If the AI is unavailable, the same review table is filled in by hand.
- **Student admission (Exam Cell).** Create students individually or bulk-import a spreadsheet, with per-row error reporting. Records carry personal, contact, category, guardian and status data. A login is provisioned (individually or per class) so the student can later see their own result.
- **Teaching allocation (HOD).** Assign subjects to teachers for a semester and assign exactly one class teacher per class (branch + semester + scheme + academic year), targeting teachers already onboarded and subjects already created. Replacing an existing class teacher is an explicit, confirmed replacement.
- **Marks ingestion (Teacher for allocated subjects; Exam Cell by correction only).** CSV, text-layer PDF or scanned image PDF via OCR, all converging on upload → detect type → parse → the user reviews extracted rows → confirms → marks written per offering. OCR runs as a queued background job with status polling and a completion notification.
- **Manual marks entry (Teacher).** Open the Marks screen for the class context, see only allocated subjects, enter component-wise scores or mark a student absent, save. Every write path — single, bulk, update, delete, upload-confirm — passes through one shared authorisation check in the service layer. A bulk write touching an unallocated subject is rejected whole. Exam-cell writes over a teacher's subject are refused unless performed as an explicit, reasoned, audited correction, with the teacher's original marks preserved.
- **Result computation (system).** The scheme-aware calculator produces, per student, component totals, aggregate, credits earned, pass/fail and grade, applying per-component minimums, aggregate pass rules and edge cases. A subject with no marks is pending, not failed. Results belong to an examination with the lifecycle pending → processing → published.
- **Topper identification (system).** Subject topper: highest marks, all ties listed, absent and withheld excluded. Class topper: sum of marks or percentage (configurable), subject-wise pass criteria applied before counting toward the total, ties handled.
- **Reporting.** Generated as a background job into the multi-sheet workbook; a readiness check verifies the underlying marks are complete first.
- **Analytics and dashboards.** Super Admin sees college-wide academic-health metrics; everyone else sees their scope's metrics — pass-fail ratios, trends, subject difficulty, performance distributions.
- **Publishing and student consumption.** The Exam Cell publishes the result; the student then sees their own result and their class's toppers.
- **Revocation and lifecycle (Super Admin).** Deactivating or deleting a member immediately revokes access and tokens, preserves history, releases subject allocations and the class-teacher assignment, and leaves the class visibly flagged "class teacher required" — with consequences shown before confirmation ("this will remove 3 subject allocations and 1 class teacher assignment; CS · Semester 5 will have no class teacher") and everything audited.

## 8. Methodology, tech choices, phased development

**Methodology.** Plan first, then code; code is the source of truth; documentation must match the implementation. No temporary fixes — root-cause analysis, permanent architecture. Permissions enforced in the service layer so no route, background job or future controller can bypass them. Scope derived from the authenticated caller, never a caller-supplied parameter (asking for a foreign branch is a 403, not a silent override). One shared capability layer imported by both frontend and backend, with a test proving the two copies agree. Verification discipline: a checklist line may be marked PASS only with evidence — a file, a test, or a check actually run; "the code looks right" is explicitly not evidence.

**Tech choices.** Next.js 14+ App Router, strict TypeScript, Tailwind on the frontend; TanStack React Query, Axios with interceptors, React Hook Form + Zod, Recharts. Nest.js with Controller → Service → Repository layering and Prisma on the backend; BullMQ for queues, Redis for caching, Neon hosted PostgreSQL plus Neon Storage. pnpm workspaces with Turborepo. ESLint + Prettier; Jest, Vitest, Playwright. Coinbase design system as the sole token source. Scheme reading adds GROQ with the key in configuration. Targets: 80%+ coverage on critical paths, Lighthouse 90+ in all categories, API response under 200ms at the 95th percentile.

**Phasing — two programmes are documented.** The *original build plan* (PROJECT.md, 7 phases over 8 weeks): Foundation (monorepo, backend, frontend, auth + RBAC skeleton) → Core Data (branches, schemes, subjects, students, RBAC enforcement, responsive lists) → Marks and Calculation (scheme-aware engine, calculator factory, entry form) → Upload and Processing (strategies, Excel parser, PDF text parser, OCR, worker, job tracking) → Reports and Toppers → Frontend Polish (charts, breakpoint verification, performance, accessibility) → Hardening (rate limiting, audit logs, notifications, testing, docs).

The *production-hardening programme* (8 phases, in order): Phase 0 Orientation (read everything, run the app, write the audit table, decisions log and goal checklist before writing feature code) → Phase 1 The authorisation spine (one authorisation resolution layer, allocation enforced on every mark-write path, exam-cell versus teacher write rights separated, branch scope on student writes, owner/teacher/class scope on reads, shared capability layer, tests logging in as each of the six roles) → Phase 2 Revocation and lifecycle (role assignment management, deactivation semantics, allocation release, token revocation, "class teacher required" state, safe reassignment, consequence preview) → Phase 3 Scheme → PDF → GROQ → subjects → Phase 4 Student profile and widened student model → Phase 5 Dashboard, academic-year/semester semantics, academic-year defaults → Phase 6 UX simplification (navigation mirroring the real college cycle, shared class context, dropdown correctness, error and empty states) → Phase 7 Verification sweep (full test/build/lint, browser walk at all three breakpoints for every screen, every role's journey, API response inspection) → Phase 8 Documentation and final goal verification (README, architecture, per-role end-user guide, API reference, updated audit, decisions, final checklist pass).

**Status at writing.** The goal checklist is an honest baseline scoreboard of 38 lines: 5 PASS, 6 PARTIAL, 19 FAIL, 8 NOT VERIFIED. Its summary names the central problem as the authorisation spine being a set of disconnected checks rather than one enforced mechanism — a teacher can write any mark in the college, a revoked teacher's allocations survive, and a teacher's read access returns the whole branch's mark sheet, while the decorators make it look solved.
