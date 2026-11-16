# Resultiq — End User Guide

For the people who use Resultiq every day: the college clerk, the Head of
Department, the teacher, the Principal, the examination cell, and the
student.

You do not need to read this guide from the beginning. Find your role below
and read that section. The **Common tasks** section and the **When something
goes wrong** section are useful to everyone.

---

## 1. What this system does

Resultiq keeps your college's results. You set the college up — its
branches, its schemes, its academic years — then you create the subjects,
bring the students in, give each subject to a teacher, and enter or upload
the marks. Once the marks are in, you read the analytics and generate the
reports.

Three people share the work, and the system keeps their jobs apart. The
**college administrator** configures the college but does not touch marks or
students. The **examination cell** creates students and approves uploads but
does not write a teacher's score. The **teacher** writes what a student
scored, for the subjects allocated to them and no others.

---

## 2. Signing in, and the first time

Go to the sign-in page. Enter your email address and password, then press
**Sign in**.

**If you have forgotten your password**, press **Forgot password?**, enter
your email address and press **Send reset link**. The link expires after 30
minutes. Open it, choose a new password, and press **Reset password**.

**If you were invited to the system**, open the invitation link from your
email. Choose a password, press **Accept invitation**, and your account is
ready.

### The first sign-in

The first time you sign in with a new account, the system takes you straight
to **Change password** and will not let you go anywhere else until you do.
This is deliberate — nobody should keep the password that was set for them.

1. Type your **Current password**.
2. Type a **New password** — at least 8 characters, with an uppercase letter,
   a lowercase letter, a number and a special character.
3. Type it again in **Confirm new password**.
4. Press **Update password**.

The screen will not accept the form if the two new passwords do not match.
When the change succeeds, you are taken to your dashboard.

### Your account

From the menu at the top right, choose **My account** to change your name or
your profile picture. Your email address cannot be changed here — ask an
administrator. Choose **Change password** from the same menu to change your
password at any time, and **Sign out** to leave.

### The menu on the left

The menu only shows the screens your work actually involves. If a screen is
not there, you do not need it — you will not be able to open it by typing its
address either. If you need one that is missing, ask an administrator.

Some screens show a **class bar** across the top: the branch, scheme,
semester and academic year you are working on. Choose it once and it stays
chosen as you move between screens, so you do not keep re-picking it.

---

## 3. The college administrator (Super Admin)

**Your job:** set the college up and keep it running. You configure the
structure that everybody else works within.

**Your job is not:** entering marks, adding students, or deciding who teaches
what. Those belong to the examination cell and the Head of Department.

### What you configure

**Branches** — Screen: *Administration → Branches*. A branch is a
department, such as Computer Science or Mechanical Engineering. Press
**Create branch**, give it a short code and a full name, and press **Create
branch**. A branch that carries records cannot be deleted; deactivate it
instead.

**Academic years** — Screen: *Administration → Academic Years*. This screen
lists the years students, batches and results are grouped by. Each year shows
whether it is **Running now**, **Not started**, **Finished** or
**Scheduled**. Only one year runs at a time. The system works out the running
year from the calendar, so every filter and form defaults to it — you do not
have to choose it.

Press **Add an academic year** to open a new one. The form asks for the year
the way the college writes it (*2024-25*) and the dates it runs between —
both are needed, because the system works out which year is running by
comparing today's date against them. To change which year is running, press
**Make it the running year** on that year; the year that was running is
retired, and every screen follows.

**Academic Structure** — Screen: *Administration → Academic Structure*. This
is the screen the college navigates by. It shows the whole structure at a
glance:

- the **branches**, each with the classes it runs;
- each **class** — a semester of a scheme — with the subjects taught to it,
  the teacher allocated to each, the class teacher, and how many students
  are in it;
- whether the class's **result is ready to publish**. A class that is ready
  says *"Ready to publish"*; one that is not says how many students still
  have marks missing.

Press a class to open the subjects it is taught. A subject with no teacher
allocated says *"Not allocated"*, and a class with no class teacher says
*"No class teacher"* — both are the gaps a member is here to fill.

Use the **Branch** and **Academic year** filters at the top to narrow the
view. The year defaults to the running one.

**Schemes** — Screen: *Administration → Scheme Rules*. A scheme is the
university's published way of evaluating a subject: how many marks each part
is worth, and how many a student must score to pass. Press **Create scheme**.
The form asks you to pick the scheme the university has published (2019, 2022
or 2024 scheme) and fills in the breakdown for you. You then check the
numbers. See [Scheme](#scheme) in the glossary.

**Subjects** — Screen: *Administration → Subjects*. The **Catalogue** tab
lists every subject in the college with its code, credits, maximum marks and
passing marks. The **Offerings by semester** tab shows which subject is
taught in which branch and semester. Subjects normally arrive from the
scheme rather than being typed by hand, but you can **Create subject** and
**Offer subject** yourself if one is missing.

**Reading the university's scheme PDF** — Screen: *Administration → Scheme
Rules → Read a Syllabus*. See [Reading a syllabus PDF](#reading-a-syllabus-pdf).

### Who works here, and in what role

**Members** — Screen: *Administration → Members*. Press **Invite member**,
fill in the person's name, email and role, and press **Send invitation**. The
person receives an email with a link that lets them set their own password.

The screen has three tabs:

- **Members** — everyone with an account, with their roles and when they last
  signed in.
- **Invitations** — invitations you have sent and their state: **Not yet
  accepted**, **Accepted**, **Withdrawn**, **Expired**. You can copy the link
  again, resend it, or withdraw it.
- **Roles** — a read-only summary. Press **Manage roles and permissions** to
  open the roles editor.

**Roles** — Screen: *Administration → Roles & Permissions*. A role is a named
bundle of what a group of people may do. Press **Create role**, then use the
**Permissions** button on a role to choose exactly what it can do. Each
permission reads as a plain action, such as "read students" or "generate
reports".

You may only hand out roles that sit below your own. You cannot make
somebody an equal of yourself, and the top administrator role is never handed
out from the screen at all.

**Audit log** — Screen: *Administration → Audit Log*. Every change the
system records, with who made it, when, what they changed and from where.
Filter by action, by the kind of record, by the member, or search by text.

### Changing what a member may do

Open a member from the **Members** list. Their edit screen has two parts: the
details form, and a **Roles** panel below it.

- **Give {name} a role** — pick the role and, for a branch role, the branch.
  The panel tells you which roles you are able to hand out.
- **Take back the {role} role?** — the panel warns you what ends: *"{name}
  will no longer be able to do what this role allows in {branch}"* or *"across
  the whole college"*. It also tells you that they keep their other roles.
  Press **Take back the role** to confirm, or **Keep the role** to back out.

A change takes effect on that person's very next request. Nobody has to sign
in again.

### Revoking someone's access

See [Revoking a member's access](#revoking-a-members-access) under Common
tasks. This is the one action in the system that touches many things at once,
so the system shows you exactly what will change before you confirm it.

---

## 4. The examination cell (Admin)

**Your job:** the people who enter. You create the students, you approve the
uploads, you correct scores that have gone wrong, and you generate the
reports.

**The one rule that defines your role:** *you decide what a subject is worth;
the teacher writes what a student scored.* You set up the subject, the
breakdown and the pass rules. You do not write the score for a subject a
teacher holds. When a score really is wrong, that is a **correction** — a
separate, reasoned, recorded action. See [Correcting a mark](#correcting-a-mark).

### Adding students

**One at a time** — Screen: *Students → Add student*. Fill in the details and
press **Save student**.

**In bulk** — Screen: *Students → Import CSV*. Choose the branch, scheme,
academic year, batch and semester, choose your file, and press **Import
students**. Your sheet needs a header row with a **Roll No** column and a
**Name** column — nothing else. Everything you choose on the screen applies
to every row in the file. The screen tells you how many were imported and,
if any failed, which rows and why.

**Giving a class its logins** — Screen: *Students → Give a class its
logins*. Choose the class and press **Create the logins**. This creates a
sign-in for every student in one class at once. Students then see their own
result, their class's toppers and their own profile.

**The temporary passwords are shown once.** The screen says: *"Shown once.
Read each one out to the student — it is not emailed and cannot be shown
again."* Write them down or read them out before you leave the screen.

The screen reports the run: how many logins were created, how many existing
accounts were linked, how many students were skipped and how many failed. A
student whose record has no email address can be skipped instead of stopping
the whole run — tick *"Skip students whose record has no email address, and
list them afterwards, rather than stopping at the first one."*

### The student profile

Open any student from the **Students** list by clicking their name. The
profile is one page with clearly separated sections:

- **Identity and profile** — name, roll number, branch, scheme, batch,
  semester, year of study, academic year, admission year, section, date of
  birth, gender, status, phone, email, alternate email, address, reserved
  category, fee category, scholarship, and whether they have a login.
- **National identity number** and **Blood group** — only the examination
  cell and the student themselves can see these.
- **Guardians** — name, relation, phone, email and occupation of each
  guardian.
- **Academic snapshot** — the student's current standing.
- **Marks history** — every subject and every component, per semester, with
  the subject's maximum and pass mark alongside so you can judge the score at
  a glance.
- **Result history** — per semester: total, aggregate, credits earned, grade
  and pass or fail.

A section you are not entitled to see is simply not there. It is never shown
empty.

### Entering marks

See [Entering marks](#entering-marks) under Common tasks.

### Approving an upload

See [Uploading a result statement](#uploading-a-result-statement) under
Common tasks.

### Correcting a mark

See [Correcting a mark](#correcting-a-mark) under Common tasks.

### Generating a report

See [Generating a report](#generating-a-report) under Common tasks.

### Publishing a result

See [Publishing a result](#publishing-a-result) under Common tasks.

### Publishing notifications

There is no screen for this yet. The system can hold notifications and can
send them, but the examination cell has no button to compose one and the
members have no screen to read them. See [Known gaps](#known-gaps).

---

## 5. The Head of Department (HOD)

**Your job:** your branch. You decide who teaches what, who looks after
each class, and you keep an eye on how your branch is doing.

**Your job is not:** writing scores. You allocate the teachers; they write
the marks.

Everything you see is limited to your own branch. You never have to choose a
branch filter — the system knows which branch you are in.

### Allocating teachers

**Screen:** *Administration → Assignments → Subject allocations*.

Choose your branch, then the semester, scheme and academic year. The list
shows who teaches which subject.

To give a teacher a subject, press **Assign teacher**, choose the teacher,
the subject and the academic year, and press **Assign teacher**. The
allocation applies to your branch.

The allocation is what lets a teacher enter marks for that subject. A teacher
can hold as many allocations as they need.

To take one away, press the bin icon on the row. The confirmation says:
*"Remove {teacher} from {subject}? The teacher will no longer be able to
enter marks for it."* The marks they have already entered are **kept**, and
still carry their name as the author.

### Assigning class teachers

**Screen:** *Administration → Assignments → Class teachers*.

A **class** is one branch, in one semester, under one scheme, in one
academic year. Every class has exactly one class teacher. The class teacher
sees that class's roster, its standing and its statistics.

To appoint a class teacher, press **Assign class teacher**, choose the
teacher, semester, scheme and academic year, and press **Assign class
teacher**.

**If the class already has a class teacher**, the screen says so and names
them: *"{name} is already the class teacher of this class. Replacing them
ends their access to this class's statistics."* Tick the box *"I understand
this replaces {name} as the class teacher of this class"* and press
**Replace class teacher**. The system refuses an unconfirmed replacement, so
nobody loses access to a class by accident.

To remove a class teacher, press the bin icon. The confirmation says:
*"Remove {teacher} as the class teacher for semester {n}? The class will have
no class teacher until one is assigned."*

### Classes that need a class teacher

At the top of the **Class teachers** tab, a banner lists any class that has
students but nobody looking after them: *"1 class needs a class teacher"* or
*"3 classes need a class teacher"*, followed by *"These classes have
students, but nobody is looking after them. Assign a class teacher so the
class's results and statistics can be seen."* Press **Assign** on the row to
fill the gap.

### Your branch's students and marks

- **Students** — Screen: *Students*. You see your branch's students, with
  the same filters as everybody else. A student from another branch is not in
  the list and cannot be opened.
- **Marks** — Screen: *Marks*. You can read the marks of your branch, but you
  cannot write them. Writing is the teacher's. The screen opens read-only for
  you: the marks are shown, the cells cannot be typed in, and there is no
  **Save** button.
- **Reports** — Screen: *Reports*. You can generate and download reports for
  your branch.
- **Analytics** — Screen: *Analytics*. The pass rate, the average, the
  subject-by-subject picture, and the trend over time.
- **Toppers** — Screen: *Toppers*. The highest achievers per subject and
  across the class.
- **Subjects** — Screen: *Administration → Subjects*. You can create
  subjects and adjust which subjects your branch offers in which semester.

---

## 6. The Principal

**Your job:** to see the whole academic picture, without changing anything.

You have no write access at all. There is no button on any screen that
creates, edits or deletes anything. Every screen you can open is a
reading screen.

### What you can see

- **Overview** (your dashboard) — the key figures for the college: total
  students, pass percentage, total subjects, average percentage, and charts
  of the same. A note at the top says if any figure could not be computed.
- **Students** — the roster, with the search and filters.
- **Student profiles** — the identity and profile section, the guardians, the
  academic snapshot, the marks history and the result history.
- **Marks** — read only. The screen opens for you: the marks of a class are
  shown, the cells cannot be typed in, and there is no **Save** button.
- **Reports** — you can download an existing report. You cannot generate one.
- **Analytics** — the college-wide pass and fail picture, subject difficulty,
  and performance trends.
- **Toppers** — per subject and per class.
- **Branches**, **Schemes**, **Subjects** — the configuration, read only.
- **Audit Log** — who changed what, when and from where. This is read only
  too.

### What you deliberately cannot see

**The national identity number and the blood group of a student.** These are
sensitive identity records, and they are recorded and read by the examination
cell alone — the office that captures them in the first place. The section is
not shown to you empty; it is not there at all.

You also cannot change a student's record, allocate a teacher, correct a mark,
or generate a report. If the Principal's office needs one of those, the
examination cell or the HOD does it.

---

## 7. The Teacher

**Your job:** to write what your students scored, for the subjects allocated
to you, and to keep an eye on your class.

### What you can do

- **Enter marks** for the subjects allocated to you, and no others.
- **Upload a result statement** for your subjects.
- **Read** your own students and your own class.
- **See your class's standing** if you are a class teacher.
- **Read** the analytics, the toppers and the branch's subjects.

### What you cannot do

- You cannot write marks for a subject you have not been allocated. The
  system will say so by name.
- Being a **class teacher** does not let you write marks. Those are separate
  jobs, and only the allocation lets you write.
- You cannot add, edit or delete students.
- You cannot allocate teachers or appoint class teachers.
- You cannot correct a teacher's mark. Only the examination cell can do that.

### Entering marks

**Screen:** *Marks Entry*. The class bar at the top tells you which class you
are working on. Choose the **Subject** and the **Component** (CA 1, CA 2,
Mid semester, Written, Practical or Oral), set the **Maximum marks for this
component**, and type the marks into the grid.

Two things worth knowing:

- The grid opens showing the marks **already on record**. You are editing
  what is there, not replacing it with a blank sheet.
- Only the cells you actually change are saved. If you type into CA 1 and
  then switch to CA 2, your CA 1 entries are still there and are still
  waiting for you to save.

Tick the **Absent** box for a student who was not present. An absent mark is
not a zero, and the system treats it differently.

Press **Save {n} marks**. The button tells you how many marks are waiting to
be saved. If the save is refused, nothing is saved — not even part of it.

### When you are not allocated to a subject

If you pick a subject you have not been allocated, the system refuses and
names the subject: *"You are not allocated to Computer Networks, so you
cannot enter its marks."*

Ask your Head of Department to allocate it to you on *Administration →
Assignments → Subject allocations*. Once they have, the subject appears in
your **Subject** list.

### Uploading a result statement

**Screen:** *Upload Results*. See [Uploading a result statement](#uploading-a-result-statement).

### Your class

**Screen:** *Class Overview*. If you are the class teacher of one class, it
shows:

- **Students**, **Subjects**, **Class average** and **Passed** — the four
  figures at the top.
- **Class standing** — the highest and lowest percentage, how many failed,
  how many are still awaiting marks, and a breakdown of full marks, missing
  marks, passed and failed.
- **Subject-wise standing** — for each subject, the average, the highest, the
  topper and how many passed.
- **Class roster** — every student with their total, percentage, number of
  subjects, and the subjects they failed or are missing.

If you hold more than one class, a **Class** picker appears at the top and
the first one is selected for you.

If you are not a class teacher of anything, the screen says so plainly:
*"You are not a class teacher"*, followed by *"Once a class teacher is
assigned to a class, it appears here with its roster and statistics."*

### Your uploads

**Screen:** *Upload History*. Every result file that has been processed,
newest first, with its status, who uploaded it and when. Filter by status.

---

## 8. The Student

**Your job:** to see your own result and your class's leaderboard.

You can open four things and nothing else. The college's roster, the mark
sheet, the reports and the administration are all closed to you.

### My Result

**Screen:** *My Result*. Your marksheet for the current examination.

From the top:

- **Your details** — name, roll number, academic year, and whether the
  result has been published and when.
- **Result summary** — four figures: **Percentage** (with the marks out of
  the total beneath it), **Result** (Pass or Fail, with how many subjects
  you still need to clear, or *"All subjects cleared"*), **Credits earned**
  (out of the total, with *"Credit points earned this semester"*), and
  **Subjects graded**.
- **Subjects to clear** — if you have any failures, they are listed here
  first, with the reason and a **Not cleared** label.
- **Subject-wise marks** — every subject with its credits, marks and
  percentage.
- **Component-wise breakdown** — every subject split into its parts
  (CA 1, CA 2, Mid semester, Written, Practical, Oral), with a status of
  **Entered**, **Absent** or **Withheld**.
- **Class toppers** — your class leaderboard by rank, roll number, name,
  total and percentage. Your own row is marked **You**.

If nothing is there yet, the screen says so: *"No result available — Your
result will appear here once it has been declared."*

### Toppers

**Screen:** *Toppers*. Two tabs, **Subject toppers** and **Class toppers**.
You see your own class only.

### My account

**Screen:** *My account*. Your name and your profile picture. You can change
your name; your email address cannot be changed here.

---

## 9. Common tasks

### Adding a student

**Who:** the examination cell.

1. Go to **Students**.
2. Press **Add student**.
3. Fill in the details — at minimum the name, roll number, branch, scheme,
   semester and academic year.
4. Press **Save student**.

You are returned to the student list, where the new student appears.

**If the roll number is already used for that year**, the system refuses and
tells you: *"Roll No "42" already exists for this academic year."*

### Importing a roster

**Who:** the examination cell.

1. Go to **Students**, then **Import CSV**.
2. Your sheet needs a header row with a **Roll No** column and a **Name**
   column. Nothing else is needed.
3. Choose the **Branch**, **Scheme**, **Academic year** and **Batch**. These
   apply to every row in the file.
4. Choose the **Semester**. The **Year** is shown for reference and is worked
   out from the semester, so the two can never disagree.
5. Choose your file.
6. Press **Import students**.

You are taken to the student list when the import succeeds. If some rows
failed, the screen tells you how many succeeded and how many failed, and
lists the reason for the first ten failures.

### Allocating a teacher to a subject

**Who:** the Head of Department.

1. Go to **Administration → Assignments**.
2. Choose your branch, then the semester, scheme and academic year.
3. Press **Assign teacher**.
4. Choose the **Teacher**, the **Subject** and the **Academic year**.
5. Press **Assign teacher**.

The teacher can now enter marks for that subject, and only for that subject.

**If the teacher already has that subject for that year**, the system
refuses: *"This teacher is already allocated to that subject for this year."*

### Assigning a class teacher

**Who:** the Head of Department.

1. Go to **Administration → Assignments → Class teachers**.
2. Choose your branch, semester, scheme and academic year.
3. Press **Assign class teacher**.
4. Choose the **Class teacher** and press **Assign class teacher**.

If the class already has a class teacher, the screen names them, tells you
that replacing them ends their access to the class's statistics, and asks
you to tick *"I understand this replaces {name} as the class teacher of this
class"* before it will let you save.

### Entering marks

**Who:** the teacher (for their allocated subjects).

1. Go to **Marks Entry**.
2. Check the class bar at the top — the branch, scheme, semester and
   academic year you are working on. Change it there if you need to.
3. Choose the **Subject**.
4. Choose the **Component** — CA 1, CA 2, Mid semester, Written, Practical or
   Oral.
5. Set **Maximum marks for this component**.
6. Type the marks into the grid. Tick **Absent** for anyone who was not
   present.
7. Press **Save {n} marks**.

Only the cells you changed are saved. If the save fails, nothing is saved.

**Deleting a mark** is done on the same screen by the same person who entered
it.

### Uploading a result statement

**Who:** the teacher (for their own subjects) and the examination cell (for
any subject).

1. Go to **Upload Results**.
2. Pick your branch, scheme, academic year and semester in the class bar.
   The uploader stays disabled until they are all set, because the extracted
   rows are matched against that class.
3. Drop in an Excel, CSV or PDF file (up to 50MB), or click
   **Click to upload**.
4. Wait. The screen says *"Queued for processing — this can take up to a
   minute"*, then *"Parsing marks, mapping to scheme…"*.
5. **Review the table.** It shows Roll No, Subject, Exam and Marks, with the
   marks shown out of their maximum. Nothing has been written yet.
6. Press **Confirm and save**.

If some rows could not be read, the screen says how many will be skipped and
lists the first five with the reason.

If your role cannot turn the extracted rows into marks, the screen says so:
*"Extracted rows are ready. A member who can write marks must confirm them."*

**To see your past uploads**, go to **Upload History**.

### Correcting a mark

**Who:** the examination cell only.

This is for changing a score a teacher has entered. It is not the ordinary
mark-entry path, and it leaves a trail.

1. Go to **Marks Entry**, pick the subject and component, and press
   **Correct a mark**. (Or go straight to *Marks → Correct a mark*.)
2. Choose the **Subject**, the **Student** and the **Component**.
3. The screen shows the mark as it currently stands: *"The mark currently
   reads 18 out of 20. The value you enter replaces it, and the original
   stays on record."*
4. Type the **Corrected marks**.
5. Type the **Reason** — *"Why is this being corrected?"* At least ten
   characters. It is shown to the teacher whose mark was changed, and kept
   in the audit trail. For example: *"the answer sheet was marked twice and
   the second marking was correct."*
6. Press **Save the correction**.

**What is kept:** the original value, the new value, your reason, the name of
the teacher whose work was replaced, and your own name against the change.
Nothing is overwritten silently.

**Two cases this screen will not handle:**

- *"There is no mark to correct here — This student has no mark entered for
  this component. If the mark is missing entirely, add it on the Marks Entry
  screen instead."*
- *"This student was marked absent — An absent mark is changed on the Marks
  Entry screen, not here. A correction is for changing a score that was
  entered."*

### Generating a report

**Who:** the examination cell and the Head of Department.

1. Go to **Reports**.
2. The class bar at the top chooses the class — branch, scheme, semester and
   academic year. The report is generated for exactly that class.
3. Choose the **Report type**: Student-wise result, Scheme-wise marks,
   Subject analysis, Class toppers, or Pass / fail analysis.
4. The screen checks whether every student's result is in. When it is:
   *"Every student's result is in (42 of 42). The report can be generated."*
5. Press **Generate report**.

The report appears in **Recent reports** with a status of **Queued**,
**Generating**, **Ready** or **Failed**. Press **Download** when it is
Ready.

**If the results are not all in**, the button stays disabled and the screen
tells you what is missing. The heading reads *"Result not available yet"*,
followed by *"Result not available yet — 8 of 42 students still have marks
missing in 2 subjects."* Below that, the screen lists **Marks still missing**
and **Students awaiting marks ({n})**, naming the students and the subjects
they are waiting on.

**Two other cases the screen will tell you about:**

- *"This class has no subject offerings yet, so there is nothing to report.
  Map the subjects to the class first."*
- *"This class has no students, so there is nothing to report."*

**You can generate five reports an hour.** Past that, the screen says to wait.

**Archiving a report** — press the archive icon on a report. The dialog says:
*"The report will be taken out of the list and its file released. The record
of the report — when it was made, by whom, and why it was archived — is
kept."* You must type a reason of at least ten characters before **Archive
report** becomes available. A report is never destroyed; it is archived, and
the reason and your name are kept with it.

### Publishing a result

**Who:** the examination cell.

This is the last step of the college's cycle. Everything before it produces a
working sheet of marks; publishing makes the result the college's answer.

1. Go to **Administration → Publish results**.
2. The class bar at the top chooses the class — branch, scheme, semester and
   academic year. The examinations for that class are listed.
3. Each row shows how the result stands:

   - *"All 42 students have a result"* — the result is ready to be published.
   - *"36 of 42 students have a result"* — six students are still missing
     something.

4. Press **Publish result**. A dialog asks *"Publish this result?"* and says
   what is about to happen: *"Once published, this result is the college's
   answer for the class. Every student's result is included, and the
   publication is recorded with your name."* Press **Publish the result**.

5. The row's status becomes **Published**, with the date and time it was
   published.

**If the result is not complete**, the button stays disabled, and the
screen says how many students are missing. If you try anyway, the system
refuses: *"6 students in this class do not have a complete result yet, so it
cannot be published. Enter the missing marks first."*

**Publishing the same result twice** is refused: *"Computer Science —
Semester 3 — 2024-25 has already been published. Publish it again only if
the marks have changed since."*

**If a mark turns out to be wrong after the result has gone out**, press
**Return to working**. The dialog says: *"The result stops being the
college's answer while the marks are being fixed. The marks themselves are
not changed by this — a mark that needs changing is corrected on the Marks
Entry screen."* Correct the mark on the Marks Entry screen, then publish
the result again.

### Revoking a member's access

**Who:** the college administrator.

1. Go to **Administration → Members**.
2. Find the member and press the revoke icon on their row.
3. The system works out the consequences and lists them as sentences, for
   example:
   - *"Ramesh Kumar will be signed out immediately and will not be able to
     sign in again."*
   - *"2 subject allocations will be released: Computer Networks (Computer
     Science & Engineering, Semester 5), Data Structures (Computer Science &
     Engineering, Semester 3). The marks they entered are kept and still
     show their name as the author."*
   - *"1 class will have no class teacher: Computer Science & Engineering,
     Semester 5 (2024-25). These classes will be marked "class teacher
     required" until you appoint someone."*
   - *"Their roles will be removed: Teacher."*
   - *"Their history is kept, so anything they did before is still
     traceable."*
4. Type the reason under *"Why is this being done?"* — at least ten
   characters. It is kept in the audit trail against your name.
5. Press **Revoke access**.

**What happens:** the person is signed out at once and cannot sign in again.
Their subject allocations are released, their class-teacher classes lose
their class teacher, their roles are removed, and any invitation still
waiting for a reply is withdrawn. Their **history is kept** — the marks they
entered stay, with their name as the author, and everything they did remains
traceable.

**Restoring them** is a separate action on the same screen. The dialog says:
*"This makes their account usable again. The subjects and roles they held are
not given back automatically — you re-apply those yourself."* A reason is
required here too.

### What a class teacher does when one is revoked

When the class teacher of a class is revoked, that class loses its class
teacher. The system does not quietly assign someone else, because that would
hand a colleague authority over a class nobody asked them to look after.

Instead, the class is flagged so the gap is visible:

- On **Administration → Assignments → Class teachers**, a banner reads
  *"1 class needs a class teacher"* or *"3 classes need a class teacher"*,
  followed by *"These classes have students, but nobody is looking after
  them. Assign a class teacher so the class's results and statistics can be
  seen."*
- The class is marked *"class teacher required"* wherever it appears until
  somebody is appointed.

**What the class teacher should do:**

1. Go to **Administration → Assignments → Class teachers**.
2. Find the class in the banner at the top.
3. Press **Assign** on that row.
4. Choose the new class teacher and press **Assign class teacher**.

**If you are the class teacher yourself** and you are about to leave, ask
your Head of Department to appoint a replacement *before* your access is
revoked. That way the class never has a gap, and the replacement is a
confirmed replacement rather than a repair.

---

## 10. When something goes wrong

Every message below is written to be read by you, not by a developer. Here
is what each one means and what to do about it.

### "You do not have access to this screen"

Your role does not include this part of the system, or it belongs to a branch
you are not part of.

**What to do:** press **Back to the dashboard**. If you genuinely need this
screen for your work, ask an administrator to give you the relevant access.
Nothing is broken — the system is showing you only what your work involves.

### "You are not allocated to {subject}, so you cannot enter its marks."

You tried to enter marks for a subject you have not been allocated.

**What to do:** ask your Head of Department to allocate that subject to you
on *Administration → Assignments → Subject allocations*. Until they do, you
will not be able to enter its marks — and this applies even if you are the
class teacher for that class.

### "{Subject} is entered by {teacher}. To change it, use "Correct marks" and
give a reason — the change is recorded against your name."

You are the examination cell and you tried to write a mark for a subject a
teacher holds.

**What to do:** this is the exam cell's rule working as intended. Use
**Correct a mark** instead, and give a reason. See
[Correcting a mark](#correcting-a-mark).

### "Only the examination cell can correct marks that a teacher has entered."

You are not the examination cell.

**What to do:** ask the examination cell to make the correction. They are the
only office that may change a teacher's score, and only with a recorded
reason.

### "That student is not in the class this subject is taught to, so their mark
cannot be entered here."

The student you picked belongs to a different class from the subject.

**What to do:** check the class bar at the top of the screen. Either change
the class, or pick a student from that class.

### "This student record no longer exists. It may have been removed from the
register." / "That student no longer exists."

The record has gone.

**What to do:** press **Back to students** and look for the student again.
It may have been archived by the examination cell.

### "That subject offering no longer exists."

The subject is no longer offered in the class you are looking at.

**What to do:** go back to **Subjects → Offerings by semester** to see what
is offered now.

### "Roll No "{roll}" already exists for this academic year."

Two students cannot share a roll number in the same year.

**What to do:** check the roll number on the record you already have. If the
roll number is right on both, one of them must be corrected before you can
save. On the **Import CSV** screen, each such row is listed with its row
number and this reason.

### "A subject with code "{code}" already exists."

**What to do:** open the existing subject instead of creating a second one.

### "This subject is already offered in that branch, semester and scheme."

**What to do:** open the existing offering and edit it, rather than adding a
second one.

### "This teacher is already allocated to that subject for this year."

**What to do:** nothing is wrong. The teacher already has this subject. Open
the existing allocation if you need to change the year.

### "{Teacher} is already the class teacher of this class. Replacing them ends
their access to this class's statistics. Confirm the replacement to go
ahead."

Somebody tried to appoint a second class teacher for a class that already
has one.

**What to do:** if the replacement is intended, go back to the screen and
tick the box confirming it. If it was a mistake, cancel. A class has exactly
one class teacher, and nobody loses access to a class by accident.

### "The two passwords do not match."

**What to do:** retype the new password in both boxes.

### "Your email or password is incorrect."

**What to do:** check the address and the password. If you are sure, press
**Forgot password?** and reset it.

### "Give a reason for the correction. It is recorded against your name and
shown to the teacher whose mark was changed."

You tried to correct a mark without saying why.

**What to do:** write at least ten characters explaining the correction. The
reason is what makes the change explainable later.

### "Too many attempts. Please try again in {n} minutes."

You have tried too many times in a row — for signing in, for a password
reset, or for generating reports.

**What to do:** wait the time shown and try again. This is a safety measure
against someone guessing a password or flooding the system with report
requests.

### "Something went wrong on our side. Please try again."

Something failed on the server. Your work was not saved.

**What to do:** press **Retry** on the message. If it keeps happening, note
the reference code that appears with the message and give it to the
administrator — they can find it in the server log.

### "We could not reach the server. Check your connection and try again." /
"The server took too long to respond."

The request never got to the server, or the server did not answer in time.
This is **not** a fault in the application, and nothing you typed has been
saved.

**What to do:** check your internet connection and press **Retry**. If you
were on a large upload, the file may have been too big or too slow — try
again on a better connection.

### "That request could not be read. Please try again."

The server could not understand what was sent.

**What to do:** press **Retry**. If it keeps happening, the file may be
corrupted — download it again and re-upload.

### "We hit an unexpected error rendering this page. You can try again, or
head back to the dashboard."

The screen failed to draw itself. Nothing you did was lost, but nothing was
saved either.

**What to do:** press **Retry**. If it keeps happening, go back to the
dashboard and work from there.

### "Working out what this will affect…" then "Could not work out what this
will affect, so the change was not made."

The system was working out the consequences of a revocation and could not
finish.

**What to do:** press **Retry**. Nothing has been changed yet, so it is safe
to try again.

### "We could not load your result. Please try again, or contact the
examination cell."

Your result could not be fetched.

**What to do:** press **Retry**. If it keeps failing, contact the
examination cell — they can check whether the result has been published.

### "The report is generated once every student's result is in."

The **Generate report** button is disabled because some students have no
complete result.

**What to do:** press the "Students awaiting marks" section to see exactly
who is missing what, and chase those marks first. The screen also lists the
subjects with missing marks.

### "Upload failed. Re-upload the file to retry." / "No rows were extracted.
Re-upload a clearer file."

The file could not be read.

**What to do:** check the file has a header row and the columns the screen
expects, and that it is not a photograph of a page. Then upload it again.

### "A scanned or photographed document will not work, and neither will a
spreadsheet." (on the syllabus reader)

The syllabus PDF must be a text PDF — the one downloaded from the
university's website, not a scan or a photo.

**What to do:** download the PDF from the university site and try again. If
you only have a scan, use **Add a subject by hand** instead.

### "Pages {n} could not be checked. Look at those pages yourself."

Part of the syllabus PDF could not be safety-checked before it was read.

**What to do:** open those pages of the PDF yourself and compare them with
the rows in the review table before you save.

### "That file type is not supported here. Upload a {PDF / Excel or PDF}
file."

**What to do:** use the file type the screen asks for.

---

## 11. Known gaps

These are the parts of the cycle that are not finished. They are listed here
so that nobody waits for a button that is not there.

**Sending a notification has no screen.** The examination cell holds the
right to create a notification, and members can read and dismiss the ones
they receive, but there is no composer and no inbox in the menu.

**A student without an email address cannot be given a login.** To sign in,
a student needs an email address on their record. If it was never captured,
the login cannot be created, and the bulk-provisioning screen says so.

---

## 12. Glossary

**Academic year** — The college year, such as 2024-25. It has a start date
and an end date, and exactly one year is *running* at a time. The system
works out the running year from today's date, so every screen starts on the
right one. You choose a different year when you are looking back at history.

**Scheme** — The university's published way of evaluating a subject. It says
what each part of the subject is worth (for example, internal assessment out
of 20 and end-semester exam out of 60), how many marks a student must score
in each part, and how many they must score across the subject in total to
pass. A college may run more than one scheme, one for each year the
university changed its regulations.

**Subject** — A course in the catalogue. Its code, name, credits, maximum
marks and passing marks. A subject exists once, however many branches teach
it.

**Offering** — A subject *taught* to a particular branch in a particular
semester under a particular scheme in a particular academic year. The
offering is what marks are entered against. "Computer Networks in Computer
Science, Semester 5, 2024-25" is an offering; "Computer Networks" is the
subject.

**Class** — One branch, in one semester, under one scheme, in one academic
year. The class is what a report is generated for and what a class teacher
looks after. The class bar at the top of the screen shows the class you are
working on.

**Class teacher** — The one teacher responsible for a class. They see that
class's roster, its standing and its statistics, and they are the person who
chases missing marks. Every class has exactly one. A class teacher does not
write marks unless they are also allocated to the subject.

**Class context** — The branch, scheme, semester and academic year you are
working on. It is chosen once and shared by every screen, so you are always
working on the same class as you move around. The bar at the top of the
screen shows it and lets you change it.

**Allocation** — The link between a teacher and a subject offering for an
academic year. It is what gives a teacher the right to enter marks for that
subject, and only for that subject. Being a class teacher is a separate
thing and does not carry this right.

**Correction** — The examination cell changing a score that a teacher
entered. It is a different action from entering marks: it needs a written
reason, it is recorded against the name of the person who made it, and it
keeps the value it replaced — along with the name of the teacher whose work
it replaced — on record.

**Archive** — Putting a record aside instead of destroying it. Reports and
students are archived, never deleted. An archived report leaves the working
list but its record — when it was made, by whom, and why it was archived —
is kept.

**Batch** — The group of students who were admitted together, identified by
the year they joined the college. A batch is different from an academic year:
a student admitted in 2022 is in the 2022 batch while studying in the 2024-25
academic year.

**Semester** — The unit the college works in, numbered 1 to 8. The year of
study is worked out from it (Semesters 1–2 are Year 1, 3–4 are Year 2, 5–6
are Year 3, 7–8 are Year 4), so a semester and a year can never disagree.

**Component** — One part of a subject's assessment: CA 1, CA 2, the
mid-semester exam, the written paper, the practical or the oral. A subject's
marks are recorded component by component.

**Audit log** — The record of who changed what, when, and from where. It is
written by the system as changes happen, and it cannot be edited.
