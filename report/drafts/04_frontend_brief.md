# Frontend Brief — Result Analysis System (Resultiq)

Source of truth: the running code under `apps/frontend`. Next.js 14 App Router, TypeScript, React Query, Axios, Recharts, Tailwind with the Coinbase design system. The app is branded **Resultiq**. The root path redirects to the dashboard.

The single most important architectural fact: **the frontend does not gate on role names.** A shared capability catalogue lives in a shared constants package and is imported by both the backend (to enforce) and the frontend (to hide and to refuse). Each screen declares a set of permissions; a member qualifies by holding *any one* of them, and the union of every role they hold is what counts. Every screen, sidebar link and button is gated on that union. The server remains the authority; the client-side check exists so a member is never shown a screen whose every action the server will reject.

---

## 1. Page inventory

### Public

| Route | Purpose | Access |
|---|---|---|
| `/login` | Email + password sign-in. Supports a `?redirect=` parameter so a protected destination can be resumed. | Public |
| `/forgot-password` | Requests a reset link by email. | Public |
| `/reset-password` | Sets a new password from a token in the URL. | Public |
| `/accept-invite` | Validates an invitation token and lets the invitee choose a password. | Public |

### Authenticated workspace

| Route | Purpose | Permission |
|---|---|---|
| `/dashboard` | Role-aware overview: KPI cards, chart blocks and (where the role allows) a recent-uploads feed. The backend decides the scope (college / branch / class / own). | `dashboard:read` |
| `/my-result` | The signed-in student's own marksheet: subject-wise totals, component breakdown, pass/fail verdict, credits, class leaderboard. | `marks:read_own` |
| `/upload` | Drag-and-drop a result file (Excel, CSV or PDF), watch it parse, review the extracted rows, confirm them into marks. | `upload:create` |
| `/upload-history` | Every upload job the member may read, filterable by status. | `upload:read` |
| `/students` | The roster: searchable, filterable by branch and scheme, with edit, delete, add and import actions. | `students:read` |
| `/students/new` | Create a student. | `students:write` |
| `/students/[id]/edit` | Edit a student (same field set as create). | `students:write` |
| `/students/import` | Bulk import students from a CSV/Excel sheet. | `students:write` |
| `/marks` | Manual marks entry: a grid of students against one subject offering and one exam component. | `marks:enter_own_subject` or `marks:write` |
| `/class-overview` | For a class teacher: the roster, class standing and subject-wise picture of their own class. | `class_teacher_assignments:read` |
| `/reports` | Generate and download multi-sheet Excel reports, gated on a result-readiness check. | `reports:read` |
| `/toppers` | Subject-wise toppers and a class leaderboard, with a choice of ranking rule. | `toppers:read` or `toppers:read_own_class` |
| `/analytics` | Cohort-wide metrics: KPI row plus three charts. | `analytics:read` |
| `/my-account` | The member's own profile: display name and profile picture. | none (open to all) |
| `/change-password` | Change one's own password. Open to all — deliberately so, because the shell sends members with an expired password here. | none (open to all) |

### Authenticated administration

| Route | Purpose | Permission |
|---|---|---|
| `/admin/members` | Three tabs: Members, Invitations, Roles. Manage accounts, invitations and role grants. | `users:read` |
| `/admin/members/new` | Invite a member by name, email, role and (for branch-scoped roles) branch. | `users:write` |
| `/admin/members/[id]/edit` | Edit a member's name and email; roles managed on a separate panel. | `users:write` |
| `/admin/roles` | Role catalogue and permission matrix; create/rename roles and tick permissions. | `rbac:read` |
| `/admin/branches` | Branch catalogue: create, rename, deactivate, delete. | `branches:read` |
| `/admin/academic-years` | Read-only list of academic years with start/end dates and active status. **Deliberately no create action** — the backend exposes no create endpoint, and a button that cannot save would ship a broken feature. | `academic_years:read` |
| `/admin/subjects` | Subject catalogue with component breakdowns; second tab shows offerings by semester. | `subjects:read` |
| `/admin/subjects/new` | Create a subject and its assessment template. | `subjects:write` |
| `/admin/subjects/[id]/edit` | Edit a subject's template. | `subjects:write` |
| `/admin/subjects/offerings/new` | Place a subject into a class (branch + semester + scheme + academic year). | `subject_offerings:write` |
| `/admin/schemes` | Scheme catalogue (card grid). | `schemes:read` |
| `/admin/schemes/new` | Create a scheme with a rules editor. | `schemes:write` |
| `/admin/schemes/[id]/edit` | Edit a scheme. | `schemes:write` |
| `/admin/schemes/read` | Read a syllabus PDF into reviewable courses, then confirm them into subjects. | `schemes:read` |
| `/admin/assignments` | Two tabs: Subject allocations (offering → teacher) and Class teachers (one per class). | `teacher_allocations:read` or `class_teacher_assignments:read` |
| `/admin/audit-log` | Read-only audit trail: who changed what, when and from where. | `audit:read` |

The six system roles are Super Admin, Administrator, Head of Department, Principal, Teacher and Student. Super Admin is never grantable through the UI. Role names are stored as abbreviations but always rendered for people — "Head of Department" rather than "HOD" — with a short form for narrow columns. There are two distinct role vocabularies: the six *system roles* above are used for member assignment, while the Roles screen separately lets an administrator create **arbitrary custom roles** with their own permission sets.

---

## 2. User journeys

**(a) Login.** The user sees a split screen: a photograph banner on the left half, the form on the right (stacked on mobile). They enter an email and password; both are checked for emptiness on submit, with inline field errors and `aria-invalid`/`aria-describedby` wiring. There is **no "remember me" checkbox** — the session lives in local storage regardless. On submit only the credentials go over the wire; the redirect target stays client-side because the API rejects unknown body properties. On success a welcome toast appears and the user lands on the dashboard, on the `?redirect=` target, or — if the backend flagged the account as needing a password change — straight on the change-password screen. A 429 is special-cased: the message states how many minutes remain in the retry window.

**(b) Forgot password.** The user clicks "Forgot password?" and enters their email. The screen is replaced by a confirmation card telling them to check their inbox and that the link expires in 30 minutes. The confirmation deliberately does not reveal whether the account exists.

**(c) Reset password.** The user opens the emailed link. A missing token shows an "invalid reset link" card with a button back to the request form. Otherwise they choose and confirm a new password; the mismatch check runs first, and the help text states the policy (at least 8 characters, with uppercase, lowercase, a number and a special character). On success the user is sent to the login page with a success toast.

**(d) Accepting an invitation.** The user opens the one-time link. The page first validates the token: a spinner while checking, a clear refusal card if the invitation is invalid or already used, and — if valid — a card showing the name, email and role the administrator assigned, followed by password and confirmation fields. On submit the account is created, the session is stored, and the user lands on the dashboard. The link expires after 7 days.

**(e) Admin creating a member and assigning roles.** Member creation is **invite-only** — there is no "create a user with a password" path. The administrator enters a name, an email, a role and — only when the chosen role is branch-scoped (Head of Department, Principal, Teacher) — a branch. On save an invitation is issued; the screen states that the invitee receives a one-time link to choose their own password, expiring in 7 days, and the invite URL is copied to the clipboard automatically so an administrator can share it by hand if mail is not configured. On the Invitations tab a pending invite can be copied (which actually *reissues* the link — raw tokens are never persisted, so the old link is revoked and exactly one is ever live), resent, or withdrawn with confirmation; resending marks the old record superseded, which renders as "Replaced". Editing a member changes only name and email — roles are deliberately *not* editable there, because a role change must go through the RBAC endpoints so the permission cache is invalidated and the change is audited. Roles are granted on a separate Roles panel below the edit form: "Add a role" opens a dialog listing only the roles **below the signed-in member's own authority**, with a branch dropdown appearing only for branch-scoped roles. A role already held college-wide is not offered again, but a role held in *another* branch is — that is how a teacher works in two branches. Taking a role back asks for confirmation and names the branch whose access will be lost. If the member holds no grantable role, the panel says so and hides the add button. The change takes effect on the member's next request — no re-login needed.

**(f) Uploading marks/results.** The user picks the class in the shared class bar, then drops an Excel, CSV or PDF file. The client checks extension and MIME type first and refuses anything else with a message naming what is expected. The upload becomes a background job; the screen polls every two seconds while it is pending or processing, showing live status text ("Queued for processing", "Parsing marks, mapping to scheme"). When extraction finishes, the extracted rows appear in a paginated table (roll number, subject, exam, marks). Rows that could not be read are listed separately with their row numbers, capped at five shown with a count of the remainder. A member with `upload:process` or `upload:process_own_subject` sees "Confirm and save"; a member with only upload rights sees an explanatory line instead of a button that would fail. On confirmation the rows are written and the user is pointed to the student list.

**(g) Viewing a student's result.** A student opens `/my-result` and sees their identity block, four summary cards (percentage, pass/fail, credits earned, subjects graded), a "subjects to clear" panel if any subject failed, a subject-wise table, a component-wise breakdown with per-entry status badges (Entered / Absent / Withheld), and the class leaderboard with their own row shaded and badged "You". Staff reach a single student's marks through the students list; the marks grid for that student is pre-seeded with what is on record rather than a blank sheet.

**(h) Generating a report.** The user picks the class in the shared bar and selects one of five report types: student-wise result, scheme-wise marks, subject analysis, class toppers, pass/fail analysis. Before the button is usable, the app asks the server whether the class's result is complete. If it is, a green notice says every student's result is in and the button enables. If not, the screen explains what is missing — the subjects with marks outstanding (with a count of how many students each is missing for) and, in a collapsible list, the students still awaiting marks and which subjects each is missing. The button stays disabled and the reason is on screen rather than a dead control. On generation the report is queued; the list of recent reports polls while any report is queued or processing, shows status badges (Queued, Generating, Ready, Failed), and offers a download button that only enables on a completed report. The download writes a fresh Excel file named after the report id.

**(i) Browsing analytics.** The user lands on four KPI cards (total students, pass percentage, average percentage, subjects) plus three charts. The filters above them — branch, scheme, semester — start from the shared class but can be widened; leaving them empty shows everything the member is entitled to see, because the server resolves the caller's branch scope itself. Charts appear immediately on arrival rather than requiring a selection step.

---

## 3. Charts and visualisations actually implemented

Four chart primitives exist, all built on Recharts, all painted from the Coinbase palette only, and all wrapped in a responsive container with an explicit height so they never collapse.

| Chart type | Where | What it shows |
|---|---|---|
| **Donut / pie** | Analytics — "Pass / Fail distribution" | Students bucketed into Distinction, First class, Second class, ATKT and Fail. Empty buckets are dropped. |
| **Bar (vertical)** | Analytics — "Subject difficulty (avg %)" | Average percentage achieved per subject code. |
| **Line (multi-series)** | Analytics — "Performance trends" | Two series across academic years: average percentage and pass percentage. Spans the full width. |
| **Bar (vertical)** | Dashboard — "bar" chart blocks | The backend chooses the block and its colour; the frontend only lays it out. Keys include students per branch, students per semester, subjects per semester, pass percentage per branch, subject performance, performance trend, branches with missing data. |
| **Donut** | Dashboard — "donut" chart blocks | Categorical counts such as students per semester, using a neutral palette that deliberately avoids the green and red semantic tokens, so a slice never looks like a pass or a failure. |
| **Ranked list (not a chart)** | Dashboard — "list" blocks | Human-readable rankings such as toppers per branch and subject offerings awaiting marks, rendered as a definition list so a screen reader announces label and value together. |

Colour carries meaning and is fixed by the metric, not by position: structural counts use neutral blue, ink and grey; achievement charts use the semantic green because a taller bar really is better; the year-on-year trend uses the accent yellow because it is the one series the reader follows across time; data-quality gaps use the semantic red because they are a problem to fix. The analytics page uses the default series palette for all three charts.

No charts appear on the student result screen, class overview, toppers page, reports page or marks grid — those are tabular. Class overview and toppers are the two places where a chart could plausibly have been added but deliberately was not.

---

## 4. Form validation actually implemented

Validation is mostly hand-written and inline rather than schema-driven. Zod is installed and a small validator module exists (roll number 1–20 characters, letters and digits only; email; password minimum 8; marks 0–1000; year 1–4; semester 1–8), but the auth and form screens use controlled state with their own checks.

**Student creation / edit.** Roll number and full name required; roll number upper-cased as typed. Branch, scheme, academic year, batch and semester are selects; the batch is mandatory and checked explicitly on submit because a custom dropdown does not trigger the browser's native required validation. The curriculum year is derived from the semester and shown as a disabled field, so year and semester can never disagree. Roll-number uniqueness is not checked on the client — the server owns it, and a 409 surfaces as "That already exists."

**Subject creation / edit.** Code and name required; the code is upper-cased on save. Credits, max marks and passing marks are required numbers. Hard checks before submit: max marks greater than zero; passing marks not negative; passing marks not greater than max marks. The centrepiece is the **component breakdown** — a repeatable row list of exam type, max marks and optional passing marks, with a live running total. When the components do not add up to the subject's max marks the form warns and names how many marks it is over or short — but it is a warning, not a block, because a partially-specified template is legitimate. An unrecognised exam type already on the record is offered as its own option rather than silently rewritten.

**Marks entry.** The grid does no numeric validation beyond the input's minimum of zero and maximum equal to the component's max marks. The meaningful rules are behavioural: only cells the user actually touched are sent, so saving never blanks components they did not open; a cell marked absent is sent with zero obtained and the absent flag; a non-numeric value is skipped rather than coerced; and the subject selection clears when the class changes, so a grid can never show one class's students against another class's subject.

**Branch.** Code required (max 10 characters); name required (max 100); active/inactive select.

**Scheme.** Name, description and effective-from date all required; the rules field is a JSON editor that must parse, and the error clears the moment the text becomes valid.

**Subject offering.** Subject, branch, scheme, semester and academic year all required; curriculum year derived and disabled.

**Member.** Name required (2–100 characters); email required and format-checked. Role selection limited to the five invitable roles — Super Admin is excluded so it cannot be minted through the UI.

**Role.** Name required (2–50 characters), upper-cased on save; uniqueness is checked client-side against existing names before posting. Description optional, max 255.

**Permission catalogue.** Resource and action both required (max 50 each); permission name required (max 100); description optional (max 255); a duplicate name is refused.

**Passwords.** Minimum 8 characters with uppercase, lowercase, a number and a special character, stated in help text on the reset, invite and change-password screens.

**Profile.** Name 2–100 characters; email is shown but read-only and disabled, with a note that only an administrator can change it.

**Avatar and files.** The picture must be PNG, JPEG, GIF or WebP under 5 MB. Upload type and extension are checked before the request goes out — the scheme reader accepts PDF only, the results uploader accepts Excel, CSV and PDF.

**Import.** The sheet needs a header row with "Roll No" and "Name"; header aliases are matched loosely (roll number, enrollment number, student name, full name). Everything else — branch, scheme, academic year, batch, year, semester — is chosen once and applied to every row, and any class column in the sheet is ignored rather than allowed to override. The import button stays disabled until the file is chosen and the scope is complete, so nobody files students under the wrong branch.

Every one of these is a client-side convenience. The backend re-validates everything with a strict validation pipe that rejects any unexpected key outright.

---

## 5. The UI design system actually used

**Component library.** shadcn/ui (new-york style, React Server Components enabled, Lucide icons) on Radix UI primitives, with the Coinbase design system supplying every colour, radius, spacing step, font and shadow. The Tailwind config is explicitly restricted to the Coinbase tokens, and the shadcn CSS-variable aliases are all HSL forms of those same values — the rule that no colour outside the design system may exist is genuinely upheld.

**Palette.** Primary blue for actions, near-black ink for text, a body grey, muted and hairline greys for de-emphasis, a soft and strong surface tier, a white canvas, semantic green for success and red for failure, an accent yellow for in-flight work. Exactly one shadow tier.

**Theming / dark mode.** **There is no dark mode.** No `prefers-color-scheme` query, no `dark:` variant, no theme toggle — the design system does not provide one, so it has not been invented. The sidebar is by contrast a permanently dark rail, so the white content canvas reads as the foreground plane.

**Typography.** Three families — a display face (always weight 400, never bold), a sans for body, a monospace for numerals. Numerals use tabular figures so columns of numbers align. The type scale runs from an 80px display size down to a 12px caption.

**Responsiveness — exactly three breakpoints.** Mobile below 768px (unstyled Tailwind defaults), tablet 768–1023px (`md:`), desktop at 1024px and above (`lg:`). `sm:` and `xl:` are deliberately unused. The shell differs at each size: mobile has an off-canvas sidebar sheet opened from the header and tight padding; tablet pins the sidebar open at 16rem; desktop pins it and gives content wider gutters with a 1200px readable max-width.

**Layout patterns that repeat.** Data tables render as a real table on tablet and above and collapse to stacked cards on mobile; the marks grid scrolls horizontally inside its own container rather than breaking the page; forms go from one column to two or three; the page header stacks on mobile and puts its actions on the right from tablet up; the class-context bar collapses to one row on a phone and opens into four fields on a wider screen; the empty state sits *inside* the table card so the page keeps its structure.

**Accessibility.** Every input has a programmatic label. Inline validation errors are wired to their field with `aria-invalid` and `aria-describedby` and announced with `role="alert"`; error banners and toasts use `role="status"` / `role="alert"` inside an `aria-live="polite"` region. Charts are `role="img"` with a descriptive `aria-label`. Tables use `scope="col"` headers. Icon-only buttons carry an `aria-label`. The tab strip uses `role="tablist"` / `role="tab"` with `aria-selected`. The active nav item is marked `aria-current="page"`. Interactive targets are at least 44px tall on mobile. Focus rings are deliberately preserved through the token overrides — the Tailwind config notes that dropping them is how dead focus states get shipped.

---

## 6. State and data management

**Caching.** TanStack React Query v5. Global defaults: one-minute stale time, ten-minute garbage collection, no refetch on window focus, refetch on reconnect, mutations never retried, queries never retried on a 4xx. Individual hooks override the stale time by volatility — reference data (branches, schemes, subjects, academic years, the permission catalogue) is cached 5 to 30 minutes; lists and dashboard blocks 60 seconds; the upload history 30 seconds. List queries keep the previous page on screen while the next loads, so the table does not flash empty on a filter change.

**Query keys.** One central factory organised by domain, with a `list` variant embedding the active filters so switching a filter genuinely refetches. Session-scoped data (a student's own result, a class teacher's own class) uses separate keys from roster data, so invalidating the roster cannot throw away the signed-in student's own marksheet.

**Invalidation.** A single invalidation-rules module maps each mutation to the queries it dirties. Creating a student invalidates the roster and the analytics overview. Saving marks invalidates marks, toppers, analytics and reports. Changing a subject invalidates the catalogue, the offerings and the marks. Changing a branch invalidates branches, students and subjects, because all three render the branch code and name. A branch-scoped list is invalidated by its `list` prefix rather than its bare prefix, because the filters are embedded in the key.

**API client.** A single Axios instance against a base URL from the environment, 30-second timeout, credentials included. A request interceptor attaches the bearer token from the stored session. A response interceptor handles a 401 by refreshing the token silently, storing the rotated refresh token, and replaying the queued request; concurrent requests during a refresh are queued and released together; if the refresh fails the session is cleared and the browser is sent to the login page. The login, refresh and accept-invite endpoints are exempt, because a 401 there means wrong credentials, not an expired token.

**Session.** Access token, refresh token and the user object live in local storage. The stored session is read in an effect, never during render, to avoid a hydration mismatch on first paint. The user object carries the primary role, the full role list, the union of effective permissions, the branch id, the must-change-password flag and the avatar URL.

**Error handling.** One shared helper extracts a human-readable message: rate-limit responses surface the server's retry window in minutes first, then the server's own wording, then array-shaped validation messages, then status-code fallbacks ("Your email or password is incorrect", "That already exists"), and only ever a generic line as a last resort. Axios's own "Request failed with status code" text is never shown to a user. A route-level error boundary catches render failures and offers a retry.

**Toasts.** A lightweight provider with four variants — success, error, warning, info — auto-dismissing after four seconds (six for errors), rendered in an `aria-live` region anchored bottom-left on mobile and top-right on tablet and up, each with an explicit dismiss button. Every mutation fires one.

**Loading states.** Route-level spinner; per-table skeletons matching the loaded table's shape; per-block dashboard skeletons matching the KPI and chart card shapes; the upload and report screens poll rather than spin.

**The shared class context.** The branch, scheme, semester and academic year that every class-scoped screen works on live in a context above the authenticated layout, appear in a bar at the top of each such screen, and are remembered in local storage between visits. The class is picked once and is the same on the marks, upload, reports and assignments screens.

---

## 7. What an administrator can configure

**Branches.** Create, rename, deactivate and delete, all through a right-side sheet rather than a separate page. Code (max 10 characters), name (max 100), active status. The list is fetched in one call and filtered on the client because it is small. Branches are the scoping unit for the whole system — role assignment, subject offerings, teacher allocations, class teachers and the scheme reader all hang off a branch.

**Academic years.** Read-only in the UI: year, start date, end date, active badge. No create action — the empty state says the years come from the backend seed and the database, and to ask a Super Admin. The write permission exists in the catalogue but no screen uses it. There is **no admin screen for batches**; a batch (the year a student was admitted) appears only on the student create and import screens.

**Subjects.** A catalogue of subject identities — code, name, credits, max marks, passing marks, active status — each with an assessment template of exam components (CA1, CA2, mid-semester, written, practical, oral) with their own max and optional passing marks. The components column summarises the template ("CA1 20 · CA2 20 · MID_SEM 30 · WRITTEN 75", showing three then "+N more", or "Single total" when there is none). Subjects can be created, edited and removed. Two tabs: the catalogue, and an "Offerings by semester" grid showing what is offered in each of the eight semesters. Search is over code and name; the branch, scheme and semester filters are *placement* filters resolved client-side through the offerings list, because under the subject/offering split a subject row itself carries no branch or semester.

**Subject offerings.** The placement half: placing a subject into a branch, semester, scheme and academic year. A separate record with a separate permission, because it has a different owner (the exam cell and the HOD place subjects; the catalogue is maintained separately). Teacher allocations target an offering id rather than a subject id — the offering is what the teacher teaches.

**Schemes.** A card grid, not a table. Each card carries name, description, effective-from date, active status and a collapsible disclosure showing the rules. Create and edit take name, description, effective-from date, active status and a JSON rules editor for the strategy-specific pass rules.

**Scheme reader.** Upload a syllabus PDF, let the reader propose courses, review them in an editable table, then confirm them into subjects — a three-step flow with the human in the middle; the proposal is never written straight through. The scope (branch, scheme, academic year) must be complete before upload, and changing any scope selection **clears the reading** so a stale proposal is never carried over. A format warning appears before the upload, stating the PDF must be a text PDF — a photo of a printed page will not work — with a link to download a sample. If the reader is unavailable on the system, the upload area is replaced by a message offering "Add a subject by hand" instead. The review panel reports subjects and pages read, semesters found, elapsed time, and a document check (Safe / Partly checked / Refused, naming the worst guard score and which pages were unchecked). **Dropped rows are shown, not hidden** — the count that could not be read is stated and the first six reasons listed. Warnings name the subject, the message and the page. The course table is fully editable (code, name, type, semester, lecture and practical hours, CA, MSE, ESE, credits, page) and collapses to labelled cards on mobile. An empty number cell posts as **absent**, not zero — "the document did not say" is different from "worth zero". Before the write the counts are shown ("N subjects will be saved and M will be skipped"); an existing subject is updated rather than duplicated, and a course is skipped when it has no code or its marks total zero.

**Roles and permissions.** Five mutually exclusive panels on one page. The list panel shows each role as a card with its description, active status, member count and permission count, with actions to open the matrix, edit or deactivate. There is no delete — deactivation is a soft delete, and the confirmation warns that members holding the role will lose the access it grants while the role itself is kept. Create and edit take a name (auto-uppercased) and description, with client-side uniqueness checking. The permissions panel is the matrix: a live "N of M permissions selected" counter, tri-state group checkboxes, and individual checkboxes per permission showing the action in bold, the full resource-and-action name and the description. Selection is held locally and written on save, and the write replaces the entire set — an omitted permission is revoked. A separate catalogue panel lists every permission grouped by resource with a count badge; permissions can be created (resource, action, name, description) and deleted, and deleting one removes it from every role that held it. Renaming a permission is deliberately not offered, because the permission name is the key the RBAC cache is built on.

**Members.** Three tabs. The Members tab lists name with email beneath, role chips showing the role and the branch code (the tooltip names the branch, or says "The whole college"), status (Active/Deactivated, with a "Password change pending" sub-line), last login (or "Never"), and actions to edit, activate/deactivate and remove. Removing asks for confirmation in words. The Roles tab is a read-only summary pointing to the roles editor. The Invitations tab lists invitee, role, status, expiry and actions, with a badge counting pending invites.

**Assignments.** Two tabs. Subject allocations bind a subject offering to a teacher, chosen from a branch-scoped assignable-teachers list rather than the member list; removing an allocation warns that the teacher will no longer be able to enter marks for it. Class teachers bind exactly one class teacher to a class (branch + semester + scheme + academic year); replacing one is implemented as remove-then-create because the backend rejects a duplicate. For a branch-scoped user the branch dropdown is disabled and labelled "Your branch — allocations cannot cross branches".

**Audit log.** Read-only. Search plus three filters (action, resource, member) whose dropdown values and counts come from the server's own facet aggregation rather than from the current page, so a value never disappears because it scrolled off the page. Columns: when, who (name, else email, else "System"), action (a coloured dot plus a humanised label — delete red, create and bulk import green, everything else neutral), what (humanised resource plus the first eight characters of the record id) and the source IP. **There is no row-level detail view and no export** — the API exposes a detail endpoint the page never calls, and there is no download or print control.

### The permission catalogue

A permission is a `resource:action` pair with a description, grouped by resource and sorted alphabetically, then by action within a resource. The seeded resources are: students (read, read_own, write); marks (read, read_own, write, enter_own_subject); reports (read, generate, download); upload (create, read, process, process_own_subject); analytics (read, read_own_department); users (read, write); rbac (read, write); audit (read); invites (read, write); dashboard (read); branches (read, write, delete); schemes (read, write); subjects (read, write, delete); toppers (read, read_own_class); subject_offerings (read, write); academic_years (read, write); examinations (read, write); teacher_allocations (read, write); class_teacher_assignments (read, write); notifications (write).

---

## 8. What a student-facing user sees

**My Result.** The identity block (name, roll number, academic year, publication date or status). Four summary cards: percentage with marks obtained out of marks total, the pass/fail verdict with a count of subjects still to clear, credits earned out of total, and the number of subjects graded with the mark-entry count beneath it. A "subjects to clear" panel listing each failed subject with its reason and a "Not cleared" badge. A subject-wise table (subject, credits, marks, percentage). A component-wise breakdown (subject, component, marks, status badge). And the class leaderboard, with the signed-in student's own row shaded and badged "You", showing rank, roll number, name, total marks and percentage. Three independently paginated tables on the page.

**My Account.** The profile picture in its own card (large avatar or initials, change and remove actions), and the account details card: a full-name field that is editable, and an email field deliberately disabled with the note that an administrator must change it. The save button stays disabled until the name actually changes.

**Change Password.** Current password, new password, confirm new password, with the password policy stated in help text. This is the screen every member with an expired password is forced onto — the shell redirects them there and exempts that route from the redirect, so there is no loop.

A student's dashboard is materially different from an administrator's: the scope resolves to "own", the chart blocks are the ones their permissions allow, and the recent-uploads section is not rendered at all rather than shown empty.

---

## 9. Notable UI behaviours

**Filters.** A shared filter-bar component groups the search box and the filter dropdowns on the left with page actions on the far right, inside one bordered card that reads as the twin of the table card beneath it. A "Clear filters" control appears only while at least one filter is active, and resets search and every dropdown together. Two distinct empty states are distinguished throughout: "nothing exists yet" (which offers the create action) and "nothing matches your filters" (which offers a reset).

**Pagination.** A shared component offers first / previous / next / last buttons, a rows-per-page select (10, 20, 50, 100), and a "start–end of total" counter. Two models coexist: server-side pagination (Members, Invitations, Audit Log) where the filters become part of the query key, the previous page stays on screen while the next loads, and the page resets to one on every filter change; and client-side pagination (Branches, Academic Years, Subjects, both Assignments tabs) where an array is sliced in the browser. Changing the page size resets to page one; the page clamps down if the total shrinks. The Roles page has no pagination at all.

**Sorting.** There is **no column-header sorting anywhere**. Ordering is fixed — the class roster by percentage descending then roll number, subject-wise marks by subject code, the audit trail by timestamp descending. This is a real gap.

**Bulk actions.** There are no multi-select or bulk-action controls (no checkboxes across a list, no bulk delete or bulk role assignment). The only bulk operations are the two file-driven flows: student import and the bulk marks write.

**Import (CSV/Excel).** A workspace screen, not an admin one. It reads CSV for a .csv or .txt filename and Excel otherwise, taking only the first worksheet. **There is no preview or dry-run step** — the import is one request. On success the user returns to the student list with a toast carrying the inserted count; if rows failed, the count of failures is reported too and the first ten per-row errors are listed with their row numbers (1-based and including the header row, so data starts at row 2). A file with more than 5000 data rows imports only the first 5000 and says so.

**Bulk marks write.** The grid's save sends only the touched cells, in one request, keyed by student, subject offering, exam type, marks obtained, max marks, the absent flag and the academic year. A partial bulk write is rejected by the API.

**Tabs.** Used on the admin members screen (Members / Invitations / Roles), the assignments screen (Subject allocations / Class teachers), the toppers screen (Subject toppers / Class toppers) and the subjects screen (Catalogue / Offerings by semester).

**Confirm-and-poll flows.** Uploads poll every two seconds while pending or processing; reports poll every three seconds while any report in the list is queued or generating. Polling stops as soon as the work reaches a terminal state.

**Status vocabulary.** Stored status codes are always rendered as words a college clerk would understand: "Not yet accepted", "Withdrawn", "Expired", "Replaced", "Queued", "Generating", "Ready", "Failed", "Absent", "Withheld", "Entered".

---

## 10. Notable gaps and risks

- **No "remember me"** on the login screen, despite the brief asking for the flow to be described.
- **No dark mode** anywhere.
- **No client-side sorting** on any list — every list is fixed-order and no column header is clickable.
- **No bulk selection actions** — only file-driven bulk operations.
- **The audit log has no detail view and no export**, despite the backend exposing a detail endpoint the page never calls.
- **React Hook Form and Zod are installed but barely used.** The forms use hand-written controlled state; the Zod validator module is largely dormant, so the two can drift out of step with the server's DTOs, which are the real source of truth.
- **The middleware does not enforce authentication.** It exists only to let public paths through; the actual gate lives in the authenticated layout, because the session lives in local storage and the edge runtime cannot read it. This is documented in the code, but it means a protected route is only guarded client-side, with the server as the real boundary.
- **Raw JSON in the scheme form** (see above), which contradicts the project's stated rule that raw JSON must never appear in the user interface.
- **Client-side and server-side filtering are mixed** across list pages without a uniform rule. The subjects page resolves its placement filters client-side through the offerings list because a subject row carries no branch under the split model — a reasonable reason, but one not obvious from the UI.
- The empty `-c` directory and `next build` directory sitting inside the frontend folder are leftover build artefacts, not part of the application.
- Frontend test coverage is thin: seven test files covering the academic helpers, the screen-capability resolver, the error-message helper and the no-access component. No page, hook or form has a test.
