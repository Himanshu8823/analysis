'use client';

import { CalendarRange } from 'lucide-react';

import { DataTable, type DataTableColumn } from '@/components/forms/DataTable';
import { Pagination } from '@/components/forms/Pagination';
import { PageHeader } from '@/components/layout/PageHeader';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorBanner } from '@/components/feedback/ErrorBanner';
import { useAcademicYears } from '@/hooks/useAcademic';
import { useTablePagination } from '@/hooks/useTablePagination';
import type { AcademicYear } from '@/lib/services/academic.service';
import { formatters } from '@/lib/utils/formatters';

export default function AdminAcademicYearsPage() {
  const { data, isLoading, isError, refetch } = useAcademicYears();

  const years = data ?? [];
  const { page, setPage, pageSize, setPageSize, total, pageItems } = useTablePagination(years);

  const columns: DataTableColumn<AcademicYear>[] = [
    {
      key: 'year',
      header: 'Year',
      render: (row) => <span className="num font-semibold text-ink">{row.year}</span>,
    },
    {
      key: 'startDate',
      header: 'Starts',
      render: (row) => (
        <span className="text-body-sm text-body">
          {formatters.date(row.startDate, 'short')}
        </span>
      ),
    },
    {
      key: 'endDate',
      header: 'Ends',
      render: (row) => (
        <span className="text-body-sm text-body">{formatters.date(row.endDate, 'short')}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <span className="cb-badge">{row.isActive ? 'Active' : 'Inactive'}</span>
      ),
    },
  ];

  return (
    <section className="flex flex-col gap-6 md:gap-8">
      <PageHeader
        title="Academic Years"
        description="The academic years that students, batches and results are grouped by."
      />

      {isError ? (
        <ErrorBanner message="Could not load academic years." retry={() => refetch()} />
      ) : null}

      <DataTable
        columns={columns}
        rows={pageItems}
        keyExtractor={(row) => row.id}
        loading={isLoading}
        emptyState={
            // The backend exposes no create endpoint for academic years, so
            // there is deliberately no "Add academic year" action here — a
            // button that cannot save would ship a broken feature. The state
            // says where the data comes from instead.
            <EmptyState
              variant="plain"
              title="No academic years configured"
              description="Academic years are defined by the backend seed and the database. Ask a Super Admin to add a year there, then reload this page."
              icon={<CalendarRange aria-hidden />}
            />
          }
          footer={
            !isLoading && total > 0 ? (
              <Pagination
                page={page}
                pageSize={pageSize}
                total={total}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
              />
            ) : undefined
          }
      />
    </section>
  );
}
