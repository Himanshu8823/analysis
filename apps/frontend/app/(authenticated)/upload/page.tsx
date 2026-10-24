'use client';

import { useMemo, useState } from 'react';
import { Loader2, CheckCircle2, AlertCircle, FileCheck2 } from 'lucide-react';
import { FileUploader } from '@/components/forms/FileUploader';
import { Spinner } from '@/components/feedback/Spinner';
import { ErrorBanner } from '@/components/feedback/ErrorBanner';
import { useUploadFile, useUploadJob, useConfirmUpload } from '@/hooks/useUpload';
import { formatters } from '@/lib/utils/formatters';
import type { UploadJob } from '@/lib/services/upload.service';

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
  const [jobId, setJobId] = useState<string | null>(null);
  const { mutate: upload, isPending: uploading } = useUploadFile();
  const { data: job, isLoading: jobLoading, isError } = useUploadJob(jobId);
  const { mutate: confirm, isPending: confirming } = useConfirmUpload();

  const handleFile = (file: File) => {
    upload(file, {
      onSuccess: (result) => setJobId(result.id),
      onError: () => setJobId(null),
    });
  };

  const rows = useMemo(() => job?.extractedRows ?? [], [job?.extractedRows]);

  return (
    <section className="mx-auto flex max-w-4xl flex-col gap-lg">
      <header className="flex flex-col gap-xs">
        <span className="cb-badge">Upload</span>
        <h1 className="font-display text-title-lg text-ink md:text-display-sm">
          Upload Results
        </h1>
        <p className="text-body-sm text-body md:text-body-md">
          Drop an Excel or PDF result file. We extract the data, you review and confirm.
        </p>
      </header>

      <FileUploader
        onFile={handleFile}
        isUploading={uploading}
        hint="Excel, CSV, or PDF up to 50MB"
      />

      {jobId && jobLoading ? (
        <div className="flex items-center gap-sm">
          <Spinner size={20} />
          <span className="text-body-sm text-body">Fetching latest status…</span>
        </div>
      ) : null}

      {isError ? (
        <ErrorBanner
          message="We lost track of this upload. Refresh and try again."
          retry={() => setJobId(null)}
        />
      ) : null}

      {job ? (
        <JobStatusCard
          job={job}
          rows={rows}
          onConfirm={() => confirm({ jobId: job.id, edits: { rows } })}
          confirming={confirming}
        />
      ) : null}
    </section>
  );
}

interface JobStatusCardProps {
  job: UploadJob;
  rows: Array<Record<string, unknown>>;
  onConfirm: () => void;
  confirming: boolean;
}

function JobStatusCard({ job, rows, onConfirm, confirming }: JobStatusCardProps) {
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
                  {Object.keys(rows[0]).map((key) => (
                    <th key={key} className="px-base py-sm font-semibold">
                      {key}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 8).map((row, idx) => (
                  <tr key={idx} className="border-t border-hairline">
                    {Object.values(row).map((value, i) => (
                      <td key={i} className="px-base py-sm text-ink">
                        {String(value ?? '')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-caption text-muted">
            Showing {Math.min(rows.length, 8)} of {rows.length} extracted rows.
          </p>
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