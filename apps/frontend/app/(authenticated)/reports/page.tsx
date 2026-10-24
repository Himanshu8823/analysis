'use client';

import { useState } from 'react';
import { Download, FileSpreadsheet, Loader2, FileCheck2, AlertCircle } from 'lucide-react';
import { DataTable, type DataTableColumn } from '@/components/forms/DataTable';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorBanner } from '@/components/feedback/ErrorBanner';
import { Spinner } from '@/components/feedback/Spinner';
import { Select } from '@/components/forms/Select';
import {
  useGenerateReport,
  useReports,
  useDownloadReport,
} from '@/hooks/useReports';
import { useBranches } from '@/hooks/useBranches';
import { useSchemes } from '@/hooks/useSchemes';
import { formatters } from '@/lib/utils/formatters';
import type { GenerateReportPayload, Report } from '@/lib/services/reports.service';

const REPORT_TYPES: Array<{ value: GenerateReportPayload['reportType']; label: string }> = [
  { value: 'STUDENT_WISE', label: 'Student-wise result' },
  { value: 'SCHEME_WISE', label: 'Scheme-wise marks' },
  { value: 'SUBJECT_ANALYSIS', label: 'Subject analysis' },
  { value: 'CLASS_TOPPERS', label: 'Class toppers' },
  { value: 'PASS_FAIL', label: 'Pass / fail analysis' },
];

const STATUS_LABEL: Record<Report['status'], string> = {
  PENDING: 'Queued',
  GENERATING: 'Generating',
  READY: 'Ready',
  FAILED: 'Failed',
};

const STATUS_TONE: Record<Report['status'], string> = {
  PENDING: 'bg-surface-strong text-ink',
  GENERATING: 'bg-surface-strong text-primary',
  READY: 'bg-surface-strong text-semantic-up',
  FAILED: 'bg-surface-strong text-semantic-down',
};

export default function ReportsPage() {
  const [branchId, setBranchId] = useState('');
  const [schemeId, setSchemeId] = useState('');
  const [semester, setSemester] = useState(1);
  const [reportType, setReportType] = useState<GenerateReportPayload['reportType']>(
    'STUDENT_WISE',
  );

  const { data: branchesData } = useBranches();
  const { data: schemesData } = useSchemes();

  const { mutate: generate, isPending: generating } = useGenerateReport();
  const { data: reportsData, isLoading: loadingList, isError, refetch } = useReports();
  const { mutate: download, isPending: downloading } = useDownloadReport();

  const branches = branchesData?.data ?? [];
  const schemes = schemesData?.data ?? [];
  const reports = reportsData?.data ?? [];

  const onGenerate = () => {
    if (!branchId || !schemeId) return;
    generate({ branchId, schemeId, semester, reportType });
  };

  const columns: DataTableColumn<Report>[] = [
    {
      key: 'name',
      header: 'Report',
      render: (row) => (
        <div>
          <p className="font-semibold text-ink">{row.name}</p>
          <p className="text-caption text-muted">
            {row.generatedAt ? formatters.date(row.generatedAt, 'long') : '—'}
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
      key: 'fileSize',
      header: 'Size',
      render: (row) =>
        row.fileSize ? formatters.fileSize(row.fileSize) : <span className="text-muted">—</span>,
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'text-right',
      render: (row) => (
        <button
          type="button"
          onClick={() => download(row.id)}
          disabled={row.status !== 'READY' || downloading}
          className="cb-btn-tertiary h-11 px-sm disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Download className="mr-1 h-4 w-4" aria-hidden /> Download
        </button>
      ),
    },
  ];

  return (
    <section className="space-y-lg">
      <header className="flex flex-col gap-xs">
        <span className="cb-badge">Reports</span>
        <h1 className="font-display text-title-lg text-ink md:text-display-sm">Reports</h1>
        <p className="text-body-sm text-body">
          Generate multi-sheet Excel reports scoped to a branch, scheme, and semester.
        </p>
      </header>

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
                {scheme.code} · {scheme.name}
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
            label="Report type"
            value={reportType}
            onChange={(e) => setReportType(e.target.value as GenerateReportPayload['reportType'])}
          >
            {REPORT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="mt-lg flex flex-col gap-sm md:flex-row md:items-center md:justify-end">
          <button
            type="button"
            className="cb-btn-primary w-full md:w-auto"
            disabled={!branchId || !schemeId || generating}
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
        {loadingList ? (
          <div className="flex items-center gap-sm text-body-sm text-body">
            <Spinner size={16} /> Loading reports…
          </div>
        ) : (
          <DataTable
            columns={columns}
            rows={reports}
            keyExtractor={(row) => row.id}
            emptyState={
              <EmptyState
                title="No reports generated yet"
                description="Configure a report above and click Generate to create your first multi-sheet Excel."
                icon={<FileCheck2 className="h-8 w-8" aria-hidden />}
              />
            }
          />
        )}
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