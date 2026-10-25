'use client';

import { useState } from 'react';
import { Award, Percent, BookOpen, Hash, CheckCircle2, XCircle } from 'lucide-react';

import { useMyResult, useMyToppers } from '@/hooks/useStudentSelf';
import { Pagination } from '@/components/forms/Pagination';
import { TableSkeleton } from '@/components/forms/TableSkeleton';
import { ErrorBanner } from '@/components/feedback/ErrorBanner';
import { EmptyState } from '@/components/feedback/EmptyState';
import { Spinner } from '@/components/feedback/Spinner';
import { PageHeader } from '@/components/layout/PageHeader';
import { formatters } from '@/lib/utils/formatters';
import { cn } from '@/lib/utils';

export default function MyResultPage() {
  const { data, isLoading, isError, error, refetch } = useMyResult();
  const toppers = useMyToppers(10);

  const [subjectPage, setSubjectPage] = useState(1);
  const [subjectPageSize, setSubjectPageSize] = useState(10);
  const [componentPage, setComponentPage] = useState(1);
  const [componentPageSize, setComponentPageSize] = useState(10);
  const [topperPage, setTopperPage] = useState(1);
  const [topperPageSize, setTopperPageSize] = useState(10);

  if (isLoading) {
    return (
      <section className="flex flex-col gap-6 md:gap-8" aria-busy>
        <PageHeader title="My Result" description="Your marksheet for the current examination." />
        <div className="flex items-center gap-sm text-body-sm text-body">
          <Spinner size={16} /> Loading your result…
        </div>
      </section>
    );
  }

  /**
   * The server refuses to show a result that has not been published yet, and
   * says why in the message. That message is the answer the student needs, so
   * it is shown rather than replaced with a generic error.
   */
  if (isError) {
    return (
      <section className="flex flex-col gap-6 md:gap-8">
        <PageHeader title="My Result" description="Your marksheet for the current examination." />
        <ErrorBanner message={readableError(error)} retry={() => refetch()} />
      </section>
    );
  }

  if (!data) {
    return (
      <section className="flex flex-col gap-6 md:gap-8">
        <PageHeader title="My Result" description="Your marksheet for the current examination." />
        <EmptyState
          title="No result available"
          description="Your result will appear here once it has been declared."
        />
      </section>
    );
  }

  const { student, totals, marks, examination } = data;

  /**
   * The mark rows are per component — `CA1`, `CA2`, `MID_SEM`, `WRITTEN` — the
   * way a marksheet shows them. The subject-wise summary is derived from them
   * so the bar chart and the table cannot disagree.
   */
  const bySubject = new Map<
    string,
    { code: string; name: string; credits: number; obtained: number; max: number }
  >();

  for (const mark of marks) {
    const key = `${mark.subjectCode}::${mark.subjectName}`;
    const entry =
      bySubject.get(key) ??
      {
        code: mark.subjectCode,
        name: mark.subjectName,
        credits: mark.credits,
        obtained: 0,
        max: 0,
      };
    entry.obtained += mark.marksObtained;
    entry.max += mark.maxMarks;
    bySubject.set(key, entry);
  }

  const subjectRows = [...bySubject.values()].sort((a, b) =>
    a.code.localeCompare(b.code)
  );

  const subjectPageItems = subjectRows.slice(
    (subjectPage - 1) * subjectPageSize,
    subjectPage * subjectPageSize,
  );
  const componentPageItems = marks.slice(
    (componentPage - 1) * componentPageSize,
    componentPage * componentPageSize,
  );
  const topperRows = toppers.data?.toppers ?? [];
  const topperPageItems = topperRows.slice(
    (topperPage - 1) * topperPageSize,
    topperPage * topperPageSize,
  );

  return (
    <section className="flex flex-col gap-6 md:gap-8">
      <PageHeader
        title="My Result"
        description={`${student.branch} · Semester ${student.semester} · Year ${student.year} · ${student.scheme}`}
      />

      {/* Identity */}
      <article className="cb-surface-card" aria-label="Student details">
        <dl className="grid grid-cols-1 gap-base md:grid-cols-2 lg:grid-cols-4">
          <Detail label="Name" value={student.name} icon={BookOpen} />
          <Detail label="Roll number" value={student.rollNo} icon={Hash} />
          <Detail label="Academic year" value={student.academicYear} />
          <Detail
            label="Published"
            value={
              examination.resultPublishedAt
                ? formatters.date(examination.resultPublishedAt, 'long')
                : examination.status
            }
          />
        </dl>
      </article>

      {/* Totals */}
      <section
        aria-label="Result summary"
        className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4"
      >
        <SummaryCard
          label="Percentage"
          value={formatters.percentage(totals.percentage, 2)}
          helper={`${totals.totalMarks} of ${totals.totalMaxMarks} marks`}
          icon={Percent}
          tone={totals.isPass ? 'text-semantic-up' : 'text-semantic-down'}
        />
        <SummaryCard
          label="Result"
          value={totals.isPass ? 'Pass' : 'Fail'}
          helper={
            totals.failedSubjects.length > 0
              ? `${totals.failedSubjects.length} subject${totals.failedSubjects.length === 1 ? '' : 's'} to clear`
              : 'All subjects cleared'
          }
          icon={totals.isPass ? CheckCircle2 : XCircle}
          tone={totals.isPass ? 'text-semantic-up' : 'text-semantic-down'}
        />
        <SummaryCard
          label="Credits earned"
          value={`${totals.creditsEarned} / ${totals.totalCredits}`}
          helper="Credit points earned this semester"
          icon={Award}
          tone="text-primary"
        />
        <SummaryCard
          label="Subjects graded"
          value={String(subjectRows.length)}
          helper={`${marks.length} mark entries`}
          icon={BookOpen}
          tone="text-primary"
        />
      </section>

      {/* Failed subjects */}
      {totals.failedSubjects.length > 0 ? (
        <article
          className="cb-surface-card border-semantic-down"
          aria-labelledby="failed-subjects-title"
        >
          <h2 id="failed-subjects-title" className="font-display text-title-md text-ink">
            Subjects to clear
          </h2>
          <ul className="mt-base flex flex-col divide-y divide-hairline">
            {totals.failedSubjects.map((subject) => (
              <li
                key={subject.subjectCode}
                className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 md:flex-row md:items-center md:justify-between md:gap-4"
              >
                <div className="min-w-0">
                  <p className="truncate text-body-sm font-semibold text-ink">
                    {subject.subjectCode} — {subject.subjectName}
                  </p>
                  <p className="text-caption text-muted">{subject.reason}</p>
                </div>
                <span className="cb-badge bg-surface-strong text-semantic-down shrink-0">
                  Not cleared
                </span>
              </li>
            ))}
          </ul>
        </article>
      ) : null}

      {/* Subject-wise marks */}
      <article
        className="cb-surface-card overflow-hidden rounded-md"
        aria-labelledby="subject-marks-title"
      >
        <header className="border-b border-hairline px-base py-base">
          <h2 id="subject-marks-title" className="font-display text-title-md text-ink">
            Subject-wise marks
          </h2>
        </header>

        {subjectRows.length === 0 ? (
          <div className="p-base">
            <EmptyState
              title="No marks entered yet"
              description="Your marksheet will fill in as the examination cell enters the marks."
            />
          </div>
        ) : (
          <>
            {/* Table on tablet and up; stacked rows on mobile. */}
            <table className="hidden w-full text-left md:table">
              <thead>
                <tr className="border-b border-hairline bg-surface-soft">
                  <th scope="col" className="px-base py-sm text-caption-strong uppercase tracking-wide text-muted">
                    Subject
                  </th>
                  <th scope="col" className="px-base py-sm text-right text-caption-strong uppercase tracking-wide text-muted">
                    Credits
                  </th>
                  <th scope="col" className="px-base py-sm text-right text-caption-strong uppercase tracking-wide text-muted">
                    Marks
                  </th>
                  <th scope="col" className="px-base py-sm text-right text-caption-strong uppercase tracking-wide text-muted">
                    Percentage
                  </th>
                </tr>
              </thead>
              <tbody>
                {subjectPageItems.map((subject) => {
                  const pct =
                    subject.max > 0 ? (subject.obtained / subject.max) * 100 : 0;
                  return (
                    <tr
                      key={`${subject.code}-${subject.name}`}
                      className="border-b border-hairline last:border-b-0"
                    >
                      <td className="px-base py-sm">
                        <p className="text-body-sm font-semibold text-ink">{subject.code}</p>
                        <p className="text-caption text-muted">{subject.name}</p>
                      </td>
                      <td className="num px-base py-sm text-right text-body-sm text-body">
                        {subject.credits}
                      </td>
                      <td className="num px-base py-sm text-right text-body-sm text-ink">
                        {formatters.marks(subject.obtained, subject.max)}
                      </td>
                      <td className="num px-base py-sm text-right text-body-sm text-ink">
                        {formatters.percentage(pct, 1)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <ul className="divide-y divide-hairline md:hidden">
              {subjectRows.map((subject) => {
                const pct =
                  subject.max > 0 ? (subject.obtained / subject.max) * 100 : 0;
                return (
                  <li
                    key={`${subject.code}-${subject.name}`}
                    className="flex flex-col gap-1 px-base py-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-body-sm font-semibold text-ink">
                          {subject.code}
                        </p>
                        <p className="truncate text-caption text-muted">{subject.name}</p>
                      </div>
                      <span className="num shrink-0 text-body-sm text-ink">
                        {formatters.percentage(pct, 1)}
                      </span>
                    </div>
                    <p className="num text-caption text-muted">
                      {formatters.marks(subject.obtained, subject.max)} ·{' '}
                      {subject.credits} credits
                    </p>
                  </li>
                );
              })}
            </ul>

            <Pagination
              page={subjectPage}
              pageSize={subjectPageSize}
              total={subjectRows.length}
              onPageChange={setSubjectPage}
              onPageSizeChange={(size) => {
                setSubjectPageSize(size);
                setSubjectPage(1);
              }}
              className="border-t border-hairline px-base py-sm"
            />
          </>
        )}
      </article>

      {/* Component-level breakdown */}
      {marks.length > 0 ? (
        <article
          className="cb-surface-card overflow-hidden rounded-md"
          aria-labelledby="component-marks-title"
        >
          <header className="border-b border-hairline px-base py-base">
            <h2 id="component-marks-title" className="font-display text-title-md text-ink">
              Component-wise breakdown
            </h2>
          </header>
          <div className="overflow-x-auto">
            <table className="w-full text-body-sm">
              <thead className="bg-surface-soft">
                <tr>
                  <th scope="col" className="px-base py-sm text-left font-semibold text-muted">
                    Subject
                  </th>
                  <th scope="col" className="px-base py-sm text-left font-semibold text-muted">
                    Component
                  </th>
                  <th scope="col" className="px-base py-sm text-right font-semibold text-muted">
                    Marks
                  </th>
                  <th scope="col" className="px-base py-sm text-right font-semibold text-muted">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {componentPageItems.map((mark, index) => (
                  <tr
                    key={`${mark.subjectCode}-${mark.examType}-${index}`}
                    className="border-t border-hairline first:border-t-0"
                  >
                    <td className="px-base py-sm">
                      <p className="font-semibold text-ink">{mark.subjectCode}</p>
                      <p className="text-caption text-muted">{mark.subjectName}</p>
                    </td>
                    <td className="px-base py-sm text-body">{mark.examType}</td>
                    <td className="num px-base py-sm text-right text-ink">
                      {mark.isAbsent
                        ? '—'
                        : formatters.marks(mark.marksObtained, mark.maxMarks)}
                    </td>
                    <td className="px-base py-sm text-right">
                      {mark.isAbsent ? (
                        <span className="cb-badge bg-surface-strong text-semantic-down">
                          Absent
                        </span>
                      ) : mark.isWithheld ? (
                        <span className="cb-badge bg-surface-strong text-muted">Withheld</span>
                      ) : (
                        <span className="cb-badge bg-surface-strong text-semantic-up">Entered</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            page={componentPage}
            pageSize={componentPageSize}
            total={marks.length}
            onPageChange={setComponentPage}
            onPageSizeChange={(size) => {
              setComponentPageSize(size);
              setComponentPage(1);
            }}
            className="border-t border-hairline px-base py-sm"
          />
        </article>
      ) : null}

      {/* Class toppers */}
      <article
        className="cb-surface-card overflow-hidden rounded-md"
        aria-labelledby="my-toppers-title"
      >
        <header className="border-b border-hairline px-base py-base">
          <h2 id="my-toppers-title" className="font-display text-title-md text-ink">
            Class toppers
          </h2>
          {toppers.data ? (
            <p className="text-caption text-muted">
              {toppers.data.class.branch} · Semester {toppers.data.class.semester} ·{' '}
              {toppers.data.class.academicYear}
            </p>
          ) : null}
        </header>

        {toppers.isLoading ? (
          <div className="p-base">
            <TableSkeleton columns={5} rows={5} bordered={false} />
          </div>
        ) : toppers.isError ? (
          <div className="p-base">
            <ErrorBanner
              message={readableError(toppers.error)}
              retry={() => toppers.refetch()}
            />
          </div>
        ) : (toppers.data?.toppers.length ?? 0) === 0 ? (
          <div className="p-base">
            <EmptyState
              title="No class toppers yet"
              description="The leaderboard appears once your class result is published."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-body-sm">
              <thead className="bg-surface-soft">
                <tr>
                  <th scope="col" className="px-base py-sm text-left font-semibold text-muted">
                    Rank
                  </th>
                  <th scope="col" className="px-base py-sm text-left font-semibold text-muted">
                    Roll
                  </th>
                  <th scope="col" className="px-base py-sm text-left font-semibold text-muted">
                    Name
                  </th>
                  <th scope="col" className="px-base py-sm text-right font-semibold text-muted">
                    Total
                  </th>
                  <th scope="col" className="px-base py-sm text-right font-semibold text-muted">
                    Percentage
                  </th>
                </tr>
              </thead>
              <tbody>
                {topperPageItems.map((topper) => {
                  const isMe = topper.studentId === student.id;
                  return (
                    <tr
                      key={topper.studentId}
                      className={cn(
                        'border-t border-hairline first:border-t-0',
                        isMe && 'bg-surface-soft'
                      )}
                    >
                      <td className="num px-base py-sm text-ink">{topper.rank}</td>
                      <td className="num px-base py-sm text-body">{topper.rollNo}</td>
                      <td className="px-base py-sm text-ink">
                        {topper.name}
                        {isMe ? (
                          <span className="ml-2 cb-badge bg-surface-strong text-primary">
                            You
                          </span>
                        ) : null}
                      </td>
                      <td className="num px-base py-sm text-right text-ink">
                        {formatters.marks(topper.totalMarks, topper.maxTotalMarks)}
                      </td>
                      <td className="num px-base py-sm text-right text-ink">
                        {formatters.percentage(topper.percentage, 2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {topperRows.length > 0 ? (
          <Pagination
            page={topperPage}
            pageSize={topperPageSize}
            total={topperRows.length}
            onPageChange={setTopperPage}
            onPageSizeChange={(size) => {
              setTopperPageSize(size);
              setTopperPage(1);
            }}
            className="border-t border-hairline px-base py-sm"
          />
        ) : null}
      </article>
    </section>
  );
}

/**
 * One labelled figure in the identity card.
 */
function Detail({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon?: typeof Hash;
}) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="flex items-center gap-1.5 text-caption uppercase tracking-wide text-muted">
        {Icon ? <Icon className="size-3.5" aria-hidden /> : null}
        {label}
      </dt>
      <dd className="text-body-sm font-semibold text-ink">{value || '—'}</dd>
    </div>
  );
}

/**
 * One summary card.
 */
function SummaryCard({
  label,
  value,
  helper,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  helper: string;
  icon: typeof Percent;
  tone: string;
}) {
  return (
    <article
      className="cb-surface-card flex flex-col gap-sm"
      aria-label={`${label}: ${value}`}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-caption uppercase tracking-wide text-muted">{label}</span>
        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-strong">
          <Icon className={cn('size-4', tone)} aria-hidden />
        </span>
      </div>
      <p className="num font-display text-display-sm text-ink">{value}</p>
      <p className="text-caption text-muted">{helper}</p>
    </article>
  );
}

/**
 * The server's own explanation, which is written for a student.
 *
 * When the message is missing or is an opaque HTTP status, a plain sentence
 * is shown instead — a student should never be shown "Request failed with
 * status code 404".
 */
function readableError(error: unknown): string {
  const message = extractMessage(error);
  if (message && !message.startsWith('Request failed with status code')) {
    return message;
  }
  return 'We could not load your result. Please try again, or contact the examination cell.';
}

/**
 * Pulls the server's message out of an Axios error.
 */
function extractMessage(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const e = error as { response?: { data?: { message?: string | string[] } } };
  const apiMessage = e.response?.data?.message;
  if (Array.isArray(apiMessage)) {
    return apiMessage.length > 0 ? apiMessage.join('. ') : undefined;
  }
  return apiMessage;
}
