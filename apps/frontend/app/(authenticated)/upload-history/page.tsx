'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { FileSpreadsheet, SearchX, Upload, X } from 'lucide-react';

import { RequirePermission } from '@/components/auth/RequirePermission';
import { DataTable, type DataTableColumn } from '@/components/forms/DataTable';
import { FilterBar } from '@/components/forms/FilterBar';
import { Pagination } from '@/components/forms/Pagination';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import {
  Select as FilterSelect,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorBanner } from '@/components/feedback/ErrorBanner';
import { useUploadJobs } from '@/hooks/useUpload';
import { useCurrentUser } from '@/hooks/useAuth';
import { formatters } from '@/lib/utils/formatters';
import { cn } from '@/lib/utils';
import type { UploadJob, UploadStatus } from '@/lib/services/upload.service';

/** The status a job can be in, in the order they progress. */
const STATUSES: Array<{ value: UploadStatus; label: string }> = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'PROCESSING', label: 'Processing' },
  { value: 'EXTRACTED', label: 'Extracted' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'FAILED', label: 'Failed' },
];

const STATUS_LABEL: Record<UploadStatus, string> = {
  PENDING: 'Pending',
  PROCESSING: 'Processing',
  EXTRACTED: 'Extracted',
  COMPLETED: 'Completed',
  FAILED: 'Failed',
};

/**
 * The status pill.
 *
 * The colour comes from the design system's semantic tokens only — the
 * accent for work still in flight, the up-token for a finished parse and the
 * down-token for a failure.
 */
const STATUS_TONE: Record<UploadStatus, string> = {
  PENDING: 'bg-accent-yellow',
  PROCESSING: 'bg-accent-yellow',
  EXTRACTED: 'bg-semantic-up',
  COMPLETED: 'bg-semantic-up',
  FAILED: 'bg-semantic-down',
};

/**
 * UploadHistoryPage — every upload job the member may read.
 *
 * This is the screen the dashboard's "View all" link belongs to. The upload
 * screen itself shows one job — the one being worked on — so the history of
 * every file that has gone through the system needs a home of its own.
 *
 * The exam cell sees the whole college's trail; a teacher sees only the jobs
 * they raised. The server decides which, so this page never reasons about
 * the caller's reach.
 */
export default function UploadHistoryPage() {
  // Radix Select cannot use an empty string as an item value, so the "no
  // filter" state is a sentinel and is translated before the request.
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    setPage(1);
  }, [statusFilter]);

  const filters = useMemo(
    () => ({
      page,
      pageSize,
      status: statusFilter === 'all' ? undefined : (statusFilter as UploadStatus),
    }),
    [statusFilter, page, pageSize],
  );

  const { data, isLoading, isError, refetch } = useUploadJobs(filters);

  const { data: user } = useCurrentUser();
  const canUpload = (user?.permissions ?? []).includes('upload:create');

  const rows = data?.items ?? [];
  const meta = data?.meta;
  const hasActiveFilters = statusFilter !== 'all';

  const clearFilters = () => setStatusFilter('all');

  const columns: DataTableColumn<UploadJob>[] = [
    {
      key: 'fileName',
      header: 'File',
      render: (row) => (
        <span className="block max-w-md truncate font-semibold text-ink">{row.fileName}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <UploadStatusBadge status={row.status} />,
    },
    {
      key: 'uploadedBy',
      header: 'Uploaded by',
      render: (row) => (
        <span className="text-body-sm text-body">
          {row.uploadedByUser?.name ?? row.uploadedByUser?.email ?? '—'}
        </span>
      ),
    },
    {
      key: 'createdAt',
      header: 'Uploaded',
      className: 'text-right',
      render: (row) => (
        <span className="num whitespace-nowrap text-body-sm text-muted">
          {formatters.date(row.createdAt, 'long')}
        </span>
      ),
    },
  ];

  return (
    <RequirePermission permissions={['upload:read']}>
      <section className="flex flex-col gap-6 md:gap-8">
        <PageHeader
          title="Upload History"
          description="Every result file that has been processed, newest first."
          actions={
            canUpload ? (
              <Button asChild className="w-full md:w-auto">
                <Link href="/upload">
                  <Upload aria-hidden />
                  Upload results
                </Link>
              </Button>
            ) : undefined
          }
        />

        <FilterBar
          hasActiveFilters={hasActiveFilters}
          onClearFilters={clearFilters}
          resultCount={
            meta && meta.total > 0 ? `${meta.total} upload${meta.total === 1 ? '' : 's'}` : undefined
          }
        >
          <FilterSelect value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full md:w-48" aria-label="Filter by status">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {STATUSES.map((status) => (
                <SelectItem key={status.value} value={status.value}>
                  {status.label}
                </SelectItem>
              ))}
            </SelectContent>
          </FilterSelect>
        </FilterBar>

        {isError ? (
          <ErrorBanner message="Could not load the upload history." retry={() => refetch()} />
        ) : null}

        <DataTable
          columns={columns}
          rows={rows}
          keyExtractor={(row) => row.id}
          loading={isLoading}
          cardRender={(row) => (
            <div className="flex flex-col gap-2">
              <p className="truncate font-semibold text-ink">{row.fileName}</p>
              <div className="flex items-center justify-between gap-3">
                <UploadStatusBadge status={row.status} />
                <span className="num whitespace-nowrap text-caption text-muted">
                  {formatters.date(row.createdAt, 'long')}
                </span>
              </div>
              {row.uploadedByUser?.name || row.uploadedByUser?.email ? (
                <p className="truncate text-caption text-muted">
                  Uploaded by {row.uploadedByUser?.name ?? row.uploadedByUser?.email}
                </p>
              ) : null}
            </div>
          )}
          emptyState={
            hasActiveFilters ? (
              // Filtered-empty: the jobs exist but are hidden by the filter,
              // so the state explains the cause and offers a reset.
              <EmptyState
                variant="plain"
                title="No uploads match this filter"
                description="Adjust the filter, or clear it to see every upload."
                icon={<SearchX aria-hidden />}
                action={
                  <Button variant="secondary" onClick={clearFilters}>
                    <X aria-hidden />
                    Clear filters
                  </Button>
                }
              />
            ) : (
              <EmptyState
                variant="plain"
                title="No uploads yet"
                description="Upload an Excel, CSV or PDF result file to start the trail."
                icon={<FileSpreadsheet aria-hidden />}
                action={
                  canUpload ? (
                    <Button asChild>
                      <Link href="/upload">
                        <Upload aria-hidden />
                        Upload results
                      </Link>
                    </Button>
                  ) : undefined
                }
              />
            )
          }
          footer={
            !isLoading && meta && meta.total > 0 ? (
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
      </section>
    </RequirePermission>
  );
}

/** The status pill for one job. */
function UploadStatusBadge({ status }: { status: UploadStatus }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={cn('size-2 shrink-0 rounded-full', STATUS_TONE[status])} aria-hidden />
      <span className="text-body-sm capitalize text-body">{STATUS_LABEL[status]}</span>
    </span>
  );
}
