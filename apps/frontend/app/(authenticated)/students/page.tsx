'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus, Upload, Trash2, Pencil, Users, SearchX, X } from 'lucide-react';
import { DataTable, type DataTableColumn } from '@/components/forms/DataTable';
import { FilterBar } from '@/components/forms/FilterBar';
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
import { Spinner } from '@/components/feedback/Spinner';
import { useStudents, useDeleteStudent } from '@/hooks/useStudents';
import { useBranches } from '@/hooks/useBranches';
import { useSchemes } from '@/hooks/useSchemes';
import type { Student } from '@/lib/services/students.service';

export default function StudentsPage() {
  const [search, setSearch] = useState('');
  // Radix Select cannot use an empty string as an item value, so the
  // "no filter" state is the sentinel below and is translated to
  // `undefined` before the request goes out.
  const [branchFilter, setBranchFilter] = useState('all');
  const [schemeFilter, setSchemeFilter] = useState('all');

  const { data: branchesData } = useBranches();
  const { data: schemesData } = useSchemes();

  const filters = useMemo(
    () => ({
      search: search || undefined,
      branchId: branchFilter === 'all' ? undefined : branchFilter,
      schemeId: schemeFilter === 'all' ? undefined : schemeFilter,
    }),
    [search, branchFilter, schemeFilter],
  );

  const { data, isLoading, isError, refetch } = useStudents(filters);
  const { mutate: deleteStudent } = useDeleteStudent();

  const branches = branchesData ?? [];
  const schemes = schemesData ?? [];
  const rows = data?.items ?? [];

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
      render: (row) => <span className="text-ink">{row.name}</span>,
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
      render: (row) => `Y${row.currentYear} · S${row.semester}`,
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'text-right',
      render: (row) => (
        <div className="flex items-center justify-end gap-xs">
          <Link
            href={`/students/${row.id}/edit`}
            aria-label={`Edit ${row.name}`}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-strong hover:text-ink"
          >
            <Pencil className="h-4 w-4" aria-hidden />
          </Link>
          <button
            type="button"
            aria-label={`Delete ${row.name}`}
            onClick={() => {
              if (confirm(`Delete ${row.name}?`)) deleteStudent(row.id);
            }}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-strong hover:text-semantic-down"
          >
            <Trash2 className="h-4 w-4" aria-hidden />
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

      {isLoading ? (
        <div className="flex items-center gap-sm text-body-sm text-body">
          <Spinner size={16} /> Loading students…
        </div>
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          keyExtractor={(row) => row.id}
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
        />
      )}
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
