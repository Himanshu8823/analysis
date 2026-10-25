'use client';

import { useMemo, useState } from 'react';
import { Pencil, Plus, Trash2, Building2, SearchX, X } from 'lucide-react';

import { DataTable, type DataTableColumn } from '@/components/forms/DataTable';
import { FilterBar } from '@/components/forms/FilterBar';
import { BranchFormFields } from '@/components/forms/BranchFormFields';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
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
import { Spinner } from '@/components/feedback/Spinner';
import { useBranches, useCreateBranch, useUpdateBranch, useDeleteBranch } from '@/hooks/useBranches';
import type { Branch, CreateBranchPayload } from '@/lib/services/branches.service';

/**
 * The branch being created or edited in the sheet.
 *
 * `null` means the sheet is closed. `mode` tells the form whether it is
 * creating a new branch or editing an existing one.
 */
type SheetState =
  | { mode: 'create' }
  | { mode: 'edit'; branch: Branch }
  | null;

export default function AdminBranchesPage() {
  const [search, setSearch] = useState('');
  const [sheet, setSheet] = useState<SheetState>(null);

  const { data, isLoading, isError, refetch } = useBranches();
  const { mutate: createBranch, isPending: creating } = useCreateBranch();
  const { mutate: updateBranch, isPending: updating } = useUpdateBranch();
  const { mutate: deleteBranch } = useDeleteBranch();

  const branches = data ?? [];

  // The list is small and fetched in one call, so the filter runs on the
  // client rather than narrowing a server request.
  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return branches;
    return branches.filter(
      (branch) =>
        branch.code.toLowerCase().includes(term) || branch.name.toLowerCase().includes(term),
    );
  }, [branches, search]);

  const hasActiveFilters = search.trim().length > 0;
  const clearFilters = () => setSearch('');

  const columns: DataTableColumn<Branch>[] = [
    {
      key: 'code',
      header: 'Code',
      render: (row) => <span className="num font-semibold text-ink">{row.code}</span>,
    },
    {
      key: 'name',
      header: 'Name',
      render: (row) => <span className="text-ink">{row.name}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <span className="cb-badge">{row.isActive === false ? 'Inactive' : 'Active'}</span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'text-right',
      render: (row) => (
        <div className="flex items-center justify-end gap-xs">
          <button
            type="button"
            aria-label={`Edit ${row.name}`}
            title="Edit branch"
            onClick={() => setSheet({ mode: 'edit', branch: row })}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-strong hover:text-ink"
          >
            <Pencil className="h-4 w-4" aria-hidden />
          </button>
          <button
            type="button"
            aria-label={`Delete ${row.name}`}
            title="Delete branch"
            onClick={() => {
              if (confirm(`Delete ${row.name}?`)) deleteBranch(row.id);
            }}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-strong hover:text-semantic-down"
          >
            <Trash2 className="h-4 w-4" aria-hidden />
          </button>
        </div>
      ),
    },
  ];

  /**
   * Handles the sheet's form submit.
   *
   * The sheet is closed only after the mutation succeeds, so a failed save
   * leaves the user's input on screen to correct and retry.
   */
  const handleSubmit = (payload: CreateBranchPayload) => {
    if (sheet?.mode === 'edit') {
      updateBranch(
        { id: sheet.branch.id, payload },
        { onSuccess: () => setSheet(null) },
      );
      return;
    }
    createBranch(payload, { onSuccess: () => setSheet(null) });
  };

  const saving = creating || updating;

  return (
    <section className="flex flex-col gap-6 md:gap-8">
      <PageHeader
        title="Branches"
        description="Create and manage the academic branches that results are grouped by."
        actions={
          <Button
            type="button"
            onClick={() => setSheet({ mode: 'create' })}
            className="w-full md:w-auto"
          >
            <Plus aria-hidden />
            Create branch
          </Button>
        }
      />

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by code or name"
        hasActiveFilters={hasActiveFilters}
        onClearFilters={clearFilters}
        resultCount={`${rows.length} ${rows.length === 1 ? 'branch' : 'branches'}`}
      />

      {isError ? (
        <ErrorBanner message="Could not load branches." retry={() => refetch()} />
      ) : null}

      {isLoading ? (
        <div className="flex items-center gap-sm text-body-sm text-body">
          <Spinner size={16} /> Loading branches…
        </div>
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          keyExtractor={(row) => row.id}
          emptyState={
            hasActiveFilters ? (
              // Filtered-empty: the branches exist but the search hides them,
              // so the state explains the cause and offers a reset instead of
              // repeating the page's create action.
              <EmptyState
                variant="plain"
                title="No branches match your search"
                description="Adjust the search, or clear it to see every branch."
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
                title="No branches yet"
                description="Create a branch to group students, subjects and results."
                icon={<Building2 aria-hidden />}
                action={
                  <Button type="button" onClick={() => setSheet({ mode: 'create' })}>
                    <Plus aria-hidden />
                    Create branch
                  </Button>
                }
              />
            )
          }
        />
      )}

      <Sheet
        open={sheet !== null}
        onOpenChange={(open) => {
          if (!open) setSheet(null);
        }}
      >
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>{sheet?.mode === 'edit' ? 'Edit branch' : 'Create branch'}</SheetTitle>
            <SheetDescription>
              {sheet?.mode === 'edit'
                ? 'Update the branch code, name or status, then save.'
                : 'Give the branch a short code and a full name.'}
            </SheetDescription>
          </SheetHeader>

          <BranchFormFields
            id="branch-form"
            initial={sheet?.mode === 'edit' ? sheet.branch : undefined}
            onSubmit={handleSubmit}
          />

          <SheetFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setSheet(null)}
              className="w-full md:w-auto"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="branch-form"
              disabled={saving}
              className="w-full md:w-auto"
            >
              {saving
                ? 'Saving…'
                : sheet?.mode === 'edit'
                  ? 'Save changes'
                  : 'Create branch'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </section>
  );
}
