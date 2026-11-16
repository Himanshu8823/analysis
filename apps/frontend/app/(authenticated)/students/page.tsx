'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus, Upload, Trash2, Pencil, Users, UserRound, KeyRound, SearchX, X } from 'lucide-react';
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorBanner } from '@/components/feedback/ErrorBanner';
import { useStudents, useDeleteStudent } from '@/hooks/useStudents';
import { useCurrentUser } from '@/hooks/useAuth';
import { useBranches } from '@/hooks/useBranches';
import { useSchemes } from '@/hooks/useSchemes';
import { yearForSemester } from '@/lib/academic';
import { studentStatusLabel } from '@/lib/utils/student-labels';
import type { Student } from '@/lib/services/students.service';

export default function StudentsPage() {
  const [search, setSearch] = useState('');
  // Radix Select cannot use an empty string as an item value, so the
  // "no filter" state is the sentinel below and is translated to
  // `undefined` before the request goes out.
  const [branchFilter, setBranchFilter] = useState('all');
  const [schemeFilter, setSchemeFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  /**
   * The student whose removal is being confirmed.
   *
   * Removing a student is a consequential act, so it is confirmed in a
   * dialog that says what it affects — rather than in a browser prompt
   * that can only ask a yes-or-no question.
   */
  const [studentToRemove, setStudentToRemove] = useState<Student | null>(null);

  useEffect(() => {
    setPage(1);
  }, [search, branchFilter, schemeFilter]);

  const { data: branchesData } = useBranches();
  const { data: schemesData } = useSchemes();

  const filters = useMemo(
    () => ({
      search: search || undefined,
      branchId: branchFilter === 'all' ? undefined : branchFilter,
      schemeId: schemeFilter === 'all' ? undefined : schemeFilter,
      page,
      pageSize,
    }),
    [search, branchFilter, schemeFilter, page, pageSize],
  );

  const { data, isLoading, isError, refetch } = useStudents(filters);
  const { mutate: deleteStudent } = useDeleteStudent();

  /**
   * The bulk-provisioning button is offered only to a member who holds
   * the right to run it.
   *
   * The permission comes from the session, so the button and the server's
   * answer come from the same source — a button that is hidden and an
   * operation that is refused can never disagree.
   */
  const { data: user } = useCurrentUser();
  const canBulkProvision = (user?.permissions ?? []).includes('students:bulk_provision');

  const branches = branchesData ?? [];
  const schemes = schemesData ?? [];
  const rows = data?.items ?? [];
  const meta = data?.meta;

  // A filter is "active" whenever it narrows the list in any way. This drives
  // both the "Clear filters" control and which of the two empty states shows.
  const hasActiveFilters =
    search.trim().length > 0 ||
    branchFilter !== 'all' ||
    schemeFilter !== 'all';

  const clearFilters = () => {
    setSearch('');
    setBranchFilter('all');
    setSchemeFilter('all');
  };

  const columns: DataTableColumn<Student>[] = [
    {
      key: 'rollNo',
      header: 'Roll No',
      render: (row) => <span className="num text-ink">{row.rollNo}</span>,
    },
    {
      key: 'name',
      header: 'Name',
      /**
       * The name links to the student's profile.
       *
       * The profile is the screen a clerk actually wants when they look at
       * a student — it is where the whole journey is. The edit form is
       * reached from the profile, not from the roster, because most people
       * who open a student record want to *read* it rather than change it.
       */
      render: (row) => (
        <Link
          href={`/students/${row.id}`}
          className="text-ink underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          {row.name}
        </Link>
      ),
    },
    {
      key: 'branch',
      header: 'Branch',
      render: (row) => (
        <span className="text-body-sm text-body">
          {branchName(branches, row.branchId)}
        </span>
      ),
    },
    {
      key: 'scheme',
      header: 'Scheme',
      render: (row) => schemeName(schemes, row.schemeId),
    },
    {
      key: 'year',
      header: 'Year / Sem',
      render: (row) => `Y${yearForSemester(row.semester)} · S${row.semester}`,
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <span className="text-body-sm text-body">
          {studentStatusLabel(row.status ?? 'ACTIVE')}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'text-right',
      render: (row) => (
        <div className="flex items-center justify-end gap-xs">
          <Link
            href={`/students/${row.id}`}
            aria-label={`Open the profile of ${row.name}`}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-strong hover:text-ink"
          >
            <UserRound aria-hidden className="h-4 w-4" />
          </Link>
          <Link
            href={`/students/${row.id}/edit`}
            aria-label={`Edit ${row.name}`}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-strong hover:text-ink"
          >
            <Pencil aria-hidden className="h-4 w-4" />
          </Link>
          <button
            type="button"
            aria-label={`Delete ${row.name}`}
            onClick={() => setStudentToRemove(row)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-strong hover:text-semantic-down"
          >
            <Trash2 aria-hidden className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <section className="flex flex-col gap-6 md:gap-8">
      <PageHeader
        title="Students"
        description="Browse, search, import, and edit student records."
        actions={
          <>
            {canBulkProvision ? (
              <Button variant="secondary" asChild className="w-full md:w-auto">
                <Link href="/students/bulk-provision">
                  <KeyRound aria-hidden />
                  Give a class its logins
                </Link>
              </Button>
            ) : null}
            <Button variant="secondary" asChild className="w-full md:w-auto">
              <Link href="/students/import">
                <Upload aria-hidden />
                Import CSV
              </Link>
            </Button>
            <Button asChild className="w-full md:w-auto">
              <Link href="/students/new">
                <Plus aria-hidden />
                Add student
              </Link>
            </Button>
          </>
        }
      />

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by roll no or name"
        hasActiveFilters={hasActiveFilters}
        onClearFilters={clearFilters}
      >
        <FilterSelect
          value={branchFilter}
          onValueChange={setBranchFilter}
        >
          <SelectTrigger className="w-full md:w-40" aria-label="Filter by branch">
            <SelectValue placeholder="All branches" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All branches</SelectItem>
            {branches.map((branch) => (
              <SelectItem key={branch.id} value={branch.id}>
                {branch.code} · {branch.name}
              </SelectItem>
            ))}
          </SelectContent>
        </FilterSelect>

        <FilterSelect
          value={schemeFilter}
          onValueChange={setSchemeFilter}
        >
          <SelectTrigger className="w-full md:w-40" aria-label="Filter by scheme">
            <SelectValue placeholder="All schemes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All schemes</SelectItem>
            {schemes.map((scheme) => (
              <SelectItem key={scheme.id} value={scheme.id}>
                {scheme.name}
              </SelectItem>
            ))}
          </SelectContent>
        </FilterSelect>
      </FilterBar>

      {isError ? (
        <ErrorBanner message="Could not load students." retry={() => refetch()} />
      ) : null}

      <DataTable
        columns={columns}
        rows={rows}
        keyExtractor={(row) => row.id}
        loading={isLoading}
        emptyState={
            hasActiveFilters ? (
              // Filtered-empty: the records exist but are hidden by the
              // filters, so the state explains the cause and offers a reset
              // rather than repeating the page's "Add student" action.
              <EmptyState
                variant="plain"
                title="No students match your filters"
                description="Adjust the search or filters, or clear them to see every student."
                icon={<SearchX aria-hidden />}
                action={
                  <Button variant="secondary" onClick={clearFilters}>
                    <X aria-hidden />
                    Clear filters
                  </Button>
                }
              />
            ) : (
              // Never-populated: there is genuinely no data, so the primary
              // create action belongs here and its label matches the header.
              <EmptyState
                variant="plain"
                title="No students yet"
                description="Add students individually or upload a CSV/Excel file."
                icon={<Users aria-hidden />}
                action={
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button asChild>
                      <Link href="/students/new">
                        <Plus aria-hidden />
                        Add student
                      </Link>
                    </Button>
                    <Button variant="secondary" asChild>
                      <Link href="/students/import">
                        <Upload aria-hidden />
                        Import CSV
                      </Link>
                    </Button>
                  </div>
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

      {/*
       * The removal confirmation.
       *
       * The student is **archived**, not erased: their record and the marks
       * they were entered for are kept, so a result that was attributed to
       * them stays attributed to them. The confirmation says so, because
       * "delete" would suggest otherwise.
       */}
      <Sheet
        open={studentToRemove !== null}
        onOpenChange={(next) => {
          if (!next) setStudentToRemove(null);
        }}
      >
        <SheetContent side="dialog">
          <SheetHeader>
            <SheetTitle>Remove this student from the roster?</SheetTitle>
            <SheetDescription>
              The student is taken off the roster, but their record is kept — along with the
              marks entered for them, so a result that was attributed to them stays attributed to
              them. They will not appear on the roster again, and their login will stop working.
            </SheetDescription>
          </SheetHeader>

          {studentToRemove ? (
            <div className="flex flex-col gap-sm py-base">
              <p className="text-body-sm text-ink">
                <strong>{studentToRemove.name}</strong>
              </p>
              <p className="text-body-sm text-muted">
                Roll number {studentToRemove.rollNo} ·{' '}
                {branchName(branchesData ?? [], studentToRemove.branchId)} · Semester{' '}
                {studentToRemove.semester}
              </p>
            </div>
          ) : null}

          <SheetFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setStudentToRemove(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                if (!studentToRemove) return;
                deleteStudent(studentToRemove.id, {
                  onSuccess: () => setStudentToRemove(null),
                });
              }}
            >
              Remove from the roster
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </section>
  );
}

function branchName(
  branches: Array<{ id: string; code: string; name: string }>,
  id: string,
): string {
  const b = branches.find((branch) => branch.id === id);
  return b ? `${b.code} · ${b.name}` : '—';
}

function schemeName(
  schemes: Array<{ id: string; name: string; description?: string }>,
  id: string,
): string {
  const scheme = schemes.find((s) => s.id === id);
  return scheme ? scheme.name : '—';
}
