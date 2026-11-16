'use client';

import { useEffect, useMemo, useState } from 'react';
import { Download, FileSpreadsheet, Loader2, FileCheck2, AlertCircle, Clock, Archive } from 'lucide-react';
import { DataTable, type DataTableColumn } from '@/components/forms/DataTable';
import { Pagination } from '@/components/forms/Pagination';
import { PageHeader } from '@/components/layout/PageHeader';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorBanner } from '@/components/feedback/ErrorBanner';
import {
  ArchiveReportDialog,
  type ArchiveReportTarget,
} from '@/components/feedback/ArchiveReportDialog';
import { Select } from '@/components/forms/Select';
import { ClassContextBar } from '@/components/context/ClassContextBar';
import {
  useGenerateReport,
  useReports,
  useArchiveReport,
  useDownloadReport,
  useReportReadiness,
} from '@/hooks/useReports';
import { useAcademicYears } from '@/hooks/useAcademic';
import { useCurrentUser } from '@/hooks/useAuth';
import { useClassContext } from '@/lib/context/class-context';
import { formatters } from '@/lib/utils/formatters';
import type { Report, ReportType, ReportReadiness } from '@/lib/services/reports.service';

const REPORT_TYPES: Array<{ value: ReportType; label: string }> = [
  { value: 'STUDENT_WISE', label: 'Student-wise result' },
  { value: 'SCHEME_WISE', label: 'Scheme-wise marks' },
  { value: 'SUBJECT_ANALYSIS', label: 'Subject analysis' },
  { value: 'CLASS_TOPPERS', label: 'Class toppers' },
  { value: 'PASS_FAIL', label: 'Pass / fail analysis' },
];

const TYPE_LABEL: Record<ReportType, string> = {
  STUDENT_WISE: 'Student-wise result',
  SCHEME_WISE: 'Scheme-wise marks',
  SUBJECT_ANALYSIS: 'Subject analysis',
  STUDENT_ANALYSIS: 'Student analysis',
  CLASS_TOPPERS: 'Class toppers',
  PASS_FAIL: 'Pass / fail analysis',
  COMPLETE: 'Complete result',
};

const STATUS_LABEL: Record<Report['status'], string> = {
  PENDING: 'Queued',
  PROCESSING: 'Generating',
  COMPLETED: 'Ready',
  FAILED: 'Failed',
};

const STATUS_TONE: Record<Report['status'], string> = {
  PENDING: 'bg-surface-strong text-ink',
  PROCESSING: 'bg-surface-strong text-primary',
  COMPLETED: 'bg-surface-strong text-semantic-up',
  FAILED: 'bg-surface-strong text-semantic-down',
};

export default function ReportsPage() {
  /**
   * The class comes from the shared context, so the report is generated for
   * the same class the marks were entered for — chosen once, on whichever
   * screen the member happened to be on.
   */
  const { context: classContext } = useClassContext();
  const branchId = classContext.branchId;
  const schemeId = classContext.schemeId;
  const semester = classContext.semester;
  const effectiveAcademicYearId = classContext.academicYearId;

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [reportType, setReportType] = useState<ReportType>('STUDENT_WISE');

  const { data: academicYears } = useAcademicYears();

  const { mutate: generate, isPending: generating } = useGenerateReport();
  const { data: reportsData, isLoading: loadingList, isError, refetch } = useReports({
    page,
    pageSize,
  });
  const { mutate: download, isPending: downloading } = useDownloadReport();

  /**
   * Whether this member may generate — and therefore archive — a report.
   *
   * The archive button is gated on the same permission the server checks, so
   * a member who may only read reports is never shown a button that would
   * be refused.
   */
  const { data: user } = useCurrentUser();
  const canManageReports = (user?.permissions ?? []).includes('reports:generate');

  /**
   * Archiving a report.
   *
   * The report is not deleted — it is a statement about a class's results,
   * and the record is kept. The confirmation says so, and asks for a reason.
   */
  const [archiveTarget, setArchiveTarget] = useState<ArchiveReportTarget | null>(null);
  const { mutate: archiveReport, isPending: archiving } = useArchiveReport();

  const years = academicYears ?? [];
  const reports = reportsData?.items ?? [];
  const meta = reportsData?.meta;

  useEffect(() => {
    if (meta && meta.totalPages > 0 && page > meta.totalPages) {
      setPage(meta.totalPages);
    }
  }, [meta, page]);

  const scopeReady = !!branchId && !!schemeId && !!effectiveAcademicYearId && semester > 0;

  /**
   * The scope object is built only once the scope is complete. The
   * readiness check is disabled until then, so it never asks the server
   * about a half-picked class.
   */
  const scope = useMemo(
    () =>
      scopeReady
        ? {
            branchId,
            schemeId,
            semester,
            academicYearId: effectiveAcademicYearId,
          }
        : undefined,
    [scopeReady, branchId, schemeId, semester, effectiveAcademicYearId]
  );

  const readinessQuery = useReportReadiness(scope);
  const readiness = readinessQuery.data;

  /**
   * The report is only offered when the class's result is complete. The
   * button stays disabled while the check is still running, so the operator
   * is never offered a report that the server would refuse.
   */
  const resultReady = readiness?.isReady === true;
  const canGenerate = scopeReady && readinessQuery.isSuccess && resultReady && !generating;

  const onGenerate = () => {
    if (!scopeReady || !scope) return;
    generate(
      {
        type: reportType,
        filters: scope,
      },
      { onSuccess: () => setPage(1) },
    );
  };

  const columns: DataTableColumn<Report>[] = [
    {
      key: 'type',
      header: 'Report',
      render: (row) => (
        <div>
          <p className="font-semibold text-ink">{TYPE_LABEL[row.type] ?? row.type}</p>
          <p className="text-caption text-muted">
            {formatters.date(row.createdAt, 'long')}
          </p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <span className={`cb-badge ${STATUS_TONE[row.status]}`}>{STATUS_LABEL[row.status]}</span>
      ),
    },
    {
      key: 'filters',
      header: 'Scope',
      render: (row) => {
        const filters = row.filters as {
          branchId?: string;
          semester?: number;
          academicYearId?: string;
        } | null;
        if (!filters) return <span className="text-muted">—</span>;
        const year = years.find((y) => y.id === filters.academicYearId);
        const parts = [
          filters.branchId ? 'Branch scoped' : 'All branches',
          filters.semester ? `Semester ${filters.semester}` : null,
          year?.year ?? null,
        ].filter(Boolean);
        return <span className="text-body-sm text-body">{parts.join(' · ')}</span>;
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'text-right',
      render: (row) => (
        <div className="flex items-center justify-end gap-xs">
          <button
            type="button"
            onClick={() => download(row.id)}
            disabled={row.status !== 'COMPLETED' || downloading}
            className="cb-btn-tertiary h-11 px-sm disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download className="mr-1 h-4 w-4" aria-hidden /> Download
          </button>
          {/*
           * Archiving is offered only to a member who may generate reports —
           * the same permission that guards the server route.
           */}
          {canManageReports ? (
            <button
              type="button"
              onClick={() =>
                setArchiveTarget({
                  id: row.id,
                  label: `${TYPE_LABEL[row.type] ?? 'Report'} — ${formatters.date(row.createdAt, 'long')}`,
                })
              }
              aria-label={`Archive ${TYPE_LABEL[row.type] ?? 'report'}`}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-strong hover:text-ink"
            >
              <Archive className="h-4 w-4" aria-hidden />
            </button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <section className="flex flex-col gap-6 md:gap-8">
      <PageHeader
        title="Reports"
        description="Generate multi-sheet Excel reports scoped to a branch, scheme, and semester."
      />

      {/* The class — shared with every other class-scoped screen. */}
      <ClassContextBar />

      <article className="cb-surface-card" aria-labelledby="report-config-title">
        <header className="mb-base flex items-center gap-sm">
          <FileSpreadsheet className="h-5 w-5 text-primary" aria-hidden />
          <h2 id="report-config-title" className="font-display text-title-md text-ink">
            Generate new report
          </h2>
        </header>
        <div className="grid grid-cols-1 gap-base md:grid-cols-2 lg:grid-cols-4">
          <Select
            label="Report type"
            value={reportType}
            onChange={(e) => setReportType(e.target.value as ReportType)}
          >
            {REPORT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
        </div>
        {!scopeReady ? (
          <p className="mt-base text-body-sm text-body">
            A branch, scheme and academic year are required — the report is generated for that
            exact scope.
          </p>
        ) : null}

        {scopeReady ? (
          <ReadinessNotice
            readiness={readiness}
            loading={readinessQuery.isLoading}
            error={readinessQuery.isError}
          />
        ) : null}

        <div className="mt-lg flex flex-col gap-sm md:flex-row md:items-center md:justify-end">
          <button
            type="button"
            className="cb-btn-primary w-full md:w-auto"
            disabled={!canGenerate}
            onClick={onGenerate}
          >
            {generating ? (
              <span className="inline-flex items-center gap-sm">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Generating
              </span>
            ) : (
              'Generate report'
            )}
          </button>
        </div>
      </article>

      {isError ? (
        <ErrorBanner message="Could not load reports." retry={() => refetch()} />
      ) : null}

      <section aria-labelledby="recent-reports-title" className="space-y-base">
        <h2 id="recent-reports-title" className="font-display text-title-md text-ink">
          Recent reports
        </h2>
        <DataTable
          columns={columns}
          rows={reports}
          keyExtractor={(row) => row.id}
          loading={loadingList}
          emptyState={
              <EmptyState
                title="No reports generated yet"
                description="Configure a report above and click Generate to create your first multi-sheet Excel."
                icon={<FileCheck2 className="h-8 w-8" aria-hidden />}
              />
            }
            footer={
              !loadingList && meta && meta.total > 0 ? (
                <Pagination
                  page={page}
                  pageSize={pageSize}
                  total={meta.total}
                  onPageChange={setPage}
                  onPageSizeChange={(size) => {
                    setPageSize(size);
                    setPage(1);
                  }}
                />
              ) : undefined
            }
        />

        {reports.some((r) => r.status === 'FAILED') ? (
          <div className="flex items-start gap-sm rounded-md border border-hairline bg-surface-soft px-base py-sm text-body-sm text-semantic-down">
            <AlertCircle className="mt-0.5 h-4 w-4" aria-hidden />
            <span>One or more reports failed. Re-generate with corrected filters.</span>
          </div>
        ) : null}
      </section>

      {/*
       * The archive confirmation. It says plainly what archiving does — the
       * file is released, the record is kept — and asks for a reason.
       */}
      <ArchiveReportDialog
        target={archiveTarget}
        isSubmitting={archiving}
        onClose={() => setArchiveTarget(null)}
        onConfirm={(reportId, reason) =>
          archiveReport(
            { id: reportId, reason },
            { onSuccess: () => setArchiveTarget(null) },
          )
        }
      />
    </section>
  );
}

/**
 * The state of the class's result, shown above the generate button.
 *
 * A report states a verdict — a PASS or a FAIL — for every student in the
 * class, so it is only produced once every student has a result in every
 * subject. This notice says what is still missing, so the operator knows
 * what to enter rather than just that the button is dead.
 */
function ReadinessNotice({
  readiness,
  loading,
  error,
}: {
  readiness?: ReportReadiness;
  loading: boolean;
  error: boolean;
}) {
  if (loading) {
    return (
      <div className="mt-base flex items-center gap-sm rounded-md border border-hairline bg-surface-soft px-base py-sm text-body-sm text-body">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        <span>Checking whether every student&apos;s result is in…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-base flex items-start gap-sm rounded-md border border-hairline bg-surface-soft px-base py-sm text-body-sm text-semantic-down">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <span>Could not check whether the result is complete. Try again.</span>
      </div>
    );
  }

  if (!readiness) return null;

  if (readiness.isReady) {
    return (
      <div className="mt-base flex items-start gap-sm rounded-md border border-hairline bg-surface-soft px-base py-sm text-body-sm text-body">
        <FileCheck2 className="mt-0.5 h-4 w-4 shrink-0 text-semantic-up" aria-hidden />
        <span>
          Every student&apos;s result is in ({readiness.completeCount} of {readiness.studentCount}
          ). The report can be generated.
        </span>
      </div>
    );
  }

  return (
    <div
      className="mt-base flex flex-col gap-sm rounded-md border border-hairline bg-surface-soft px-base py-sm text-body-sm text-body"
      role="status"
    >
      <div className="flex items-start gap-sm">
        <Clock className="mt-0.5 h-4 w-4 shrink-0 text-semantic-down" aria-hidden />
        <div className="min-w-0">
          <p className="font-semibold text-ink">Result not available yet</p>
          <p className="mt-1">{readiness.message}</p>
          <p className="mt-1 text-muted">
            {readiness.completeCount} of {readiness.studentCount} students have a complete result.
            The report is generated once every student&apos;s result is in.
          </p>
        </div>
      </div>

      {readiness.pendingSubjects.length ? (
        <div>
          <p className="text-caption-strong uppercase tracking-wide text-muted">
            Marks still missing
          </p>
          <ul className="mt-1 flex flex-wrap gap-x-sm gap-y-xs">
            {readiness.pendingSubjects.map((subject) => (
              <li key={subject.subjectCode} className="text-body-sm">
                <span className="num font-medium text-ink">{subject.subjectCode}</span>{' '}
                <span className="text-muted">
                  ({subject.missingCount} student{subject.missingCount === 1 ? '' : 's'})
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {readiness.pendingStudents.length ? (
        <details className="text-body-sm">
          <summary className="cursor-pointer font-medium text-ink">
            Students awaiting marks ({readiness.pendingCount})
          </summary>
          <ul className="mt-2 space-y-xs">
            {readiness.pendingStudents.map((student) => (
              <li key={student.rollNo} className="flex flex-wrap items-baseline gap-x-sm">
                <span className="num text-muted">{student.rollNo}</span>
                <span className="font-medium text-ink">{student.name}</span>
                <span className="num text-muted">
                  missing {student.missingSubjects.join(', ')}
                </span>
              </li>
            ))}
          </ul>
          {readiness.pendingCount > readiness.pendingStudents.length ? (
            <p className="mt-2 text-muted">
              and {readiness.pendingCount - readiness.pendingStudents.length} more.
            </p>
          ) : null}
        </details>
      ) : null}
    </div>
  );
}