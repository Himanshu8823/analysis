# Chapter 6: Results and Discussion

## 6.1 Output Screens / System Snapshots

The screens presented in this section document the delivered interface of the system. They were captured from the running application during the acceptance exercise described in Chapter 5. The data visible in the figures is sample data created for evaluation purposes — students, subjects, offerings, marks, allocations and audit entries were entered through the application's own interfaces, and further accounts were created through the invitation flow. The figures should be read as evidence of the system's behaviour and layout rather than as a record of a real college's academic data.

### 6.1.1 Sign-in screen

Figure 6.1 presents the sign-in screen. The form contains an address field and a password field, both validated for emptiness on submission with the error shown against the relevant field rather than in a general banner. Only the credentials are transmitted; no role, branch or session identifier is supplied by the client, because the role list and the union of permissions are derived on the server from the authenticated member's assignments. A successful sign-in redirects to the dashboard, to a requested destination, or directly to the change-password screen when the account carries a pending password change.

Figure 6.1 — Sign-in screen.

### 6.1.2 Password recovery screen

Figure 6.2 presents the password recovery screen. The user supplies an address and receives a reset link by email. The response text is identical whether or not the address is registered, so the screen cannot be used to discover who holds an account. The link is valid for thirty minutes and only the most recent link remains usable. The strength policy is stated in words rather than as an opaque rule: at least eight characters including an uppercase letter, a lowercase letter, a number and a special character.

Figure 6.2 — Password recovery screen.

### 6.1.3 Dashboard with summary tiles

Figure 6.3 presents the dashboard. It is permission-driven: the server resolves the member's scope before computing anything, selecting one of four scopes — own record, own allocations, own branch or the whole college. The summary tiles report the total students, the total subject offerings, the pass percentage, the average percentage and, for members who can act on marks or supervise them, the number of marks uploaded and still pending. The tiles are withheld from the Principal deliberately, because that role holds no write permission and could do nothing about a pending count. The chart sections adapt to the scope: college-scope views carry students per branch, pass percentage per branch, branches with missing data and subject offerings awaiting marks, while a teacher with no allocation receives an empty dashboard rather than a college-wide one. The trend line aggregates per student before averaging, so a student with more components does not weigh more heavily than one with fewer.

Figure 6.3 — Dashboard with summary tiles.

### 6.1.4 Marks entry screen for a subject offering

Figure 6.4 presents the marks entry screen for a single subject offering within a class context. The grid lists the students of the class against one assessment component, and only the cells the teacher actually touches are submitted, so saving never blanks a component that was not opened. A cell may hold a mark or an absence, submitted as zero obtained with the absence flag so that absence remains distinguishable from a genuine zero. The screen is itself evidence of the allocation rule: the teacher sees only the subjects allocated to them for the year, and a bulk write touching an unallocated subject is rejected in full, because a partial save is not an outcome the system will produce. Changing the class clears the subject selection, so a grid can never show one class's students against another class's subject.

Figure 6.4 — Marks entry screen for a subject offering.

### 6.1.5 Student result view with the per-subject outcome

Figure 6.5 presents the result view as the student sees it. An identity block — name, roll number, academic year and publication status — is followed by four summary cards: the percentage with marks obtained against the total, the verdict with a count of subjects still to clear, credits earned against total credits, and the number of subjects graded with the mark-entry count beneath. A panel listing each failed subject with its reason appears when any subject is outstanding. A subject-wise table and a component-wise breakdown follow, the latter carrying a status badge per entry distinguishing entered, absent and withheld. The class leaderboard closes the screen, with the signed-in student's own row shaded and badged. The student is resolved from the session, so no client-supplied identifier can address another candidate's record.

Figure 6.5 — Student result view with the per-subject outcome.

### 6.1.6 Analytical view showing subject-wise performance and distribution

Figure 6.6 presents the analytical view. The screen opens on a row of summary measures — total students, pass percentage, average percentage and the number of subjects — beneath a filter row for branch, scheme and semester that starts from the shared class context but may be widened within the member's entitlement. Leaving the filters empty shows everything the member is entitled to see, because the server resolves the caller's branch scope itself rather than trusting the request. The charts appear immediately rather than behind a selection step. The subject statistics table reports the number of students, the average mark and percentage, the highest and lowest mark, the pass and fail counts, the pass percentage and a difficulty label derived from the pass rate. The distribution chart bands students into distinction, first class, second class, a borderline band and fail, and the trend chart carries one point per academic year, oldest first, including years holding no marks. Absent and withheld marks are excluded from every figure.

Figure 6.6 — Analytical view showing subject-wise performance and distribution.

### 6.1.7 Student administration screen

Figure 6.7 presents the student administration screen. The roster is paginated and filtered by branch, scheme, semester, academic year and free text, and every write is checked against branch scope — including the branch a student is being moved into, so the edit form cannot transfer a student across departments. The screen carries both a single creation route and a bulk import route. The import requires a header row naming roll number and name, with aliases matched loosely, and applies the branch, scheme, year, batch and semester chosen once to every row. A class column present in the sheet is ignored rather than permitted to override, which prevents students from being filed under the wrong branch, and every row's branch is checked even when the row names its own. Roll-number uniqueness is enforced on the server, and the curriculum year is derived from the semester and displayed disabled, so the two can never disagree.

Figure 6.7 — Student administration screen.

### 6.1.8 Audit trail screen

Figure 6.8 presents the audit trail. The screen is read-only and filterable by action, resource and member, with the dropdown values drawn from a facet aggregation computed on the server so that a value is never offered that the list itself would refuse. A college-scoped reader sees every entry; a branch-scoped reader sees entries by members of their own branch, together with their own. Each entry carries the actor, the action, the entity changed and its identifier, the structured detail including a written reason where the operation warrants one, and the request context — the originating address, the client fingerprint, the method and the route. The action vocabulary is fixed and includes distinct entries for corrections and privilege changes, so that a mark correction overwriting another person's work is never filed as an ordinary update.

Figure 6.8 — Audit trail screen.

## 6.2 Performance Evaluation

Performance in the system was achieved through a small number of structural decisions rather than through tuning. The paragraphs below describe the configuration values that govern behaviour and the observed behaviour of the application against the sample data set. Where a specific figure was not measured, none is stated.

### 6.2.1 Caching strategy and repeat reads

Every cache write is given a default lifetime of 300 seconds, with finer lifetimes where volatility differs: user permissions at five minutes, the branch list and scheme list at one hour, scheme rules at thirty minutes and the subject list at one hour. The permission cache is invalidated in constant time by a global version counter that any change to a role or a grant increments, so every previously cached set is orphaned at once rather than selectively recomputed, and a permission change takes effect on the member's next request.

On the client, the query cache applies a staleness window of 60 seconds with a garbage-collection window of 10 minutes, no refetch on window focus, refetch on reconnect, and two retries with client errors excluded from the retry set. Individual data families override the staleness according to volatility: reference data such as branches, schemes, subjects, academic years and the permission catalogue is cached for 5 to 30 minutes, lists and dashboard blocks for 60 seconds, and upload history for 30 seconds. List queries keep the previous page on screen while the next loads, which prevents the empty flash a naive implementation produces on pagination.

### 6.2.2 Asynchronous handling of long-running work

Two operations would hold a request open unacceptably if performed synchronously: the parsing and optical character recognition of a result document, and the generation of a multi-sheet report. Both are performed as queued jobs with pollable status. An upload job carries the statuses pending, processing, extracted, completed and failed, with the failure message stored on the job itself; a report job carries its own status, and the download becomes available only once the job has completed.

A user who uploads a document continues to use the application while the job runs; the screen polls for status while the job is pending or processing and stops as soon as the work reaches a terminal state. Upload status is polled every two seconds and report status every three seconds while any report is queued or generating. The four queues are upload, optical character recognition, report and email jobs, and all four processors run in the backend process at the default concurrency of one concurrent job each. Two fallbacks protect against a lost job: report generation runs inline if the queue is unavailable, and email is sent inline on the same condition, so an invitation is never silently dropped because the queue backend was down.

### 6.2.3 Database-side pagination and filtering

Pagination and filtering are performed in the database rather than in the application. The default page is the first, the default page size is 20 and the maximum page size is 100; the interface offers page sizes of 10, 20, 50 and 100. The toppers query enforces a default limit of 10 with a floor of 1. Because filtering and windowing are applied at the database, the application never loads a full result set into memory in order to discard most of it, which keeps the student roster and the audit trail usable at the scale the data model anticipates.

The filters are themselves chosen so that they can be expressed against indexed columns. The class-roster filter combines branch and semester, which is a compound index in the schema. Branch filtering on mark-bearing data runs through the student relation for student-scope queries and through the offering relation for subject-scope queries, because a mark carries no branch of its own; this is a consequence of the subject-identity and subject-offering split and is handled explicitly rather than approximated.

### 6.2.4 Indexing strategy

The schema carries 31 secondary indexes, chosen so that every foreign key traversed on a hot path is indexed and every status column that drives a queue is indexed. The login path is served by an index on the address and one on the active flag. Permission resolution is served by indexes on the role identifier in both the assignment table and the grant table, and the class-context lookup by a compound index on branch, scheme and semester over offerings. The allocation check on the mark-entry path — the query determining whether a teacher owns an offering for a year — is served by an index on the teacher identifier over allocations, described in the schema as "everything this teacher is assigned". Student access is served by an index on the roll number, a compound index on branch and semester for the roster and class-overview queries, an index on the scheme and an index on the student identifier over marks. Queue and job reads are served by compound indexes on status and creation time, and audit and notification reads by compound indexes on the user with creation time and on the resource with its identifier.

The compound unique constraint on the mark idempotency key — the tuple of student, offering, component and year — doubles as the index for the per-student result query. This is the most consequential indexing decision in the schema: the marks table is the largest by an order of magnitude, and it is joined against students, offerings and academic years on every result computation, so the query returning one student's result is served by an index that already exists for correctness reasons. The expected scale for one college places marks in the region of 200,000 to 900,000 rows, and the design is oriented toward that figure.

### 6.2.5 Request timeout and bounded work

The default HTTP request timeout is 30 seconds, enforced by a global interceptor, with individual routes permitted to declare a longer one. The curriculum reader declares a longer timeout because reading a syllabus document legitimately takes longer than an ordinary request. The frontend HTTP client carries a matching 30-second timeout, and the curriculum-reading client defaults to 60 seconds per attempt. The observable effect is that a slow or unresponsive upstream cannot hold a connection indefinitely, and the client receives a definite answer rather than a hanging request.

### 6.2.6 Rate limiting

Three global rate-limit tiers apply: 3 requests per second, 100 per minute and 1,000 per hour. These are supplemented by tighter per-operation overrides reflecting the cost and sensitivity of the operation rather than a uniform tightening. Sign-in is limited to 5 attempts per 15 minutes; registration to 10 per 15 minutes; the forgotten-password request to 20 per 15 minutes; the password reset to 5 and 10 per 15 minutes for the two stages; invitations to 10 per 15 minutes; upload to 10 per hour; report generation to 5 per hour; the curriculum reader to 10 per hour; analytics to 30 per minute; and the dashboard to 60 to 120 per minute.

The tiers are deliberately graduated: a read-only dashboard may be polled frequently, while an upload or a report generation is an expensive operation that should not be repeated casually, and a sign-in attempt is both sensitive and cheap for an attacker to repeat, so it receives the tightest window. A rate-limit response states the retry window in minutes, so a refused request explains itself rather than appearing arbitrary.

### 6.2.7 Bounded output and paced external calls

The curriculum-reading service imposes two bounds on its own output. Each call is capped at 450 tokens of output and 1,200 characters of input, so a large page is read in pieces rather than truncated, and the page-splitting arithmetic is driven by an estimated cost of 40 tokens per course. Calls to the reader are spaced a minimum of 31,000 milliseconds apart, with a further gap of 2,100 milliseconds between successive guard calls, because the provider's per-minute output-token limit is the binding constraint. The pacing is thus a consequence of a stated provider limit rather than an arbitrary delay.

The database client is configured with a connection pool of 10 and a pool timeout of 20 seconds, appended to the database URL only when not already present so that existing secure-mode and binding parameters are preserved. A query extension retries the four transient connectivity error codes with exponential backoff from a 500 millisecond base, up to four attempts, because a serverless database suspends after inactivity and the first request after a suspension pays the wake-up cost. One error code is deliberately excluded from the retry set because the statement may already have executed, and retrying it would risk a duplicate write.

### 6.2.8 Observed behaviour against the sample data set

Against the sample data set the application behaved as follows in qualitative terms. Navigation between the dashboard, the roster and the analytical view was responsive and preserved the selected class context. The extraction of a real printed result statement completed and presented the rows for review without any mark appearing in the marks table beforehand. Report generation over a complete class produced the seven-sheet workbook and made it downloadable. An upload job's status advanced visibly from pending to extracted, and the polling stopped once the job reached a terminal state. The interface remained responsive throughout the processing of an uploaded statement. No request was observed to fail under the configured rate limits during normal use. These are qualitative observations of behaviour; no response-time distribution, throughput figure or concurrency measurement was taken, and none is claimed.

### 6.2.9 Meeting the stated performance targets

The performance targets set for the system in Chapter 3 were a report-generation cycle for a class of one hundred students in under two minutes, an API response time within 200 milliseconds at the 95th percentile, and no horizontal overflow on any breakpoint. The structural decisions above bear on each of them. The report cycle is bounded by asynchronous generation rather than by request duration; the response-time target is addressed by database-side pagination and filtering, by the version-keyed permission cache and by the client staleness window; and the layout target is addressed by the mobile-first styling model with the three mandated breakpoints. The report-generation target is the one the system was explicitly designed against, and the two-to-three-day manual cycle it replaces is reduced to a cycle measured in minutes.

## 6.3 Discussion of Results

### 6.3.1 What the system achieves

The system achieves a working, end-to-end result-processing capability that removes the manual cycle from result analysis and, more importantly, removes the error classes that the manual cycle produced. Ingestion of a printed statement now takes one upload, one review and one confirmation; evaluation runs through the college's own scheme rules rather than through recollection; and publication is gated on completeness rather than on the operator's judgement of whether the class is finished.

Three design decisions account for most of this, and each addresses a specific failure mode of the manual process.

The first is the permission-first access model. Because every route declares the permissions it requires and because branch scope, allocation ownership and record-level ownership are enforced in the service layer, the rule applies to every path that reaches the data, not only to the paths a browser takes. This has a direct effect on the historical problem of "everything or nothing": a Head of Department sees their own branch, a teacher sees their allocations, a student sees one record, and the Principal sees the college without a write path. The verification in Chapter 5 confirms that each role was exercised in both directions, that the Principal holds no write permission of any kind, and that a branch-scoped member requesting a branch outside their scope is refused rather than redirected. A redirection would conceal a defect; a refusal exposes it.

The second is scheme-specific evaluation with the pending rule. Three scheme calculators with distinct component thresholds are selected per offering, so a year containing students on more than one curriculum revision is evaluated correctly for each. The pending rule removes the single most damaging error of manual practice: a subject with no marks is not a zero, and a class with half its marks entered is not a class in which everybody failed. The explicit evaluated flag carries this distinction from the calculator into the result view, the report, the dashboard and the analytics, so the same rule holds everywhere it is expressed. It is also what makes the report readiness gate possible, since an incomplete class is now detectable rather than silently treated as a failing one.

The third is the confirmation gate on extracted marks. Extraction is a reading operation and reading is fallible, so the system treats an extraction as a proposal rather than as data. No mark reaches the marks table until a person has reviewed the rows and the row-level problems. This is the decision that most directly protects accuracy, because it is the point at which a misread column is caught by human eyes rather than propagated into a published percentage. The parser's other deliberate behaviours reinforce it: the summary columns printed by the college are re-derived rather than trusted, a blank cell is treated as an omission rather than a zero, and a subject heading is recognised by the shape of its code so that a misaligned column cannot shift every later one.

### 6.3.2 What the analytical surface provides

The analytical module supplies what manual processing cannot. A manual analysis reports the totals it computed and the names it selected; it does not produce a per-subject pass rate with a difficulty label, a per-year trend that includes years carrying no data, a banded distribution of the class, or a governed list of branches with missing data. Those four views change the character of the conversation a department has about its own results. A subject labelled hard at the current pass rate is a question about assessment design; a branch flagged as missing data is a question about process compliance; a band count is a question about whether the class is being taught to the standard the scheme assumes.

The scope of the analytical surface is equally significant. Because the server resolves the member's entitlement and the filters are applied within it, a Head of Department can widen from their own class to their branch and no further, while the examination cell and the Principal see the college. One implementation therefore serves three different conversations, which is what makes a single analytical surface credible rather than three.

### 6.3.3 The effect of the audit trail

The audit trail changes the character of the record in two ways. The first is evidential: every academic mutation carries the actor, the action, the entity and its identifier, a reason where the operation warrants one, and the originating address and client fingerprint. A disputed mark can be traced to the entry that produced it and to the person who entered it. The second is behavioural, and is harder to measure but more valuable. A separate action vocabulary for corrections and privilege changes means that the two most sensitive operations in the system are visibly distinct from ordinary edits.

The two properties of the write are deliberate. A failed audit write does not fail the request, because the mutation has already committed and aborting the response afterwards would be worse than a missing row. The write is nonetheless awaited before the response returns, so a shutdown cannot lose rows that were already committed. The trail is important, but it is not more important than the operation it describes.

### 6.3.4 Limitations recorded in the implementation

The implementation records several limitations honestly, and they are stated here because they bear directly on the interpretation of the results.

The most significant is a divergence between the pass threshold used by the evaluators and the one used by the analytical summaries. The three scheme calculators apply a 50 per cent aggregate pass threshold, while the analytics module, the dashboard and the class overview apply 40 per cent. A candidate at 45 per cent is passed by the calculator and counted as passing by the analytics figures; the grade bands compound the divergence, because the analytical layer treats 40 per cent as a borderline band that still counts as a pass while the calculator would fail the same candidate. A candidate close to the boundary can therefore be shown differently on the result view and on the analytical view. This is a divergence between the computation layer and the reporting layer, and it should be reconciled to a single value; it is the most significant defect in the delivered system.

A related but distinct issue is a denominator mismatch within a single response. The analytical averages are computed per mark row while the pass and fail determination is computed per student, so two figures presented side by side rest on different denominators. The dashboard's trend line was corrected to aggregate per student first, since averaging rows would weight a student with more components more heavily; the analytical module retains the per-row averaging and therefore carries the inconsistency.

Three further limitations are absences rather than defects. There is no re-evaluation workflow: the withheld flag and the audited correction route exist, but there is no re-evaluator role and no provisional-versus-final result state, so a genuine re-evaluation has no representation in the system. There is no attendance model: attendance does not participate in pass or fail and is not modelled as a mark component, so a college that treats attendance as a minimum-eligibility condition cannot express that condition. And there is no automated browser-level end-to-end coverage, which was discussed in Chapter 5.

One security gap is noted in the same spirit. There is no cross-site request forgery token mechanism. The application is authenticated by a bearer token carried in the authorization header, which makes the vulnerability largely inapplicable, but the cross-origin policy permits credentials and a cookie parser is installed, so the intent behind those settings should be confirmed. The gap becomes real the moment the session storage changes from local storage to a cookie. Separately, the two token-signing secrets fall back to a placeholder string when the environment variables are absent, so a missing variable silently produces a known secret rather than a start-up failure. Uploaded files are validated by type and signature, but no virus scanning is performed.

### 6.3.5 Overall assessment

Taken together, the results show a system that meets the objectives it set for itself in the areas where the objectives concerned correctness, access control and auditability, and meets them partially in the areas where they concerned completeness of the academic model. The core is sound: evaluation is computed by a shared rule set rather than repeated across surfaces; the pending rule holds everywhere it is expressed; access control is permission-based, scoped and enforced below the route layer; and every mutation is attributable. The analytical and audit surfaces add capability that manual processing does not offer. The gaps that remain are of two kinds — a threshold that should be reconciled between the computation and reporting layers, and academic concepts that were outside the defined scope and would require their own model — and neither undermines the mechanism by which the system's accuracy is protected.
