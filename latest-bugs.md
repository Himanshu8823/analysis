# Latest Bugs

Every bug found while testing the application **as an end user** — a person
using the browser, clicking through, doing the work the software is for.

**Status:** testing in progress. The bugs found so far are fixed and
verified; the ones still open are listed at the end.

**How it was found:**
- **A browser walk** — signing in as each of the six roles and opening every
  screen, in a real Chrome, at three widths.
- **Live API checks** — signing in as each role and calling the routes the
  screens call.
- **Source reading** — where a live check could not reach a screen.

**The rule for what counts.** A bug is a thing that stops a college staff
member from doing their work, or shows them something that is not true. A
purely cosmetic imperfection — a slightly uneven margin, a label that could
be phrased better — is noted but is not a bug.

---

## BUG-001 — The student cannot open the Toppers screen

**Severity:** high — the screen is offered and then refused.

**Found by:** the `new-requirements.md` §3.7 audit. §3.7 says a student must
*"See own class's toppers on the toppers page."*

### What happens

A student signs in and clicks **Toppers** in the sidebar. The link is there
— it is shown to every member. The screen loads and then shows an access
refusal.

### Why

The **backend** is correct. `GET /my-toppers`
(`apps/backend/src/modules/students/my-result.controller.ts:43`) serves the
student's own class leaderboard, derived from their own record, and is
guarded by `toppers:read_own_class` — which the student holds.

The **frontend** `/toppers` page is a different screen. It calls
`GET /toppers/subject-wise` and `GET /toppers/class`, and both are guarded
by `@Permissions('toppers:read')`
(`apps/backend/src/modules/toppers/toppers.controller.ts:73,115`). The student
holds only `toppers:read_own_class`, so **both tabs are refused**.

The navigation compounds it: `apps/frontend/lib/constants/index.ts` and the
shared catalogue list the Toppers screen with
`permissions: ['toppers:read', 'toppers:read_own_class']`, so the link is
offered to students and then fails.

This is the "visible but 403'd" leak the specification forbids — the screen
is offered to someone who cannot open it.

### The student's own toppers are reachable elsewhere

`/my-result` calls `useMyToppers`, which uses the correct endpoint, and
that screen works. So the student can see their class's toppers — but only
by going to *My Result*, not by clicking *Toppers*.

### How it should be fixed

Two ways, and the choice is a product one:

1. **Make the `/toppers` page branch.** When the member holds only
   `toppers:read_own_class`, the page shows their own class's toppers
   through `useMyToppers`, and the subject-wise tab is not offered. This
   keeps the link in the sidebar and makes it work.
2. **Take `toppers:read_own_class` off the screen's entry** in the
   navigation and the shared catalogue, so the link is not offered to
   students at all — their toppers live on *My Result*.

**Recommendation:** the first. The requirement says the student should see
their class's toppers *on the toppers page*, and a student clicking
"Toppers" and getting a refusal is a dead end.

---

## BUG-002 — There is no academic-structure screen

**Severity:** medium — it blocks the setup of a new year or semester.

**Found by:** the `new-requirements.md` §8 audit. Gap 20.

### What the requirement says

`new-requirements.md` §7.19:

> **Requirement:** The college's structure — branches → years → semesters →
> subject offerings — is the spine of the product (§2).
> **Current:** the only structural navigation is Admin ▸ Schemes. There is no
> screen that shows "Branch CS → Semester 5 → which subjects, which teachers,
> which students, marks status".
> **Impact:** a new academic year or semester cannot be set up without
> knowing the API.

### What exists

- `admin/subjects` has an **"Offerings by semester"** tab
  (`apps/frontend/app/(authenticated)/admin/subjects/page.tsx:39`)
- `/class-overview` shows one class to its own class teacher
- The shared class context shows the current class at the top of the
  class-scoped screens

None of them is the structure spine. There is **no single place** that
answers, for a given class: which subjects are taught, who teaches them,
who is the class teacher, how many students are enrolled, and how many
students still have marks missing.

### Why it matters

The college's cycle starts here. Somebody has to set up the year and the
semester's subjects. Today they do that by opening *Subjects*, switching to
the offerings tab, filtering, and hoping they have not missed a subject.
And they cannot tell, in one glance, which classes are actually ready to
have their results published.

### What is missing

A screen, reachable from the navigation, that shows the structure and the
state of each class:

- the branch, and its semesters
- for each class: the subjects offered, the teacher allocated to each, the
  class teacher, the number of students, and how many students still have
  marks missing
- a way into "assign a teacher", "assign a class teacher" and "enter the
  marks" for the class that is clicked

---

## BUG-003 — The academic-years screen's permission is documented wrongly

**Severity:** low — the code is right, the document is wrong.

**Found by:** the same audit.

`docs/AUDIT.md` lists `/admin/academic-years` as requiring `students:read`.
The live code gates it on `academic_years:read`
(`packages/shared-constants/src/capabilities.ts`, enforced in
`apps/frontend/components/layout/AppShell.tsx:109`).

The code is right; the document is wrong. It is corrected here so that
nobody trusts the wrong line.

---

## BUG-004 — The requirement document contradicts the code on one point

**Severity:** none in the software; it is a document that misleads.

`new-requirements.md` §3.3 says the exam cell **"never writes a student's
score"**, and lists *"Enter actual marks"* under **Cannot**.

The code gives the exam cell `marks:write`
(`apps/backend/prisma/seed.ts:173`) — it **can** write marks for any offering
in its scope. The rule that is actually enforced is narrower and more
useful: the exam cell may **not** overwrite a subject a teacher holds unless
it goes through the audited correction flow, which demands a reason and
keeps the value it replaced
(`apps/backend/src/modules/marks/marks.authorisation.service.ts:108-125`).

**The code is right.** The exam cell is the college's quality-control
authority; a correction is a legitimate part of that job, and the audit
trail is what makes it accountable. The requirement's wording is from
October 2025, before the correction flow was designed.

`new-requirements.md` §3.3 should be amended to say:

> The exam cell enters marks for subjects no teacher holds. It changes a
> teacher's mark only through the audited correction flow, which records the
> reason and keeps the value it replaced.

---

## BUG-005 — The whole of `new-requirements.md` §7 and §8 is stale

**Severity:** none in the software; it is a document that misleads.

§7 ("Current implementation vs. this requirement") and §8 ("Summary of
gaps") describe a codebase that no longer exists. All twenty gaps it lists
are closed — eighteen fully, one with the routing defect above, one not done
at all.

`docs/DECISIONS.md` §7 records the five corrections the hardening work
already made to that document. §7 and §8 should be brought up to date, or
marked as the historical record they now are.

---

## BUG-006 — The HOD and the Principal cannot see any marks

**Severity:** high — a permission they hold has no screen behind it.

**Found by:** the browser walk, as the Head of Department.

### What happens

The HOD opens **Marks Entry** and is refused: *"You do not have access to
the Marks Entry screen."* The Principal is refused the same way.

### Why

The **backend** is right. `GET /marks` answers `200` for the HOD — they hold
`marks:read` and they may read their branch's marks. The live API check
confirms it.

The **screen** is the problem. `SCREENS.MARKS` in
`packages/shared-constants/src/capabilities.ts:218` is gated on
`permissions: ['marks:enter_own_subject', 'marks:write']` — the two
permissions that let a member **write** a mark. A member who may only
**read** marks has no screen that reads them.

Marks Entry is the screen for *entering* marks, and it is right that the HOD
cannot enter them. The gap is that **there is no screen for reading them**.

### What is missing

A way for the HOD and the Principal to see their branch's marks. The API is
there and it answers correctly; nothing in the app offers it.

Three ways, and the choice is a product one:

1. **A "Marks" read-only screen** for the members who may read marks but
   not write them — a table of the class's marks, with the same scope rules
   the API already applies.
2. **Let the Marks Entry screen open read-only** when the member holds
   `marks:read` but neither write permission — the grid appears, the cells
   are not editable.
3. **A per-class view** — the class's marks appear on the class overview
   screen, for the HOD's branch and the Principal's college.

**Recommendation:** the second. The screen already knows how to fetch and
scope the marks; it only needs to stop offering the editing when the
member may not edit. It is the smallest change and it puts the marks where
a member already expects them.

---

## BUG-007 — The sidebar's toggle button is 40 pixels on a phone

**Severity:** low — but it is on every screen.

**Found by:** the responsive pass, at 375 pixels.

### What happens

On a phone, the button that opens the menu is 40 × 40 pixels. The
specification asks for 44.

### Why

`apps/frontend/components/ui/sidebar.tsx:255` gives the trigger
`className={cn('h-10 w-10', className)}` — 40 pixels. The design system's
icon button is `h-11 w-11` — 44 pixels — and the button component's own
`size="icon"` already carries that.

### The fix

Drop the `h-10 w-10` and let the button component's own size stand. It is
one line, and it affects every screen at once.

---

## BUG-008 — The "Resultiq" logo is a 32-pixel-tall link on a phone

**Severity:** low.

**Found by:** the responsive pass, at 375 pixels.

The logo in the header links home and is 32 pixels tall. It is a link a
finger has to hit, and it is in the header on every screen.

The fix is the same as BUG-007 — give it the 44-pixel minimum height — or
leave it, on the grounds that it is a brand mark rather than a control.
**A decision, not an oversight.**

---

## What was fixed, and what was verified

The bugs above were found during the browser pass. They are fixed and the
fixes were checked by walking the affected screens again in the browser.

| Bug | The fix | Verified by |
|---|---|---|
| **BUG-001** — the student's Toppers screen refused | The screen now branches: a member who holds only `toppers:read_own_class` is shown **their own class's** leaderboard through `/my-toppers`, with no filters and no subject-wise tab. The class-wide routes need `toppers:read`, which a student does not hold. | The student opens **Toppers** and sees *"The highest achievers in your class."* — no failed requests. |
| **BUG-002** — no academic-structure screen | Built. `GET /academic/structure` returns every class in the caller's scope with the subjects taught to it, the teacher allocated to each, the class teacher, the number of students, and how many still have marks missing. The screen shows it as a tree — branch → class → subjects — with each class's readiness. | The Head of Department opens **Academic Structure** and sees *"Computer Science & Engineering · 3 classes"*, *"Semester 3 · SCHEME_2019 · 6 subjects · 20 students · Head of Department · READY TO PUBLISH"*. |
| **BUG-006** — the HOD and the Principal could not see any marks | The Marks screen now opens for a member who holds `marks:read`, and the grid is **read-only** for them — the cells and the absent checkboxes are disabled, and there is no Save button. The screen's title and description change to say so. | The Head of Department opens **Marks** and sees *"The marks of one subject component across a class. You can read them, but not change them."*, with no Save button. |
| **BUG-007** — the sidebar's toggle was 40 pixels on a phone | The trigger now uses the design system's own icon-button size — 44 pixels. | Every screen's mobile pass: the trigger is no longer in the small-target list. |

---

## Still open

### The class-teacher assignment is a different screen from the structure

The new structure screen tells a member which classes have **no** class
teacher — that was the point of the "class teacher required" state. But
assigning one still happens on the Assignments screen, which is a different
place. A member reading "No class teacher" on the structure screen has to
know to go somewhere else to fix it.

**The fix would be a way to assign from the structure screen.** The
structure screen knows the class; the assignment screen knows the teachers.
Whether to join them or to link across is a design decision, and it is
recorded here rather than decided silently.

### BUG-008 — the "Resultiq" logo is a 32-pixel-tall link on a phone

The logo in the header links home and is 32 pixels tall. It is a link a
finger has to hit, and it is in the header on every screen.

The fix is the same shape as BUG-007 — give it the 44-pixel minimum height
— or leave it, on the grounds that it is a brand mark rather than a control.
**A decision, not an oversight.**

---

## What the browser pass found — and what it did not

### Clean

- **No screen scrolls sideways** at 375, 820 or 1440 pixels. The
  specification's main responsive requirement is met.
- **Every screen a member is offered loads and reads.** The exam cell's
  seventeen screens — students, subjects, marks, correction, upload, reports,
  analytics, publish results, toppers — all work, with no console errors
  and no failed requests.
- **Every refusal is a refusal with a way back.** A member who opens a
  screen they may not use lands on a page that explains it in their own
  words and offers *Back to the dashboard* and *View my account*. Not one
  dead end was found.
- **The marks, results, toppers, analytics and audit screens** all load
  with real data for every role that may see them.

### Not found, because it could not be checked

- **The forms were opened, not saved.** Each "add" button was clicked and
  the dialog was read — but nothing was submitted, so a save that fails
  silently was not looked for. Submitting would write to the college's
  data, which a verification run should not do without being asked.
- **The charts were not read for correctness.** They were checked for
  rendering, for their size, and for not breaking the layout — not for
  whether the numbers they draw are the right numbers.
- **The keyboard path was not walked.** Every action was done with the
  mouse.
