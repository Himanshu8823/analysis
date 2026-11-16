'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  AlertTriangle,
  Download,
  FileText,
  Loader2,
  Trash2,
} from 'lucide-react';

import { RequirePermission } from '@/components/auth/RequirePermission';
import { FileUploader, PDF_ONLY } from '@/components/forms/FileUploader';
import { Select } from '@/components/forms/Select';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorBanner } from '@/components/feedback/ErrorBanner';
import { Spinner } from '@/components/feedback/Spinner';
import { useCurrentUser } from '@/hooks/useAuth';
import { useBranches } from '@/hooks/useBranches';
import { useSchemes } from '@/hooks/useSchemes';
import { useAcademicYears, useRunningYear } from '@/hooks/useAcademic';
import {
  useConfirmScheme,
  useReadScheme,
  useSchemeReaderAvailability,
} from '@/hooks/useSchemeReader';
import {
  partitionConfirmable,
  schemeReaderService,
  type SchemeReadResult,
} from '@/lib/services/scheme-reader.service';
import type { CourseType, SchemeCourse } from '@result-analysis/shared-types';
import { COURSE_TYPES } from '@result-analysis/shared-types';

/**
 * The course types, spelled out.
 *
 * The scheme prints a two-letter code — `BSC`, `VSEC`, `IKS`. A college
 * user knows these codes, but a person who is not from this college does
 * not, so the code is shown with the words behind it. The words are the
 * design system's, not the university's — the university's own legend is
 * reproduced in the sample PDF.
 */
const COURSE_TYPE_LABELS: Record<CourseType, string> = {
  BSC: 'BSC — Basic Science',
  ESC: 'ESC — Engineering Science',
  PCC: 'PCC — Professional Core',
  VSEC: 'VSEC — Vocational Skill Enhancement',
  AEC: 'AEC — Ability Enhancement',
  CC: 'CC — Co-Curricular',
  IKS: 'IKS — Indian Knowledge System',
  MDC: 'MDC — Multidisciplinary Elective',
  MIC: 'MIC — Mandatory Indian Course',
};

/**
 * Read a Syllabus — the screen that reads a scheme PDF into subjects.
 *
 * The flow is three steps and the order is the point:
 *
 * 1. **Upload** the scheme PDF and let the reader propose the courses.
 * 2. **Review** what came back. Correct anything the reader got wrong.
 * 3. **Save** — and only then are subjects written.
 *
 * The reader is a proposal, never a decision. A misread course out of
 * thirty must cost the reviewer one correction, not a wrong mark in a
 * result. So the review table is editable, every row shows where it came
 * from, and the rows that were *dropped* are shown rather than hidden — a
 * dropped row is data that exists and was not understood, and hiding it
 * would be silent data loss.
 */
export default function ReadSchemePage() {
  return (
    <RequirePermission permissions={['schemes:read']}>
      <ReadSchemeScreen />
    </RequirePermission>
  );
}

function ReadSchemeScreen() {
  const [branchId, setBranchId] = useState('');
  const [schemeId, setSchemeId] = useState('');
  const [academicYearId, setAcademicYearId] = useState('');

  /**
   * The reading, held in the screen's own state.
   *
 * Not in the query cache: the reviewer's corrections live alongside it, and
 * a cached reading could only ever be a stale one.
   */
  const [result, setResult] = useState<SchemeReadResult | null>(null);

  /**
   * The courses as the reviewer has them.
   *
   * A copy of the reading's rows, so a correction never edits what the
   * reader actually said — the reviewer can always go back and see the
   * original.
   */
  const [courses, setCourses] = useState<SchemeCourse[]>([]);

  const { data: branchesData } = useBranches();
  const { data: schemesData } = useSchemes();
  const { data: academicYears } = useAcademicYears();
  const runningYear = useRunningYear();
  const { data: user } = useCurrentUser();

  const availability = useSchemeReaderAvailability();
  const read = useReadScheme();
  const confirm = useConfirmScheme();

  const branches = branchesData ?? [];
  const schemes = schemesData ?? [];
  const years = academicYears ?? [];

  /**
   * The **running** academic year is the default — the one the calendar's
   * dates say is running today, which is what the backend defaults its
   * reports to.
   */
  const activeYear = runningYear.year ?? years[0];
  const effectiveAcademicYearId = academicYearId || activeYear?.id || '';

  /**
   * The scope must be complete before a document can be read.
   *
   * The branch is what the subjects will belong to, and the scheme and
   * academic year say which class context they are taught in. Reading a
   * document without them would produce courses that cannot be written.
   */
  const scopeReady = !!branchId && !!schemeId && !!effectiveAcademicYearId;

  /**
   * Writing the subjects is a separate right from reading the document.
   *
   * A member who may read but not write still gets the reading — it is
   * useful on its own — but not the save button, because the server would
   * refuse it.
   */
  const canWrite = (user?.permissions ?? []).includes('subjects:write');

  /**
   * What the save would do, counted before it is done.
   *
   * The reviewer sees "12 subjects will be saved, 2 skipped" before they
   * press the button, and the same counts come back from the server
   * afterwards. A reviewer who is surprised by the numbers afterwards has
   * learned something too late.
   */
  const { confirmable, skipped } = useMemo(
    () => partitionConfirmable(courses),
    [courses],
  );

  const handleFile = (file: File) => {
    if (!scopeReady) return;
    read.mutate(
      { file, scope: { branchId, academicYearId: effectiveAcademicYearId } },
      {
        onSuccess: (readResult) => {
          setResult(readResult);
          setCourses(readResult.courses);
        },
      },
    );
  };

  /**
   * Changing the scope invalidates the reading.
   *
   * The courses belong to the branch, the scheme and the year that were
   * chosen when the document was read. If the reviewer changes any of
   * them, the reading on screen no longer describes what will be written —
   * so it is cleared rather than silently carried over.
   */
  const changeScope = (setter: (value: string) => void) => (value: string) => {
    setter(value);
    setResult(null);
    setCourses([]);
  };

  return (
    <section className="flex flex-col gap-6 md:gap-8">
      <PageHeader
        eyebrow="Schemes"
        title="Read a Syllabus"
        description="Upload the scheme PDF. We read the subjects out of it, you check them, then you save."
        backLink={{ href: '/admin/schemes', label: 'Back to schemes' }}
        actions={
          <Button variant="outline" asChild>
            <a href={schemeReaderService.sampleUrl()} download="sample-scheme.pdf">
              <Download aria-hidden />
              Download a sample
            </a>
          </Button>
        }
      />

      {/* The format warning, before anything is uploaded. */}
      <FormatWarning />

      {/* The scope. */}
      <article className="cb-surface-card" aria-label="Scheme scope">
        <div className="grid grid-cols-1 gap-base md:grid-cols-3">
          <Select
            label="Branch"
            value={branchId}
            onChange={(e) => changeScope(setBranchId)(e.target.value)}
          >
            <option value="">Select branch</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.code} · {branch.name}
              </option>
            ))}
          </Select>
          <Select
            label="Scheme"
            value={schemeId}
            onChange={(e) => changeScope(setSchemeId)(e.target.value)}
          >
            <option value="">Select scheme</option>
            {schemes.map((scheme) => (
              <option key={scheme.id} value={scheme.id}>
                {scheme.name}
              </option>
            ))}
          </Select>
          <Select
            label="Academic year"
            value={effectiveAcademicYearId}
            onChange={(e) => changeScope(setAcademicYearId)(e.target.value)}
          >
            {years.map((year) => (
              <option key={year.id} value={year.id}>
                {year.year}
              </option>
            ))}
          </Select>
        </div>
        {!scopeReady ? (
          <p className="mt-base text-body-sm text-body">
            Pick a branch, a scheme and an academic year first — the subjects are saved
            against them.
          </p>
        ) : null}
      </article>

      {/* The upload. */}
      {availability.data?.available === false ? (
        // The reading is not available on this system. Saying so plainly is
        // better than offering a button that will fail.
        <article className="cb-surface-card flex flex-col gap-base">
          <div className="flex items-start gap-sm text-body-sm text-body">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted" aria-hidden />
            <span>
              {availability.data.message ??
                'Automatic reading is not available on this system. You can still add the subjects by hand.'}
            </span>
          </div>
          <div className="flex flex-col gap-2 border-t border-hairline pt-base sm:flex-row sm:items-center">
            <Button asChild>
              <Link href="/admin/subjects/new">
                <FileText aria-hidden />
                Add a subject by hand
              </Link>
            </Button>
            <Button variant="secondary" asChild>
              <a href={schemeReaderService.sampleUrl()} download="sample-scheme.pdf">
                <Download aria-hidden />
                Download a sample
              </a>
            </Button>
          </div>
        </article>
      ) : (
        <FileUploader
          onFile={handleFile}
          isUploading={read.isPending}
          disabled={!scopeReady}
          accept={PDF_ONLY}
          hint="A PDF of the scheme, up to 20MB. It must be a text PDF — a scanned image will not work."
        />
      )}

      {read.isError ? (
        <ErrorBanner
          message="We could not read that document. Check that it is a text PDF of the scheme, and try again."
          retry={() => read.reset()}
        />
      ) : null}

      {read.isPending ? (
        <article className="cb-surface-card flex items-center gap-sm" aria-live="polite">
          <Spinner size={20} />
          <div className="flex flex-col gap-xs">
            <span className="text-body-sm text-ink">Reading the document…</span>
            <span className="text-caption text-muted">
              Every page is read and checked. This can take a minute or two.
            </span>
          </div>
        </article>
      ) : null}

      {result ? (
        <ReviewPanel
          result={result}
          courses={courses}
          onCoursesChange={setCourses}
          confirmableCount={confirmable.length}
          skippedCount={skipped.length}
          skipped={skipped}
          canWrite={canWrite}
          scope={{
            branchId,
            academicYearId: effectiveAcademicYearId,
            schemeId,
          }}
          onConfirm={() =>
            confirm.mutate({
              branchId,
              academicYearId: effectiveAcademicYearId,
              schemeId,
              courses: confirmable,
            })
          }
          confirming={confirm.isPending}
          onDiscard={() => {
            setResult(null);
            setCourses([]);
          }}
        />
      ) : null}
    </section>
  );
}

/**
 * The format warning.
 *
 * A syllabus arrives in many shapes, and the one thing that decides whether
 * it can be read is whether it carries *text*. A scanned document is a
 * picture of a table; there is nothing in it to read. Saying this before
 * the upload — with a real file to look at — is far kinder than a
 * "no subjects found" after a long wait.
 */
function FormatWarning() {
  return (
    <article className="rounded-lg border border-hairline bg-surface-soft p-4 md:p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:gap-4">
        <span
          className="inline-flex size-10 flex-shrink-0 items-center justify-center rounded-full bg-surface-strong text-primary"
          aria-hidden
        >
          <FileText className="h-5 w-5" />
        </span>
        <div className="flex min-w-0 flex-col gap-2">
          <h2 className="font-display text-title-md text-ink">
            What kind of PDF works here
          </h2>
          <ul className="flex flex-col gap-1 text-body-sm text-body">
            <li>
              It must be a <strong>text PDF</strong> — the one you get from the
              university website, not a photo of a printed page.
            </li>
            <li>
              It should contain the <strong>subject table</strong> — the one with
              the course codes, names and marks. The rest of the document is fine
              too; it is simply not used.
            </li>
            <li>
              A <strong>scanned</strong> or photographed document will not work, and
              neither will a spreadsheet.
            </li>
          </ul>
          <p className="text-body-sm text-body">
            Not sure?{' '}
            <a
              href={schemeReaderService.sampleUrl()}
              download="sample-scheme.pdf"
              className="font-semibold text-primary underline underline-offset-4"
            >
              Download a sample syllabus
            </a>{' '}
            and see what a working file looks like.
          </p>
        </div>
      </div>
    </article>
  );
}

interface ReviewPanelProps {
  result: SchemeReadResult;
  courses: SchemeCourse[];
  onCoursesChange: (courses: SchemeCourse[]) => void;
  confirmableCount: number;
  skippedCount: number;
  skipped: Array<{ course: SchemeCourse; reason: string }>;
  canWrite: boolean;
  scope: { branchId: string; academicYearId: string; schemeId: string };
  onConfirm: () => void;
  confirming: boolean;
  onDiscard: () => void;
}

/**
 * The review panel — the step between the reading and the saving.
 *
 * Everything the reader found is here, editable, with its origin shown. The
 * counts of what will be saved and what will be skipped are above the table
 * so the reviewer sees them before the write, not after.
 */
function ReviewPanel({
  result,
  courses,
  onCoursesChange,
  confirmableCount,
  skippedCount,
  skipped,
  canWrite,
  onConfirm,
  confirming,
  onDiscard,
}: ReviewPanelProps) {
  return (
    <article className="flex flex-col gap-base" aria-labelledby="review-title">
      <header className="flex flex-col gap-2">
        <h2 id="review-title" className="font-display text-title-md text-ink">
          Check what was read
        </h2>
        <p className="text-body-sm text-body">
          {result.courses.length} subject{result.courses.length === 1 ? '' : 's'} read from{' '}
          {result.pagesRead} page{result.pagesRead === 1 ? '' : 's'}. Correct anything
          that is wrong, then save. Nothing has been written yet.
        </p>
      </header>

      <ReadingSummary result={result} />

      {result.rejected.length > 0 ? (
        <DroppedRows rows={result.rejected} />
      ) : null}

      {result.warnings.length > 0 ? (
        <ReadingWarnings warnings={result.warnings} />
      ) : null}

      {courses.length === 0 ? (
        <EmptyState
          variant="plain"
          title="No subjects were found in this document"
          description="The reader understood the pages but did not find a subject table. Check that the document is the scheme for a semester, and try the manual route."
          icon={<FileText aria-hidden />}
          action={
            <Button asChild>
              <Link href="/admin/subjects/new">Add a subject by hand</Link>
            </Button>
          }
        />
      ) : (
        <CourseReviewTable
          courses={courses}
          onCoursesChange={onCoursesChange}
          skipped={skipped}
        />
      )}

      {/* The save. */}
      <div className="rounded-lg border border-hairline bg-card p-4 md:p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-1">
            <p className="text-body-sm text-ink">
              {confirmableCount} subject{confirmableCount === 1 ? '' : 's'} will be saved
              {skippedCount > 0 ? (
                <>
                  {' '}
                  and {skippedCount} will be skipped
                </>
              ) : null}
              .
            </p>
            <p className="text-caption text-muted">
              A subject that already exists is updated, not duplicated.
            </p>
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
            <Button variant="secondary" onClick={onDiscard} disabled={confirming}>
              Discard
            </Button>
            {canWrite ? (
              <Button onClick={onConfirm} disabled={confirming || confirmableCount === 0}>
                {confirming ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    Saving
                  </span>
                ) : (
                  'Save subjects'
                )}
              </Button>
            ) : (
              // Writing the subjects is not this viewer's right. Saying so
              // beats offering a button that would fail.
              <p className="text-body-sm text-muted">
                A member who can add subjects must save these.
              </p>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

/**
 * What the reading did, in one line each.
 *
 * The guard's verdict is shown because it is part of the trust story: the
 * document was checked before it was read.
 */
function ReadingSummary({ result }: { result: SchemeReadResult }) {
  const guardScore = result.guard.verdicts.reduce(
    (worst, verdict) => Math.max(worst, verdict.score),
    0,
  );

  /**
   * What the document check says.
   *
   * "Checked" and "could not be checked" are not the same thing, and the
   * tile must not say a page was checked when it was not. A page the
   * guard could not reach was never defended, and the reviewer has to see
   * that.
   */
  const unchecked = result.guard.uncheckedPages ?? [];
  const checkValue = !result.guard.isSafe
    ? 'Refused'
    : unchecked.length > 0
      ? 'Partly checked'
      : 'Safe';
  const checkTone = !result.guard.isSafe ? 'down' : unchecked.length > 0 ? 'neutral' : 'up';
  const checkHint = !result.guard.isSafe
    ? `Pages ${result.guard.refusedPages.join(', ')} tried to change how the document was read.`
    : unchecked.length > 0
      ? `Pages ${unchecked.join(', ')} could not be checked. Look at those pages yourself.`
      : `Every page was checked before it was read (worst score ${guardScore.toFixed(3)}).`;

  return (
    <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <SummaryTile label="Pages read" value={`${result.pagesRead} of ${result.pageCount}`} />
      <SummaryTile label="Semesters found" value={result.semesters.length ? result.semesters.join(', ') : '—'} />
      <SummaryTile label="Read in" value={`${Math.round(result.durationMs / 1000)}s`} />
      <SummaryTile label="Document check" value={checkValue} tone={checkTone} hint={checkHint} />
    </dl>
  );
}

function SummaryTile({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'up' | 'down' | 'neutral';
}) {
  return (
    <div className="rounded-lg border border-hairline bg-card p-3 md:p-4">
      <dt className="text-caption text-muted">{label}</dt>
      <dd
        className={`mt-1 font-display text-title-md ${
          tone === 'down' ? 'text-semantic-down' : tone === 'up' ? 'text-semantic-up' : 'text-ink'
        }`}
      >
        {value}
      </dd>
      {hint ? <p className="mt-1 text-caption text-muted">{hint}</p> : null}
    </div>
  );
}

/**
 * The rows the reader could not understand.
 *
 * These are shown, not hidden. A row that was dropped is a row that exists
 * in the document and did not reach the screen — if the reviewer cannot see
 * it, they cannot know that it is missing, and a subject quietly missing
 * from a scheme is a subject nobody teaches.
 */
function DroppedRows({ rows }: { rows: Array<{ reason: string; data: unknown }> }) {
  return (
    <section
      className="flex flex-col gap-2 rounded-lg border border-hairline bg-surface-soft p-4 md:p-5"
      aria-label="Rows that were not read"
    >
      <div className="flex items-start gap-sm text-body-sm text-ink">
        <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-semantic-down" aria-hidden />
        <span>
          {rows.length} row{rows.length === 1 ? '' : 's'} in the document could not be
          read, and {rows.length === 1 ? 'is' : 'are'} not in the table below.
        </span>
      </div>
      <ul className="flex flex-col gap-1 text-caption text-muted">
        {rows.slice(0, 6).map((row, index) => (
          <li key={`${row.reason}-${index}`}>{row.reason}</li>
        ))}
        {rows.length > 6 ? <li>…and {rows.length - 6} more</li> : null}
      </ul>
    </section>
  );
}

/**
 * The things the reader was unsure about.
 */
function ReadingWarnings({
  warnings,
}: {
  warnings: Array<{
    pageNumber: number | null;
    subject: string | null;
    message: string;
    severity: 'info' | 'warning' | 'error';
  }>;
}) {
  return (
    <section
      className="flex flex-col gap-2 rounded-lg border border-hairline bg-surface-soft p-4 md:p-5"
      aria-label="Warnings from the reading"
    >
      <div className="flex items-start gap-sm text-body-sm text-ink">
        <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-accent-yellow" aria-hidden />
        <span>
          {warnings.length} thing{warnings.length === 1 ? '' : 's'} the reader was unsure
          about. Check those rows before saving.
        </span>
      </div>
      <ul className="flex flex-col gap-1 text-caption text-muted">
        {warnings.slice(0, 6).map((warning, index) => (
          <li key={`${warning.message}-${index}`}>
            {warning.subject ? `${warning.subject}: ` : ''}
            {warning.message}
            {warning.pageNumber ? ` (page ${warning.pageNumber})` : ''}
          </li>
        ))}
        {warnings.length > 6 ? <li>…and {warnings.length - 6} more</li> : null}
      </ul>
    </section>
  );
}

/**
 * The editable course table.
 *
 * This is the heart of the screen. The reader's rows arrive here and the
 * reviewer may correct any of them — a wrong course name, a misread mark
 * ceiling, a missing semester.
 *
 * The table is a real `<table>` on tablet and up. On mobile it becomes one
 * card per course, because a twelve-column table cannot be made readable
 * on a phone and a table that scrolls sideways is worse than no table.
 */
function CourseReviewTable({
  courses,
  onCoursesChange,
  skipped,
}: {
  courses: SchemeCourse[];
  onCoursesChange: (courses: SchemeCourse[]) => void;
  skipped: Array<{ course: SchemeCourse; reason: string }>;
}) {
  /**
   * The codes of the courses that will not be saved.
   *
   * The skip reasons are computed from the *original* reading, so they are
   * looked up by code. A course the reviewer has corrected so that it now
   * carries marks is no longer skipped — the row itself is marked as
   * skipped instead, and the count above the table is recomputed from the
   * current rows.
   */
  const skippedCodes = useMemo(
    () => new Set(skipped.map((entry) => entry.course.courseCode)),
    [skipped],
  );

  const update = (index: number, changes: Partial<SchemeCourse>) => {
    const next = courses.map((course, i) =>
      i === index ? { ...course, ...changes } : course,
    );
    onCoursesChange(next);
  };

  const remove = (index: number) => {
    onCoursesChange(courses.filter((_, i) => i !== index));
  };

  return (
    <div className="flex flex-col gap-2">
      {/* Desktop and tablet: the table. */}
      <div className="hidden overflow-x-auto rounded-md border border-hairline md:block">
        <table className="min-w-full text-body-sm">
          <thead className="bg-surface-soft text-left text-caption uppercase text-muted">
            <tr>
              <th className="px-base py-sm font-semibold">Code</th>
              <th className="px-base py-sm font-semibold">Name</th>
              <th className="px-base py-sm font-semibold">Type</th>
              <th className="px-base py-sm font-semibold">Sem</th>
              <th className="px-base py-sm font-semibold">L</th>
              <th className="px-base py-sm font-semibold">P</th>
              <th className="px-base py-sm font-semibold">CA</th>
              <th className="px-base py-sm font-semibold">MSE</th>
              <th className="px-base py-sm font-semibold">ESE</th>
              <th className="px-base py-sm font-semibold">Credits</th>
              <th className="px-base py-sm font-semibold">Page</th>
              <th className="px-base py-sm font-semibold">
                <span className="sr-only">Remove</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {courses.map((course, index) => (
              <tr key={`${course.courseCode}-${index}`} className="border-t border-hairline">
                <td className="px-base py-sm">
                  <CellInput
                    value={course.courseCode}
                    aria-label={`Course code, row ${index + 1}`}
                    onChange={(value) => update(index, { courseCode: value })}
                    mono
                  />
                </td>
                <td className="px-base py-sm">
                  <CellInput
                    value={course.courseName}
                    aria-label={`Course name, row ${index + 1}`}
                    onChange={(value) => update(index, { courseName: value })}
                  />
                </td>
                <td className="px-base py-sm">
                  <CellSelect
                    value={course.courseType ?? ''}
                    aria-label={`Course type, row ${index + 1}`}
                    onChange={(value) =>
                      update(index, { courseType: (value || null) as CourseType | null })
                    }
                    options={[
                      { value: '', label: '—' },
                      ...COURSE_TYPES.map((type) => ({
                        value: type,
                        label: COURSE_TYPE_LABELS[type],
                      })),
                    ]}
                  />
                </td>
                <td className="px-base py-sm">
                  <CellNumber
                    value={course.semester}
                    aria-label={`Semester, row ${index + 1}`}
                    onChange={(value) => update(index, { semester: value })}
                  />
                </td>
                <td className="px-base py-sm">
                  <CellNumber
                    value={course.theoryHours}
                    aria-label={`Lecture hours, row ${index + 1}`}
                    onChange={(value) => update(index, { theoryHours: value })}
                  />
                </td>
                <td className="px-base py-sm">
                  <CellNumber
                    value={course.practicalHours}
                    aria-label={`Practical hours, row ${index + 1}`}
                    onChange={(value) => update(index, { practicalHours: value })}
                  />
                </td>
                <td className="px-base py-sm">
                  <CellNumber
                    value={course.ca}
                    aria-label={`Continuous assessment marks, row ${index + 1}`}
                    onChange={(value) => update(index, { ca: value })}
                  />
                </td>
                <td className="px-base py-sm">
                  <CellNumber
                    value={course.mse}
                    aria-label={`Mid-semester marks, row ${index + 1}`}
                    onChange={(value) => update(index, { mse: value })}
                  />
                </td>
                <td className="px-base py-sm">
                  <CellNumber
                    value={course.ese}
                    aria-label={`End-semester marks, row ${index + 1}`}
                    onChange={(value) => update(index, { ese: value })}
                  />
                </td>
                <td className="px-base py-sm">
                  <CellNumber
                    value={course.credits}
                    aria-label={`Credits, row ${index + 1}`}
                    onChange={(value) => update(index, { credits: value })}
                  />
                </td>
                <td className="num px-base py-sm text-muted">{course.pageNumber ?? '—'}</td>
                <td className="px-base py-sm">
                  <button
                    type="button"
                    onClick={() => remove(index)}
                    aria-label={`Remove ${course.courseCode || `row ${index + 1}`}`}
                    className="inline-flex size-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-soft hover:text-semantic-down focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: one card per course. */}
      <div className="flex flex-col gap-3 md:hidden">
        {courses.map((course, index) => (
          <article key={`${course.courseCode}-${index}`} className="rounded-md border border-hairline bg-card p-4">
            <div className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <span className="num text-caption-strong text-muted">
                  Row {index + 1}
                  {course.pageNumber ? ` · page ${course.pageNumber}` : ''}
                </span>
                <button
                  type="button"
                  onClick={() => remove(index)}
                  aria-label={`Remove ${course.courseCode || `row ${index + 1}`}`}
                  className="inline-flex size-11 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-soft hover:text-semantic-down focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              </div>

              <LabelledField label="Course code">
                <CellInput
                  value={course.courseCode}
                  aria-label={`Course code, row ${index + 1}`}
                  onChange={(value) => update(index, { courseCode: value })}
                  mono
                />
              </LabelledField>

              <LabelledField label="Course name">
                <CellInput
                  value={course.courseName}
                  aria-label={`Course name, row ${index + 1}`}
                  onChange={(value) => update(index, { courseName: value })}
                />
              </LabelledField>

              <LabelledField label="Course type">
                <CellSelect
                  value={course.courseType ?? ''}
                  aria-label={`Course type, row ${index + 1}`}
                  onChange={(value) =>
                    update(index, { courseType: (value || null) as CourseType | null })
                  }
                  options={[
                    { value: '', label: '—' },
                    ...COURSE_TYPES.map((type) => ({
                      value: type,
                      label: COURSE_TYPE_LABELS[type],
                    })),
                  ]}
                />
              </LabelledField>

              <div className="grid grid-cols-2 gap-3">
                <LabelledField label="Semester">
                  <CellNumber
                    value={course.semester}
                    aria-label={`Semester, row ${index + 1}`}
                    onChange={(value) => update(index, { semester: value })}
                  />
                </LabelledField>
                <LabelledField label="Credits">
                  <CellNumber
                    value={course.credits}
                    aria-label={`Credits, row ${index + 1}`}
                    onChange={(value) => update(index, { credits: value })}
                  />
                </LabelledField>
                <LabelledField label="Lecture hours">
                  <CellNumber
                    value={course.theoryHours}
                    aria-label={`Lecture hours, row ${index + 1}`}
                    onChange={(value) => update(index, { theoryHours: value })}
                  />
                </LabelledField>
                <LabelledField label="Practical hours">
                  <CellNumber
                    value={course.practicalHours}
                    aria-label={`Practical hours, row ${index + 1}`}
                    onChange={(value) => update(index, { practicalHours: value })}
                  />
                </LabelledField>
                <LabelledField label="CA marks">
                  <CellNumber
                    value={course.ca}
                    aria-label={`Continuous assessment marks, row ${index + 1}`}
                    onChange={(value) => update(index, { ca: value })}
                  />
                </LabelledField>
                <LabelledField label="MSE marks">
                  <CellNumber
                    value={course.mse}
                    aria-label={`Mid-semester marks, row ${index + 1}`}
                    onChange={(value) => update(index, { mse: value })}
                  />
                </LabelledField>
                <LabelledField label="ESE marks">
                  <CellNumber
                    value={course.ese}
                    aria-label={`End-semester marks, row ${index + 1}`}
                    onChange={(value) => update(index, { ese: value })}
                  />
                </LabelledField>
              </div>
            </div>
          </article>
        ))}
      </div>

      {skippedCodes.size > 0 ? (
        <p className="text-caption text-muted">
          {skippedCodes.size} row{skippedCodes.size === 1 ? '' : 's'} in the table will not
          be saved — a subject needs a code and at least one mark. Correct those rows, or
          remove them.
        </p>
      ) : null}
    </div>
  );
}

function LabelledField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-caption text-muted">{label}</span>
      {children}
    </label>
  );
}

/**
 * A text cell in the review table.
 */
function CellInput({
  value,
  onChange,
  'aria-label': ariaLabel,
  mono,
}: {
  value: string;
  onChange: (value: string) => void;
  'aria-label': string;
  mono?: boolean;
}) {
  return (
    <input
      type="text"
      value={value}
      aria-label={ariaLabel}
      onChange={(e) => onChange(e.target.value)}
      className={`cb-input !min-h-9 !px-2 !py-1 text-body-sm ${mono ? 'num' : ''}`}
    />
  );
}

/**
 * A number cell in the review table.
 *
 * An empty cell means *the document did not say* — which is different from
 * zero, and the difference matters: a course with a zero mid-semester
 * mark is a course with no mid-semester exam, and the reader may have
 * simply failed to find the column. So an empty cell posts as absent, not
 * as zero, and the reviewer can leave it that way deliberately.
 */
function CellNumber({
  value,
  onChange,
  'aria-label': ariaLabel,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  'aria-label': string;
}) {
  return (
    <input
      type="number"
      inputMode="numeric"
      value={value === null ? '' : value}
      aria-label={ariaLabel}
      onChange={(e) => {
        const raw = e.target.value;
        if (raw === '') {
          onChange(null);
          return;
        }
        const parsed = Number(raw);
        onChange(Number.isFinite(parsed) ? parsed : null);
      }}
      className="cb-input num !min-h-9 !px-2 !py-1 text-body-sm"
    />
  );
}

/**
 * A dropdown cell in the review table.
 */
function CellSelect({
  value,
  onChange,
  options,
  'aria-label': ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  'aria-label': string;
}) {
  return (
    <select
      value={value}
      aria-label={ariaLabel}
      onChange={(e) => onChange(e.target.value)}
      className="cb-input !min-h-9 !px-2 !py-1 text-body-sm"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
