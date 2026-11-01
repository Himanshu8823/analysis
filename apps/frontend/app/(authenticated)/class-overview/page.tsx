'use client';

import { useEffect, useMemo, useState } from 'react';
import { BarChart3, GraduationCap, TrendingUp, Users } from 'lucide-react';

import { PageHeader } from '@/components/layout/PageHeader';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorBanner } from '@/components/feedback/ErrorBanner';
import { TableSkeleton } from '@/components/forms/TableSkeleton';
import { Select } from '@/components/forms/Select';
import { Pagination } from '@/components/forms/Pagination';

import { useMyClasses, useClassOverview } from '@/hooks/useClassOverview';
import { useTablePagination } from '@/hooks/useTablePagination';
import { formatters } from '@/lib/utils/formatters';
import type { ClassOverview, ClassStudent } from '@/lib/services/class-overview.service';

export default function ClassOverviewPage() {
  const classesQuery = useMyClasses();
  const classes = useMemo(() => classesQuery.data ?? [], [classesQuery.data]);

  /**
   * The selected class is kept as an id rather than an object, so the
   * selection survives a refetch that replaces the class list.
   */
  const [selectedId, setSelectedId] = useState<string>('');

  /**
   * The first class is selected by default, so a class teacher who holds
   * one class lands straight on it. A member holding several classes picks
   * from the dropdown below.
   */
  useEffect(() => {
    if (classes.length === 0) return;
    if (selectedId && classes.some((c) => c.id === selectedId)) return;
    setSelectedId(classes[0].id);
  }, [classes, selectedId]);

  const overviewQuery = useClassOverview(selectedId);

  if (classesQuery.isError) {
    return (
      <section className="flex flex-col gap-6 md:gap-8">
        <PageHeader
          title="Class Overview"
          description="Your class at a glance — the roster, the class's standing, and the subject-wise picture."
        />
        <ErrorBanner
          message="Could not load your classes."
          retry={() => classesQuery.refetch()}
        />
      </section>
    );
  }

  if (classesQuery.isLoading) {
    return (
      <section className="flex flex-col gap-6 md:gap-8">
        <PageHeader
          title="Class Overview"
          description="Your class at a glance — the roster, the class's standing, and the subject-wise picture."
        />
        <TableSkeleton columns={4} rows={6} />
      </section>
    );
  }

  /**
   * Holding no class is not an error — it means the member has not been
   * named as a class teacher. The page says so and stops, rather than
   * showing an empty table that looks like missing data.
   */
  if (classes.length === 0) {
    return (
      <section className="flex flex-col gap-6 md:gap-8">
        <PageHeader
          title="Class Overview"
          description="Your class at a glance — the roster, the class's standing, and the subject-wise picture."
        />
        <EmptyState
          title="You are not a class teacher"
          description="Once a class teacher is assigned to a class, it appears here with its roster and statistics."
          icon={<GraduationCap className="size-5" />}
        />
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-6 md:gap-8">
      <PageHeader
        title="Class Overview"
        description="Your class at a glance — the roster, the class's standing, and the subject-wise picture."
      />

      {classes.length > 1 ? (
        <article className="cb-surface-card" aria-label="Class">
          <div className="grid grid-cols-1 gap-base md:grid-cols-2 lg:grid-cols-3">
            <Select
              label="Class"
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.branchCode} · Semester {c.semester} · {c.academicYearLabel}
                </option>
              ))}
            </Select>
          </div>
        </article>
      ) : null}

      {overviewQuery.isError ? (
        <ErrorBanner
          message="Could not load the class overview."
          retry={() => overviewQuery.refetch()}
        />
      ) : overviewQuery.isLoading || !overviewQuery.data ? (
        <TableSkeleton columns={5} rows={8} />
      ) : (
        <ClassOverviewBody data={overviewQuery.data} />
      )}
    </section>
  );
}

/**
 * The overview of the selected class.
 *
 * The order is deliberate: the headline numbers first (what is the state of
 * the class), then the subject-wise standing (where the class is strong or
 * weak), then the roster (the detail behind the numbers).
 */
function ClassOverviewBody({ data }: { data: ClassOverview }) {
  const { stats, subjects, students, class: myClass } = data;

  const kpis = [
    {
      label: 'Students',
      value: String(stats.studentCount),
      Icon: Users,
      tone: 'text-primary',
    },
    {
      label: 'Subjects',
      value: String(stats.subjectCount),
      Icon: BarChart3,
      tone: 'text-accent-blue',
    },
    {
      label: 'Class average',
      value: formatters.percentage(stats.averagePercentage, 1),
      Icon: TrendingUp,
      tone: 'text-semantic-up',
    },
    {
      label: 'Passed',
      value: `${stats.passedCount}`,
      Icon: GraduationCap,
      tone: 'text-semantic-up',
    },
  ];

  const rows = useMemo(
    () =>
      [...students].sort((a, b) => {
        if (b.percentage !== a.percentage) return b.percentage - a.percentage;
        return a.rollNo.localeCompare(b.rollNo);
      }),
    [students]
  );

  const { page, setPage, pageSize, setPageSize, total, pageItems } = useTablePagination(rows, {
    resetKey: myClass.id,
  });

  return (
    <div className="flex flex-col gap-lg">
      <div className="grid grid-cols-1 gap-base md:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <article
            key={kpi.label}
            className="cb-surface-card flex flex-col gap-sm"
            aria-label={`${kpi.label}: ${kpi.value}`}
          >
            <div className="flex items-center justify-between">
              <span className="text-caption uppercase tracking-wide text-muted">{kpi.label}</span>
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-surface-strong">
                <kpi.Icon className={`h-5 w-5 ${kpi.tone}`} aria-hidden />
              </span>
            </div>
            <p className="num font-display text-display-sm text-ink">{kpi.value}</p>
          </article>
        ))}
      </div>

      <article className="cb-surface-card" aria-labelledby="standing-title">
        <header className="mb-base">
          <h2 id="standing-title" className="font-display text-title-md text-ink">
            Class standing
          </h2>
          <p className="mt-1 text-body-sm text-body">
            Highest {formatters.percentage(stats.highestPercentage, 1)} · lowest{' '}
            {formatters.percentage(stats.lowestPercentage, 1)} ·{' '}
            {stats.failedCount} failed · {stats.studentsWithMissingMarks} awaiting marks
          </p>
        </header>

        <dl className="grid grid-cols-2 gap-base md:grid-cols-4">
          <StandingTerm
            label="Full marks"
            value={`${stats.studentsWithFullMarks} of ${stats.studentCount}`}
          />
          <StandingTerm
            label="Missing marks"
            value={`${stats.studentsWithMissingMarks}`}
          />
          <StandingTerm label="Passed" value={`${stats.passedCount}`} />
          <StandingTerm label="Failed" value={`${stats.failedCount}`} />
        </dl>
      </article>

      <SubjectsCard subjects={subjects} />

      <RosterCard
        rows={pageItems}
        total={total}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
      />
    </div>
  );
}

function StandingTerm({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-caption uppercase tracking-wide text-muted">{label}</dt>
      <dd className="num mt-1 text-body-sm font-semibold text-ink">{value}</dd>
    </div>
  );
}

/**
 * The subject-wise standing of the class.
 *
 * The card is a list rather than a table on mobile and a table on tablet
 * and up: the columns are narrow enough to read side by side on a wider
 * screen, but they would squeeze on a phone.
 */
function SubjectsCard({
  subjects,
}: {
  subjects: ClassOverview['subjects'];
}) {
  if (subjects.length === 0) {
    return (
      <EmptyState
        title="No subjects mapped"
        description="This class has no subject offerings yet, so there is nothing to compare."
        variant="card"
      />
    );
  }

  return (
    <article className="cb-surface-card" aria-labelledby="subjects-title">
      <header className="mb-base">
        <h2 id="subjects-title" className="font-display text-title-md text-ink">
          Subject-wise standing
        </h2>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full text-body-sm">
          <thead className="bg-surface-soft">
            <tr>
              <th className="px-base py-sm text-left font-semibold text-muted">Subject</th>
              <th className="px-base py-sm text-right font-semibold text-muted">Average</th>
              <th className="px-base py-sm text-right font-semibold text-muted">Highest</th>
              <th className="px-base py-sm text-left font-semibold text-muted">Topper</th>
              <th className="px-base py-sm text-right font-semibold text-muted">Passed</th>
            </tr>
          </thead>
          <tbody>
            {subjects.map((subject) => (
              <tr key={subject.subjectOfferingId} className="border-t border-hairline first:border-t-0">
                <td className="px-base py-sm text-ink">
                  <span className="num text-muted">{subject.subjectCode}</span>{' '}
                  <span className="font-medium">{subject.subjectName}</span>
                </td>
                <td className="num px-base py-sm text-right text-ink">
                  {formatters.percentage(subject.averagePercentage, 1)}
                </td>
                <td className="num px-base py-sm text-right text-ink">
                  {subject.highestMarks}
                </td>
                <td className="px-base py-sm text-body">
                  {subject.highestScorerName ? (
                    <>
                      <span className="font-medium text-ink">{subject.highestScorerName}</span>{' '}
                      <span className="num text-muted">({subject.highestScorerRollNo})</span>
                    </>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="num px-base py-sm text-right text-ink">
                  {subject.passCount}
                  <span className="text-muted">/{subject.studentsWithMarks}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}

/**
 * The class roster with each student's standing.
 */
function RosterCard({
  rows,
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: {
  rows: ClassStudent[];
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}) {
  return (
    <article className="cb-surface-card" aria-labelledby="roster-title">
      <header className="mb-base">
        <h2 id="roster-title" className="font-display text-title-md text-ink">
          Class roster
        </h2>
      </header>

      {rows.length === 0 ? (
        <EmptyState
          title="No students in this class"
          description="Students appear here once they are added to the class."
          variant="plain"
        />
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-body-sm">
              <thead className="bg-surface-soft">
                <tr>
                  <th className="px-base py-sm text-left font-semibold text-muted">Roll</th>
                  <th className="px-base py-sm text-left font-semibold text-muted">Name</th>
                  <th className="px-base py-sm text-right font-semibold text-muted">Total</th>
                  <th className="px-base py-sm text-right font-semibold text-muted">Percentage</th>
                  <th className="px-base py-sm text-right font-semibold text-muted">Subjects</th>
                  <th className="px-base py-sm text-left font-semibold text-muted">Failed</th>
                  <th className="px-base py-sm text-left font-semibold text-muted">Missing</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((student) => (
                  <tr key={student.id} className="border-t border-hairline first:border-t-0">
                    <td className="num px-base py-sm text-ink">{student.rollNo}</td>
                    <td className="px-base py-sm text-ink">{student.name}</td>
                    <td className="num px-base py-sm text-right text-ink">
                      {student.maxTotalMarks > 0
                        ? formatters.marks(student.totalMarks, student.maxTotalMarks)
                        : '—'}
                    </td>
                    <td className="num px-base py-sm text-right text-ink">
                      {student.subjectsWithMarks > 0
                        ? formatters.percentage(student.percentage, 1)
                        : '—'}
                    </td>
                    <td className="num px-base py-sm text-right text-ink">
                      {student.subjectsWithMarks}
                    </td>
                    <td className="px-base py-sm">
                      {student.failedSubjects.length ? (
                        <span className="num text-semantic-down">
                          {student.failedSubjects.join(', ')}
                        </span>
                      ) : (
                        <span className="text-body">—</span>
                      )}
                    </td>
                    <td className="px-base py-sm text-body">
                      {student.missingSubjects.length ? (
                        <span className="num">{student.missingSubjects.join(', ')}</span>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {total > 0 ? (
            <Pagination
              page={page}
              pageSize={pageSize}
              total={total}
              onPageChange={onPageChange}
              onPageSizeChange={onPageSizeChange}
              className="border-t border-hairline px-4 py-sm"
            />
          ) : null}
        </>
      )}
    </article>
  );
}
