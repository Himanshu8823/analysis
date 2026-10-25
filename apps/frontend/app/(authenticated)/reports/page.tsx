'use client';

import { useEffect, useState } from 'react';
import { Download, FileSpreadsheet, Loader2, FileCheck2, AlertCircle } from 'lucide-react';
import { DataTable, type DataTableColumn } from '@/components/forms/DataTable';
import { Pagination } from '@/components/forms/Pagination';
import { PageHeader } from '@/components/layout/PageHeader';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorBanner } from '@/components/feedback/ErrorBanner';
import { Select } from '@/components/forms/Select';
import {
  useGenerateReport,
  useReports,
  useDownloadReport,
} from '@/hooks/useReports';
import { useBranches } from '@/hooks/useBranches';
import { useSchemes } from '@/hooks/useSchemes';
import { useAcademicYears } from '@/hooks/useAcademic';
import { formatters } from '@/lib/utils/formatters';
import type { Report, ReportType } from '@/lib/services/reports.service';

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
  const [branchId, setBranchId] = useState('');
  const [schemeId, setSchemeId] = useState('');
  const [semester, setSemester] = useState(1);
  const [academicYearId, setAcademicYearId] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [reportType, setReportType] = useState<ReportType>('STUDENT_WISE');

  const { data: branchesData } = useBranches();
  const { data: schemesData } = useSchemes();
  const { data: academicYears } = useAcademicYears();

  const { mutate: generate, isPending: generating } = useGenerateReport();
  const { data: reportsData, isLoading: loadingList, isError, refetch } = useReports({
    page,
    pageSize,
  });
  const { mutate: download, isPending: downloading } = useDownloadReport();

  const branches = branchesData ?? [];
  const schemes = schemesData ?? [];
  const years = academicYears ?? [];
  const reports = reportsData?.items ?? [];
  const meta = reportsData?.meta;

  useEffect(() => {
    if (meta && meta.totalPages > 0 && page > meta.totalPages) {
      setPage(meta.totalPages);
    }
  }, [meta, page]);

  // The backend requires an academic year for every report scope.
  const activeYear = years.find((y) => y.isActive) ?? years[0];
  const effectiveAcademicYearId = academicYearId || activeYear?.id || '';

  const scopeReady = !!branchId && !!schemeId && !!effectiveAcademicYearId && semester > 0;

  const onGenerate = () => {
    if (!scopeReady) return;
    generate(
      {
        type: reportType,
        filters: {
          branchId,
          schemeId,
          semester,
          academicYearId: effectiveAcademicYearId,
        },
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
        <button
          type="button"
          onClick={() => download(row.id)}
          disabled={row.status !== 'COMPLETED' || downloading}
          className="cb-btn-tertiary h-11 px-sm disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Download className="mr-1 h-4 w-4" aria-hidden /> Download
        </button>
      ),
    },
  ];

  return (
    <section className="flex flex-col gap-6 md:gap-8">
      <PageHeader
        title="Reports"
        description="Generate multi-sheet Excel reports scoped to a branch, scheme, and semester."
      />

      <article className="cb-surface-card" aria-labelledby="report-config-title">
        <header className="mb-base flex items-center gap-sm">
          <FileSpreadsheet className="h-5 w-5 text-primary" aria-hidden />
          <h2 id="report-config-title" className="font-display text-title-md text-ink">
            Generate new report
          </h2>
        </header>
        <div className="grid grid-cols-1 gap-base md:grid-cols-2 lg:grid-cols-4">
          <Select
            label="Branch"
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
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
            onChange={(e) => setSchemeId(e.target.value)}
          >
            <option value="">Select scheme</option>
            {schemes.map((scheme) => (
              <option key={scheme.id} value={scheme.id}>
                {scheme.name}
              </option>
            ))}
          </Select>
          <Select
            label="Semester"
            value={String(semester)}
            onChange={(e) => setSemester(Number(e.target.value))}
          >
            {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
              <option key={n} value={n}>
                Semester {n}
              </option>
            ))}
          </Select>
          <Select
            label="Academic year"
            value={effectiveAcademicYearId}
            onChange={(e) => setAcademicYearId(e.target.value)}
          >
            {years.length === 0 ? (
              <option value="">No academic years</option>
            ) : null}
            {years.map((year) => (
              <option key={year.id} value={year.id}>
                {year.year}
              </option>
            ))}
          </Select>
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
        <div className="mt-lg flex flex-col gap-sm md:flex-row md:items-center md:justify-end">
          <button
            type="button"
            className="cb-btn-primary w-full md:w-auto"
            disabled={!scopeReady || generating}
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
    </section>
  );
}