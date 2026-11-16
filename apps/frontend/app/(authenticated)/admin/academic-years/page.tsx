'use client';

import { useState } from 'react';
import { CalendarRange, CheckCircle2, Loader2, Plus } from 'lucide-react';

import { DataTable, type DataTableColumn } from '@/components/forms/DataTable';
import { Pagination } from '@/components/forms/Pagination';
import { PageHeader } from '@/components/layout/PageHeader';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorBanner } from '@/components/feedback/ErrorBanner';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  useAcademicYears,
  useActivateAcademicYear,
  useCreateAcademicYear,
  useRunningYear,
} from '@/hooks/useAcademic';
import { useCurrentUser } from '@/hooks/useAuth';
import { useTablePagination } from '@/hooks/useTablePagination';
import type { AcademicYear } from '@/lib/services/academic.service';
import { formatters } from '@/lib/utils/formatters';

export default function AdminAcademicYearsPage() {
  const { data, isLoading, isError, refetch } = useAcademicYears();
  const runningYear = useRunningYear();
  const { data: user } = useCurrentUser();

  /**
   * Opening an academic year and changing which one is running are the
   * administrator's powers — a member who may read the years may not
   * change them.
   */
  const canManage = (user?.permissions ?? []).includes('academic_years:write');

  const [addOpen, setAddOpen] = useState(false);
  const [year, setYear] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const createYear = useCreateAcademicYear();
  const activateYear = useActivateAcademicYear();

  const years = data ?? [];
  const { page, setPage, pageSize, setPageSize, total, pageItems } = useTablePagination(years);

  const resetForm = () => {
    setYear('');
    setStartDate('');
    setEndDate('');
    setFormError(null);
  };

  const handleCreate = () => {
    if (!year.trim()) {
      setFormError('Write the year in the form 2024-25.');
      return;
    }
    if (!startDate || !endDate) {
      setFormError('Give the dates the year runs between.');
      return;
    }
    if (new Date(endDate) <= new Date(startDate)) {
      setFormError('The year must end after it starts. Check the dates you entered.');
      return;
    }

    setFormError(null);
    createYear.mutate(
      { year: year.trim(), startDate, endDate },
      {
        onSuccess: () => {
          resetForm();
          setAddOpen(false);
        },
      }
    );
  };

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
      /**
       * The status is derived from the **dates**, not from the stored
       * flag.
       *
       * The dates are what the college agreed to run, and they are what
       * every screen uses to decide which year is current. A flag that
       * contradicts them is a data-entry mistake — so the screen says what
       * the dates say, and does not quietly repeat a flag that disagrees.
       */
      key: 'status',
      header: 'Status',
      render: (row) => {
        const isRunning = runningYear.year?.id === row.id;
        const hasStarted = new Date(row.startDate).getTime() <= Date.now();
        const hasEnded = new Date(row.endDate).getTime() < Date.now();

        const label = isRunning
          ? 'Running now'
          : !hasStarted
            ? 'Not started'
            : hasEnded
              ? 'Finished'
              : 'Scheduled';

        return <span className="cb-badge">{label}</span>;
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'text-right',
      render: (row) => {
        if (!canManage) return <span className="text-caption text-muted">—</span>;

        const isRunning = runningYear.year?.id === row.id;

        return (
          <Button
            type="button"
            variant="outline"
            onClick={() => activateYear.mutate(row.id)}
            disabled={isRunning || activateYear.isPending}
            title={
              isRunning
                ? 'This is already the running year'
                : 'Make this the running year. The previous running year is retired.'
            }
          >
            {activateYear.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <CheckCircle2 className="h-4 w-4" aria-hidden />
            )}
            {isRunning ? 'Running now' : 'Make it the running year'}
          </Button>
        );
      },
    },
  ];

  return (
    <section className="flex flex-col gap-6 md:gap-8">
      <PageHeader
        title="Academic Years"
        description="The academic years that students, batches and results are grouped by. The running year is the one the college is in right now."
      />

      {isError ? (
        <ErrorBanner message="Could not load academic years." retry={() => refetch()} />
      ) : null}

      {canManage ? (
        <div className="flex justify-end">
          <Button
            type="button"
            onClick={() => setAddOpen(true)}
            className="w-full sm:w-auto"
          >
            <Plus aria-hidden />
            Add an academic year
          </Button>
        </div>
      ) : null}

      <DataTable
        columns={columns}
        rows={pageItems}
        keyExtractor={(row) => row.id}
        loading={isLoading}
        emptyState={
          <EmptyState
            variant="plain"
            title="No academic years configured"
            description={
              canManage
                ? 'Add the academic year the college is running, with the dates it runs between. The system uses those dates to work out which year is current.'
                : 'Academic years are set by the college administrator. Ask them to add the year the college is running, then reload this page.'
            }
            icon={<CalendarRange aria-hidden />}
            action={
              canManage ? (
                <Button
                  type="button"
                  onClick={() => setAddOpen(true)}
                >
                  <Plus aria-hidden />
                  Add an academic year
                </Button>
              ) : undefined
            }
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

      {/*
       * The form for opening an academic year.
       *
       * The dates are required because the system works out which year is
       * running by comparing today's date against them — a year with no
       * dates would be a year the system could not reason about.
       */}
      <Sheet
        open={addOpen}
        onOpenChange={(next) => {
          if (!next) resetForm();
          setAddOpen(next);
        }}
      >
        <SheetContent side="dialog">
          <SheetHeader>
            <SheetTitle>Add an academic year</SheetTitle>
            <SheetDescription>
              Write the year the way the college writes it, and give the dates it runs between.
              The system uses those dates to work out which year is running.
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-base py-base">
            <div className="flex flex-col gap-xs">
              <label htmlFor="year-label" className="text-body-sm font-semibold text-ink">
                The year
              </label>
              <input
                id="year-label"
                type="text"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                placeholder="2024-25"
                className="cb-input num w-full"
              />
            </div>

            <div className="grid grid-cols-1 gap-base md:grid-cols-2">
              <div className="flex flex-col gap-xs">
                <label htmlFor="year-start" className="text-body-sm font-semibold text-ink">
                  It starts on
                </label>
                <input
                  id="year-start"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="cb-input w-full"
                />
              </div>

              <div className="flex flex-col gap-xs">
                <label htmlFor="year-end" className="text-body-sm font-semibold text-ink">
                  It ends on
                </label>
                <input
                  id="year-end"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="cb-input w-full"
                />
              </div>
            </div>

            {formError ? (
              <p role="alert" className="text-body-sm text-semantic-down">
                {formError}
              </p>
            ) : null}
          </div>

          <SheetFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                resetForm();
                setAddOpen(false);
              }}
              disabled={createYear.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleCreate}
              disabled={createYear.isPending}
            >
              {createYear.isPending ? (
                <span className="inline-flex items-center gap-sm">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Adding
                </span>
              ) : (
                <>
                  <Plus aria-hidden />
                  Add the year
                </>
              )}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </section>
  );
}
