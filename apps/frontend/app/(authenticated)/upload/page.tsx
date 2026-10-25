'use client';

import { useMemo, useState } from 'react';
import { Loader2, CheckCircle2, AlertCircle, FileCheck2 } from 'lucide-react';
import { FileUploader } from '@/components/forms/FileUploader';
import { PageHeader } from '@/components/layout/PageHeader';
import { Pagination } from '@/components/forms/Pagination';
import { Select } from '@/components/forms/Select';
import { Spinner } from '@/components/feedback/Spinner';
import { ErrorBanner } from '@/components/feedback/ErrorBanner';
import { useCreateUploadJob, useUploadJob, useConfirmUpload } from '@/hooks/useUpload';
import { useBranches } from '@/hooks/useBranches';
import { useSchemes } from '@/hooks/useSchemes';
import { useAcademicYears } from '@/hooks/useAcademic';
import { useTablePagination } from '@/hooks/useTablePagination';
import { formatters } from '@/lib/utils/formatters';
import type {
  ExtractedMarkRow,
  UploadJob,
} from '@/lib/services/upload.service';

const STATUS_LABEL: Record<UploadJob['status'], string> = {
  PENDING: 'Pending',
  PROCESSING: 'Processing',
  EXTRACTED: 'Extracted',
  COMPLETED: 'Completed',
  FAILED: 'Failed',
};

const STATUS_TONE: Record<UploadJob['status'], string> = {
  PENDING: 'bg-surface-strong text-ink',
  PROCESSING: 'bg-surface-strong text-primary',
  EXTRACTED: 'bg-surface-strong text-semantic-up',
  COMPLETED: 'bg-surface-strong text-semantic-up',
  FAILED: 'bg-surface-strong text-semantic-down',
};

export default function UploadPage() {
  const [branchId, setBranchId] = useState('');
  const [schemeId, setSchemeId] = useState('');
  const [semester, setSemester] = useState(1);
  const [academicYearId, setAcademicYearId] = useState('');

  const { data: branchesData } = useBranches();
  const { data: schemesData } = useSchemes();
  const { data: academicYears } = useAcademicYears();

  const { mutate: createJob, isPending: uploading } = useCreateUploadJob();
  const { data: job, isLoading: jobLoading, isError } = useUploadJob();
  const { mutate: confirm, isPending: confirming } = useConfirmUpload();

  const branches = branchesData ?? [];
  const schemes = schemesData ?? [];
  const years = academicYears ?? [];

  const activeYear = years.find((y) => y.isActive) ?? years[0];

  /**
   * The academic year falls back to the active one so the scope is usable
   * without an explicit pick. The state variable alone would stay empty when
   * there is only one academic year, because a Radix select never fires
   * `onValueChange` for the value that is already selected.
   */
  const effectiveAcademicYearId = academicYearId || activeYear?.id || '';

  const scopeReady =
    !!branchId && !!schemeId && !!effectiveAcademicYearId && semester > 0;

  const handleFile = (file: File) => {
    if (!scopeReady) return;
    createJob(file);
  };

  const rows = useMemo(() => (job ? extractRows(job) : []), [job]);
  const parseErrors = job?.extractedData?.errors ?? [];

  return (
    <section className="flex flex-col gap-6 md:gap-8">
      <PageHeader
        title="Upload Results"
        description="Drop an Excel or PDF result file. We extract the data, you review and confirm."
      />

      <article className="cb-surface-card" aria-label="Upload scope">
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
            {years.map((year) => (
              <option key={year.id} value={year.id}>
                {year.year}
              </option>
            ))}
          </Select>
        </div>
        {!scopeReady ? (
          <p className="mt-base text-body-sm text-body">
            Pick a branch, scheme and academic year before uploading — the extracted
            rows are matched against that scope.
          </p>
        ) : null}
      </article>

      <FileUploader
        onFile={handleFile}
        isUploading={uploading}
        disabled={!scopeReady}
        hint="Excel, CSV, or PDF up to 50MB"
      />

      {jobLoading ? (
        <div className="flex items-center gap-sm">
          <Spinner size={20} />
          <span className="text-body-sm text-body">Fetching latest status…</span>
        </div>
      ) : null}

      {isError ? (
        <ErrorBanner
          message="We lost track of this upload. Refresh and try again."
          retry={() => window.location.reload()}
        />
      ) : null}

      {job ? (
        <JobStatusCard
          job={job}
          rows={rows}
          parseErrors={parseErrors}
          onConfirm={() =>
            confirm({
              jobId: job.id,
              payload: {
                rows,
                metadata: {
                  branchId,
                  schemeId,
                  semester,
                  academicYearId: effectiveAcademicYearId,
                },
              },
            })
          }
          confirming={confirming}
        />
      ) : null}
    </section>
  );
}

/**
 * The extractor stores the rows under `extractedData.rows`. Anything that is
 * not shaped like a mark row is ignored rather than sent to the API, because
 * the confirm DTO rejects unknown properties.
 */
function extractRows(job: UploadJob): ExtractedMarkRow[] {
  const raw = Array.isArray(job.extractedData?.rows) ? job.extractedData.rows : [];
  return raw.flatMap((entry) => {
    if (typeof entry !== 'object' || entry === null) return [];
    const row = entry as unknown as Record<string, unknown>;
    const rollNo = String(row.rollNo ?? '').trim();
    const subjectCode = String(row.subjectCode ?? '').trim();
    const examType = String(row.examType ?? '').trim();
    if (!rollNo || !subjectCode || !examType) return [];

    const marksObtained = Number(row.marksObtained);
    const maxMarks = Number(row.maxMarks);
    if (!Number.isFinite(marksObtained) || !Number.isFinite(maxMarks)) return [];

    return [
      {
        rollNo,
        subjectCode,
        examType,
        marksObtained,
        maxMarks,
        ...(row.isAbsent === undefined ? {} : { isAbsent: Boolean(row.isAbsent) }),
      },
    ];
  });
}

interface JobStatusCardProps {
  job: UploadJob;
  rows: ExtractedMarkRow[];
  parseErrors: Array<{ row: number; error: string }>;
  onConfirm: () => void;
  confirming: boolean;
}

function JobStatusCard({ job, rows, parseErrors, onConfirm, confirming }: JobStatusCardProps) {
  const { page, setPage, pageSize, setPageSize, total, pageItems } = useTablePagination(rows, {
    pageSize: 10,
    resetKey: job.id,
  });

  return (
    <article className="cb-surface-card flex flex-col gap-base" aria-labelledby="job-status-title">
      <header className="flex flex-col gap-xs">
        <div className="flex flex-wrap items-center justify-between gap-xs">
          <h2 id="job-status-title" className="font-display text-title-md text-ink">
            {job.fileName}
          </h2>
          <span className={`cb-badge ${STATUS_TONE[job.status]}`}>
            {STATUS_LABEL[job.status]}
          </span>
        </div>
        <p className="text-caption text-muted">
          Started {formatters.date(job.createdAt, 'long')}
        </p>
      </header>

      {job.status === 'PENDING' || job.status === 'PROCESSING' ? (
        <div className="flex items-center gap-sm rounded-md bg-surface-soft px-base py-sm text-body-sm text-body">
          <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden />
          <span>
            {job.status === 'PENDING'
              ? 'Queued for processing — this can take up to a minute.'
              : 'Parsing marks, mapping to scheme…'}
          </span>
        </div>
      ) : null}

      {job.status === 'FAILED' ? (
        <div className="flex items-start gap-sm rounded-md border border-hairline bg-surface-soft px-base py-sm text-body-sm text-semantic-down">
          <AlertCircle className="mt-0.5 h-4 w-4" aria-hidden />
          <span>{job.errorMessage ?? 'Upload failed. Re-upload the file to retry.'}</span>
        </div>
      ) : null}

      {job.status === 'EXTRACTED' && rows.length > 0 ? (
        <>
          <div className="overflow-x-auto rounded-md border border-hairline">
            <table className="min-w-full text-body-sm">
              <thead className="bg-surface-soft text-left text-caption uppercase text-muted">
                <tr>
                  <th className="px-base py-sm font-semibold">Roll No</th>
                  <th className="px-base py-sm font-semibold">Subject</th>
                  <th className="px-base py-sm font-semibold">Exam</th>
                  <th className="px-base py-sm font-semibold">Marks</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((row, idx) => (
                  <tr key={`${row.rollNo}-${row.subjectCode}-${row.examType}-${idx}`} className="border-t border-hairline">
                    <td className="num px-base py-sm text-ink">{row.rollNo}</td>
                    <td className="px-base py-sm text-ink">{row.subjectCode}</td>
                    <td className="px-base py-sm text-ink">{row.examType}</td>
                    <td className="num px-base py-sm text-ink">
                      {row.marksObtained} / {row.maxMarks}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            className="border-t border-hairline pt-sm"
          />
          <div className="flex flex-col gap-sm md:flex-row md:items-center md:justify-end">
            <button
              type="button"
              className="cb-btn-primary"
              onClick={onConfirm}
              disabled={confirming}
            >
              {confirming ? (
                <span className="inline-flex items-center gap-sm">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Confirming
                </span>
              ) : (
                'Confirm and save'
              )}
            </button>
          </div>
        </>
      ) : null}

      {job.status === 'EXTRACTED' && rows.length === 0 ? (
        <div className="flex items-start gap-sm rounded-md border border-hairline bg-surface-soft px-base py-sm text-body-sm text-body">
          <AlertCircle className="mt-0.5 h-4 w-4 text-muted" aria-hidden />
          <span>No rows were extracted. Re-upload a clearer file.</span>
        </div>
      ) : null}

      {parseErrors.length > 0 ? (
        <div className="flex flex-col gap-sm rounded-md border border-hairline bg-surface-soft px-base py-sm">
          <div className="flex items-start gap-sm text-body-sm text-body">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-semantic-down" aria-hidden />
            <span>
              {parseErrors.length} row{parseErrors.length === 1 ? '' : 's'} could not be read and
              will be skipped.
            </span>
          </div>
          <ul className="flex flex-col gap-xs text-caption text-muted">
            {parseErrors.slice(0, 5).map((entry) => (
              <li key={`${entry.row}-${entry.error}`}>
                Row {entry.row}: {entry.error}
              </li>
            ))}
            {parseErrors.length > 5 ? (
              <li>…and {parseErrors.length - 5} more</li>
            ) : null}
          </ul>
        </div>
      ) : null}

      {job.status === 'COMPLETED' ? (
        <div className="flex items-start gap-sm rounded-md border border-hairline bg-surface-soft px-base py-sm text-body-sm text-semantic-up">
          <CheckCircle2 className="mt-0.5 h-4 w-4" aria-hidden />
          <span>
            Data saved. Open{' '}
            <a href="/students" className="font-semibold underline">
              Students
            </a>{' '}
            to review.
          </span>
          <FileCheck2 className="ml-auto h-4 w-4 text-semantic-up" aria-hidden />
        </div>
      ) : null}
    </article>
  );
}
