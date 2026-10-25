'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Plus,
  Copy,
  Send,
  Ban,
  UserCheck,
  UserX,
  ShieldCheck,
  KeyRound,
  Users,
  MailCheck,
  Pencil,
  Trash2,
} from 'lucide-react';
import { DataTable, type DataTableColumn } from '@/components/forms/DataTable';
import { FilterBar } from '@/components/forms/FilterBar';
import { Pagination } from '@/components/forms/Pagination';
import { PageHeader } from '@/components/layout/PageHeader';
import {
  Select as FilterSelect,
  SelectContent as FilterSelectContent,
  SelectItem as FilterSelectItem,
  SelectTrigger as FilterSelectTrigger,
  SelectValue as FilterSelectValue,
} from '@/components/ui/select';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorBanner } from '@/components/feedback/ErrorBanner';
import { Spinner } from '@/components/feedback/Spinner';
import {
  useInvites,
  useInviteCounts,
  useRevokeInvite,
  useResendInvite,
} from '@/hooks/useInvites';
import { useMembers, useRoles, useSetMemberActive, useDeleteMember } from '@/hooks/useMembers';
import { formatters } from '@/lib/utils/formatters';
import { useToast } from '@/lib/utils/notifications';
import type { Invite, InviteStatus, Member } from '@result-analysis/shared-types';

type TabKey = 'members' | 'invites' | 'roles';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'members', label: 'Members' },
  { key: 'invites', label: 'Invitations' },
  { key: 'roles', label: 'Roles' },
];

const INVITE_STATUS_STYLES: Record<InviteStatus, string> = {
  PENDING: 'cb-badge',
  ACCEPTED: 'cb-badge',
  REVOKED: 'cb-badge',
  EXPIRED: 'cb-badge',
};

export default function AdminMembersPage() {
  const [tab, setTab] = useState<TabKey>('members');
  const [search, setSearch] = useState('');
  // Radix Select cannot use an empty string as an item value, so the
  // "no filter" state is the sentinel below and is translated to
  // `undefined` before the request goes out.
  const [roleFilter, setRoleFilter] = useState('all');
  const [inviteStatusFilter, setInviteStatusFilter] = useState('all');
  const [memberPage, setMemberPage] = useState(1);
  const [invitePage, setInvitePage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    setMemberPage(1);
  }, [search, roleFilter]);

  useEffect(() => {
    setInvitePage(1);
  }, [search, inviteStatusFilter]);

  const toast = useToast();

  const memberFilters = {
    search: search || undefined,
    role: roleFilter === 'all' ? undefined : roleFilter,
    page: memberPage,
    pageSize,
  };
  const inviteFilters = {
    search: search || undefined,
    status: (inviteStatusFilter === 'all'
      ? undefined
      : inviteStatusFilter) as InviteStatus | undefined,
    page: invitePage,
    pageSize,
  };

  const membersQuery = useMembers(memberFilters);
  const invitesQuery = useInvites(inviteFilters);
  const countsQuery = useInviteCounts();
  const rolesQuery = useRoles();

  // A filter is "active" whenever it narrows the list in any way. This drives
  // the conditional "Clear filters" control in the toolbar.
  const hasActiveFilters =
    search.trim().length > 0 ||
    roleFilter !== 'all' ||
    inviteStatusFilter !== 'all';

  const clearFilters = () => {
    setSearch('');
    setRoleFilter('all');
    setInviteStatusFilter('all');
  };

  const { mutate: revokeInvite } = useRevokeInvite();
  const { mutate: resendInvite } = useResendInvite();
  const { mutate: setMemberActive } = useSetMemberActive();
  const { mutate: deleteMember } = useDeleteMember();

  const members = membersQuery.data?.items ?? [];
  const invites = invitesQuery.data?.items ?? [];
  const roles = rolesQuery.data ?? [];
  const memberMeta = membersQuery.data?.meta;
  const inviteMeta = invitesQuery.data?.meta;

  useEffect(() => {
    if (memberMeta && memberMeta.totalPages > 0 && memberPage > memberMeta.totalPages) {
      setMemberPage(memberMeta.totalPages);
    }
  }, [memberMeta, memberPage]);

  useEffect(() => {
    if (inviteMeta && inviteMeta.totalPages > 0 && invitePage > inviteMeta.totalPages) {
      setInvitePage(inviteMeta.totalPages);
    }
  }, [inviteMeta, invitePage]);

  const copyInviteLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Invitation link copied');
    } catch {
      toast.error('Could not copy the link. Select it and copy manually.');
    }
  };

  /**
   * Issues a fresh invitation link for a row and copies it.
   *
   * The raw token is never persisted, so the only way to get a working link
   * for an existing invitation is to reissue it — which also revokes the old
   * link, so exactly one link is ever live.
   */
  const reissueAndCopy = (id: string, email: string) => {
    resendInvite(id, {
      onSuccess: (invite) => {
        if (invite?.inviteUrl) {
          copyInviteLink(invite.inviteUrl);
        } else {
          toast.error(`Could not regenerate the link for ${email}.`);
        }
      },
    });
  };

  const memberColumns: DataTableColumn<Member>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-semibold text-ink">{row.name}</span>
          <span className="text-caption text-muted">{row.email}</span>
        </div>
      ),
    },
    {
      key: 'roles',
      header: 'Roles',
      render: (row) => (
        <div className="flex flex-wrap gap-xs">
          {row.roles.length === 0 ? (
            <span className="text-caption text-muted">None</span>
          ) : (
            row.roles.map((r) => (
              <span key={`${r.roleName}-${r.branchId ?? 'global'}`} className="cb-badge">
                {r.roleName}
              </span>
            ))
          )}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <div className="flex flex-col">
          <span className={row.isActive ? 'text-body-sm text-ink' : 'text-body-sm text-muted'}>
            {row.isActive ? 'Active' : 'Deactivated'}
          </span>
          {row.mustChangePassword ? (
            <span className="text-caption text-muted">Password change pending</span>
          ) : null}
        </div>
      ),
    },
    {
      key: 'lastLogin',
      header: 'Last login',
      render: (row) => (
        <span className="text-caption text-muted">
          {row.lastLoginAt ? formatters.date(row.lastLoginAt, 'short') : 'Never'}
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
            href={`/admin/members/${row.id}/edit`}
            aria-label={`Edit ${row.name}`}
            title="Edit member"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-strong hover:text-ink"
          >
            <Pencil className="h-4 w-4" aria-hidden />
          </Link>
          <button
            type="button"
            aria-label={row.isActive ? `Deactivate ${row.name}` : `Activate ${row.name}`}
            title={row.isActive ? 'Deactivate member' : 'Activate member'}
            onClick={() => setMemberActive({ id: row.id, isActive: !row.isActive })}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full text-muted hover:bg-surface-strong hover:text-ink"
          >
            {row.isActive ? (
              <UserX className="h-4 w-4" aria-hidden />
            ) : (
              <UserCheck className="h-4 w-4" aria-hidden />
            )}
          </button>
          <button
            type="button"
            aria-label={`Remove ${row.name}`}
            title="Remove member"
            onClick={() => {
              if (
                confirm(
                  `Remove ${row.name}? This permanently deletes the account and its role assignments.`,
                )
              ) {
                deleteMember(row.id);
              }
            }}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full text-muted hover:bg-surface-strong hover:text-semantic-down"
          >
            <Trash2 className="h-4 w-4" aria-hidden />
          </button>
        </div>
      ),
    },
  ];

  const inviteColumns: DataTableColumn<Invite>[] = [
    {
      key: 'email',
      header: 'Invitee',
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-semibold text-ink">{row.name}</span>
          <span className="text-caption text-muted">{row.email}</span>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      render: (row) => <span className="cb-badge">{row.roleName}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <div className="flex flex-col">
          <span className={INVITE_STATUS_STYLES[row.status]}>
            {row.supersededById ? 'SUPERSEDED' : row.status}
          </span>
          {row.supersededById ? (
            <span className="text-caption text-muted">Replaced by a newer invite</span>
          ) : null}
        </div>
      ),
    },
    {
      key: 'expires',
      header: 'Expires',
      render: (row) => (
        <span className="text-caption text-muted">{formatters.date(row.expiresAt, 'short')}</span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'text-right',
      render: (row) => (
        <div className="flex items-center justify-end gap-xs">
          {row.status === 'PENDING' ? (
            <button
              type="button"
              aria-label={`Copy invitation link for ${row.email}`}
              title="Copy invitation link"
              onClick={() => reissueAndCopy(row.id, row.email)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full text-muted hover:bg-surface-strong hover:text-ink"
            >
              <Copy className="h-4 w-4" aria-hidden />
            </button>
          ) : null}
          {row.status === 'PENDING' ? (
            <>
              <button
                type="button"
                aria-label={`Resend invitation to ${row.email}`}
                title="Resend invitation"
                onClick={() => resendInvite(row.id)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full text-muted hover:bg-surface-strong hover:text-ink"
              >
                <Send className="h-4 w-4" aria-hidden />
              </button>
              <button
                type="button"
                aria-label={`Revoke invitation for ${row.email}`}
                title="Revoke invitation"
                onClick={() => {
                  if (confirm(`Revoke the invitation for ${row.email}?`)) revokeInvite(row.id);
                }}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full text-muted hover:bg-surface-strong hover:text-semantic-down"
              >
                <Ban className="h-4 w-4" aria-hidden />
              </button>
            </>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <section className="flex flex-col gap-6 md:gap-8">
      <PageHeader
        title="Members"
        description="Invite colleagues, assign their roles, and manage access."
        actions={
          <Link
            href="/admin/members/new"
            className="cb-btn-primary inline-flex w-full items-center justify-center md:w-auto"
          >
            <Plus className="mr-1 h-4 w-4" aria-hidden /> Invite member
          </Link>
        }
      />

      {/* Tab bar — wraps on mobile */}
      <div
        role="tablist"
        aria-label="Member management sections"
        className="flex flex-wrap gap-xs border-b border-hairline pb-sm"
      >
        {TABS.map((t) => {
          const isActive = tab === t.key;
          const count =
            t.key === 'invites' && countsQuery.data ? countsQuery.data.PENDING : undefined;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setTab(t.key)}
              className={`inline-flex h-11 items-center gap-sm rounded-md px-base text-body-sm font-semibold transition-colors ${
                isActive
                  ? 'bg-surface-strong text-ink'
                  : 'text-muted hover:bg-surface-soft hover:text-ink'
              }`}
            >
              {t.label}
              {count !== undefined ? (
                <span
                  title="Invitations still awaiting a response"
                  aria-label={`${count} awaiting a response`}
                  className="rounded-full bg-canvas px-xs text-caption text-muted"
                >
                  {count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {tab === 'members' ? (
        <>
          <FilterBar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search by name or email"
            hasActiveFilters={hasActiveFilters}
            onClearFilters={clearFilters}
          >
            <FilterSelect value={roleFilter} onValueChange={setRoleFilter}>
              <FilterSelectTrigger className="w-full md:w-40" aria-label="Filter by role">
                <FilterSelectValue placeholder="All roles" />
              </FilterSelectTrigger>
              <FilterSelectContent>
                <FilterSelectItem value="all">All roles</FilterSelectItem>
                {roles.map((role) => (
                  <FilterSelectItem key={role.id} value={role.name}>
                    {role.name}
                  </FilterSelectItem>
                ))}
              </FilterSelectContent>
            </FilterSelect>
          </FilterBar>

          {membersQuery.isError ? (
            <ErrorBanner message="Could not load members." retry={() => membersQuery.refetch()} />
          ) : null}

          <DataTable
            columns={memberColumns}
            rows={members}
            keyExtractor={(row) => row.id}
            loading={membersQuery.isLoading}
            emptyState={
              <EmptyState
                variant="plain"
                title={hasActiveFilters ? 'No members match your filters' : 'No members yet'}
                description={
                  hasActiveFilters
                    ? 'Adjust the search or filters, or clear them to see every member.'
                    : 'Invite a colleague to give them access to the system.'
                }
                icon={hasActiveFilters ? <Users aria-hidden /> : <Users aria-hidden />}
                action={
                  hasActiveFilters ? (
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="cb-btn-secondary"
                    >
                      Clear filters
                    </button>
                  ) : (
                    <Link href="/admin/members/new" className="cb-btn-primary">
                      <Plus className="mr-1 h-4 w-4" aria-hidden /> Invite member
                    </Link>
                  )
                }
              />
            }
            footer={
              memberMeta && memberMeta.total > 0 ? (
                <Pagination
                  page={memberPage}
                  pageSize={pageSize}
                  total={memberMeta.total}
                  onPageChange={setMemberPage}
                  onPageSizeChange={(size) => {
                    setPageSize(size);
                    setMemberPage(1);
                    setInvitePage(1);
                  }}
                />
              ) : undefined
            }
          />
        </>
      ) : null}

      {tab === 'invites' ? (
        <>
          <FilterBar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search by name or email"
            hasActiveFilters={hasActiveFilters}
            onClearFilters={clearFilters}
          >
            <FilterSelect value={inviteStatusFilter} onValueChange={setInviteStatusFilter}>
              <FilterSelectTrigger className="w-full md:w-40" aria-label="Filter by status">
                <FilterSelectValue placeholder="All statuses" />
              </FilterSelectTrigger>
              <FilterSelectContent>
                <FilterSelectItem value="all">All statuses</FilterSelectItem>
                <FilterSelectItem value="PENDING">Pending</FilterSelectItem>
                <FilterSelectItem value="ACCEPTED">Accepted</FilterSelectItem>
                <FilterSelectItem value="REVOKED">Revoked</FilterSelectItem>
                <FilterSelectItem value="EXPIRED">Expired</FilterSelectItem>
              </FilterSelectContent>
            </FilterSelect>
          </FilterBar>

          {invitesQuery.isError ? (
            <ErrorBanner message="Could not load invitations." retry={() => invitesQuery.refetch()} />
          ) : null}

          <DataTable
            columns={inviteColumns}
            rows={invites}
            keyExtractor={(row) => row.id}
            loading={invitesQuery.isLoading}
            emptyState={
              <EmptyState
                variant="plain"
                title={
                  hasActiveFilters ? 'No invitations match your filters' : 'No invitations yet'
                }
                description={
                  hasActiveFilters
                    ? 'Adjust the search or filters, or clear them to see every invitation.'
                    : 'Invitations you send appear here until they are accepted or expire.'
                }
                icon={<MailCheck aria-hidden />}
                action={
                  hasActiveFilters ? (
                    <button type="button" onClick={clearFilters} className="cb-btn-secondary">
                      Clear filters
                    </button>
                  ) : null
                }
              />
            }
            footer={
              inviteMeta && inviteMeta.total > 0 ? (
                <Pagination
                  page={invitePage}
                  pageSize={pageSize}
                  total={inviteMeta.total}
                  onPageChange={setInvitePage}
                  onPageSizeChange={(size) => {
                    setPageSize(size);
                    setMemberPage(1);
                    setInvitePage(1);
                  }}
                />
              ) : undefined
            }
          />
        </>
      ) : null}

      {tab === 'roles' ? (
        <>
          <div className="flex flex-col gap-3 rounded-xl border border-hairline bg-card p-base md:flex-row md:items-center md:justify-between">
            <p className="text-body-sm text-body">
              This is a read-only summary. Create roles, rename them and decide what each one can
              do in the roles editor.
            </p>
            <Link
              href="/admin/roles"
              className="cb-btn-primary inline-flex w-full items-center justify-center md:w-auto"
            >
              <KeyRound className="mr-1 h-4 w-4" aria-hidden /> Manage roles and permissions
            </Link>
          </div>

          {rolesQuery.isError ? (
            <ErrorBanner message="Could not load roles." retry={() => rolesQuery.refetch()} />
          ) : null}

          {rolesQuery.isLoading ? (
            <div className="flex items-center gap-sm text-body-sm text-body">
              <Spinner size={16} /> Loading roles…
            </div>
          ) : roles.length === 0 ? (
            <EmptyState
              variant="plain"
              title="No roles configured"
              description="Roles are defined by the backend seed and permission matrix."
              icon={<ShieldCheck aria-hidden />}
            />
          ) : (
            <div className="grid grid-cols-1 gap-base md:grid-cols-2 lg:grid-cols-3">
              {roles.map((role) => (
                <article
                  key={role.id}
                  className="cb-surface-card flex flex-col gap-sm"
                  aria-labelledby={`role-${role.id}`}
                >
                  <header className="flex items-start justify-between gap-sm">
                    <div>
                      <h3
                        id={`role-${role.id}`}
                        className="font-display text-title-md text-ink"
                      >
                        {role.name}
                      </h3>
                      {role.description ? (
                        <p className="text-body-sm text-body">{role.description}</p>
                      ) : null}
                    </div>
                    <span className={role.isActive ? 'cb-badge' : 'cb-badge'}>
                      {role.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </header>

                  <dl className="grid grid-cols-2 gap-sm border-t border-hairline pt-sm">
                    <div>
                      <dt className="text-caption text-muted">Members</dt>
                      <dd className="num text-body-sm text-ink">
                        {role._count.userRoles}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-caption text-muted">Permissions</dt>
                      <dd className="num text-body-sm text-ink">
                        {role._count.rolePermissions}
                      </dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>
          )}
        </>
      ) : null}
    </section>
  );
}
