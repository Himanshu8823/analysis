'use client';

import { useEffect, useMemo, useState } from 'react';
import { ScrollText, SearchX, X } from 'lucide-react';

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
import { useAuditLogs, useAuditLogFacets } from '@/hooks/useAuditLogs';
import { formatters } from '@/lib/utils/formatters';
import { cn } from '@/lib/utils';
import type { AuditLog } from '@/lib/services/audit-logs.service';

/**
 * The audit trail.
 *
 * The trail answers "who changed what, when and from where" — it is the
 * Super Admin's and the Principal's window onto the college's activity
 * (§3.2, §3.5). It is read-only by nature: the log is written by the
 * routes that make the changes, and nothing here can alter it.
 *
 * The action and resource columns are the stable taxonomy the backend
 * records (`AuditAction` / `AuditResource`), so the filter dropdowns are
 * built from the trail's own facets rather than from a hard-coded list that
 * would drift as new modules are audited.
 */
export default function AuditLogPage() {
  const [search, setSearch] = useState('');
  // Radix Select cannot use an empty string as an item value, so the "no
  // filter" state is a sentinel and is translated before the request.
  const [actionFilter, setActionFilter] = useState('all');
  const [resourceFilter, setResourceFilter] = useState('all');
  const [userFilter, setUserFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  useEffect(() => {
    setPage(1);
  }, [search, actionFilter, resourceFilter, userFilter]);

  const filters = useMemo(
    () => ({
      search: search || undefined,
      action: actionFilter === 'all' ? undefined : actionFilter,
      resource: resourceFilter === 'all' ? undefined : resourceFilter,
      userId: userFilter === 'all' ? undefined : userFilter,
      page,
      pageSize,
    }),
    [search, actionFilter, resourceFilter, userFilter, page, pageSize],
  );

  const { data, isLoading, isError, refetch } = useAuditLogs(filters);
  const { data: facets } = useAuditLogFacets();

  const rows = data?.items ?? [];
  const meta = data?.meta;

  const hasActiveFilters =
    search.trim().length > 0 ||
    actionFilter !== 'all' ||
    resourceFilter !== 'all' ||
    userFilter !== 'all';

  const clearFilters = () => {
    setSearch('');
    setActionFilter('all');
    setResourceFilter('all');
    setUserFilter('all');
  };

  const columns: DataTableColumn<AuditLog>[] = [
    {
      key: 'createdAt',
      header: 'When',
      render: (row) => (
        <span className="num whitespace-nowrap text-body-sm text-body">
          {formatters.date(row.createdAt, 'long')}
        </span>
      ),
    },
    {
      key: 'user',
      header: 'Who',
      render: (row) => (
        <span className="text-body-sm text-ink">
          {row.user?.name ?? row.user?.email ?? 'System'}
        </span>
      ),
    },
    {
      key: 'action',
      header: 'Action',
      render: (row) => <ActionBadge action={row.action} />,
    },
    {
      key: 'resource',
      header: 'What',
      render: (row) => (
        <span className="text-body-sm text-body">
          {humanize(row.resource)}
          {row.resourceId ? (
            <span className="num ml-2 text-caption text-muted">{shortId(row.resourceId)}</span>
          ) : null}
        </span>
      ),
    },
    {
      key: 'ip',
      header: 'From',
      className: 'text-right',
      render: (row) => (
        <span className="num whitespace-nowrap text-body-sm text-muted">
          {row.ipAddress ?? '—'}
        </span>
      ),
    },
  ];

  return (
    <RequirePermission permissions={['audit:read']}>
      <section className="flex flex-col gap-6 md:gap-8">
        <PageHeader
          title="Audit Log"
          description="Who changed what, when and from where. Written by the system as changes happen."
        />

        <FilterBar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search action or record id"
          hasActiveFilters={hasActiveFilters}
          onClearFilters={clearFilters}
          resultCount={
            meta && meta.total > 0
              ? `${meta.total} event${meta.total === 1 ? '' : 's'}`
              : undefined
          }
        >
          <FilterSelect value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="w-full md:w-40" aria-label="Filter by action">
              <SelectValue placeholder="All actions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actions</SelectItem>
              {(facets?.actions ?? []).map((action) => (
                <SelectItem key={action.value} value={action.value}>
                  {humanize(action.value)} ({action.count})
                </SelectItem>
              ))}
            </SelectContent>
          </FilterSelect>

          <FilterSelect value={resourceFilter} onValueChange={setResourceFilter}>
            <SelectTrigger className="w-full md:w-44" aria-label="Filter by resource">
              <SelectValue placeholder="All resources" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All resources</SelectItem>
              {(facets?.resources ?? []).map((resource) => (
                <SelectItem key={resource.value} value={resource.value}>
                  {humanize(resource.value)} ({resource.count})
                </SelectItem>
              ))}
            </SelectContent>
          </FilterSelect>

          <FilterSelect value={userFilter} onValueChange={setUserFilter}>
            <SelectTrigger className="w-full md:w-48" aria-label="Filter by member">
              <SelectValue placeholder="All members" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All members</SelectItem>
              {(facets?.users ?? []).map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.name}
                </SelectItem>
              ))}
            </SelectContent>
          </FilterSelect>
        </FilterBar>

        {isError ? (
          <ErrorBanner message="Could not load the audit log." retry={() => refetch()} />
        ) : null}

        <DataTable
          columns={columns}
          rows={rows}
          keyExtractor={(row) => row.id}
          loading={isLoading}
          cardRender={(row) => (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-3">
                <span className="text-body-sm font-semibold text-ink">
                  {row.user?.name ?? row.user?.email ?? 'System'}
                </span>
                <ActionBadge action={row.action} />
              </div>
              <p className="text-body-sm text-body">
                {humanize(row.resource)}
                {row.resourceId ? (
                  <span className="num ml-2 text-caption text-muted">{shortId(row.resourceId)}</span>
                ) : null}
              </p>
              <p className="num text-caption text-muted">
                {formatters.date(row.createdAt, 'long')}
                {row.ipAddress ? ` · ${row.ipAddress}` : ''}
              </p>
            </div>
          )}
          emptyState={
            hasActiveFilters ? (
              // Filtered-empty: the events exist but are hidden by the
              // filters, so the state explains the cause and offers a reset.
              <EmptyState
                variant="plain"
                title="No events match your filters"
                description="Adjust the search or filters, or clear them to see every event."
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
                title="No activity recorded yet"
                description="Changes to students, subjects, marks and uploads are written here as they happen."
                icon={<ScrollText aria-hidden />}
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

/**
 * The action pill.
 *
 * The tone comes from the design system's semantic tokens only: a deletion
 * is a down-tone, a creation is an up-tone, and everything else stays
 * neutral.
 */
function ActionBadge({ action }: { action: string }) {
  const normalized = action.toUpperCase();
  const tone =
    normalized === 'DELETE'
      ? 'bg-semantic-down'
      : normalized === 'CREATE' || normalized === 'BULK_IMPORT'
        ? 'bg-semantic-up'
        : 'bg-surface-strong';

  return (
    <span className="inline-flex items-center gap-2">
      <span className={cn('size-2 shrink-0 rounded-full', tone)} aria-hidden />
      <span className="text-body-sm text-body">{humanize(action)}</span>
    </span>
  );
}

/**
 * Turns a stored token into words.
 *
 * The backend stores `BULK_IMPORT` and `subject_offering`; the trail reads
 * better as "Bulk import" and "Subject offering".
 */
function humanize(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .replace(/(^|\s)\S/g, (char) => char.toUpperCase());
}

/**
 * A shortened record id.
 *
 * A full uuid is unreadable in a table and impossible to compare by eye, so
 * the first segment is shown. The whole id is still available in the row's
 * title attribute.
 */
function shortId(id: string): string {
  return id.length > 8 ? `${id.slice(0, 8)}…` : id;
}
