'use client';

import { useState } from 'react';
import {
  Plus,
  Copy,
  Send,
  Ban,
  UserCheck,
  UserX,
  ShieldCheck,
  Users,
  MailCheck,
  Pencil,
  Trash2,
} from 'lucide-react';
import { Modal } from '@/components/forms/Modal';
import { DataTable, type DataTableColumn } from '@/components/forms/DataTable';
import { FilterBar } from '@/components/forms/FilterBar';
import { Select } from '@/components/forms/Select';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorBanner } from '@/components/feedback/ErrorBanner';
import { Spinner } from '@/components/feedback/Spinner';
import {
  useInvites,
  useInviteCounts,
  useInviteUser,
  useRevokeInvite,
  useResendInvite,
} from '@/hooks/useInvites';
import {
  useMembers,
  useRoles,
  useSetMemberActive,
  useUpdateMember,
  useDeleteMember,
} from '@/hooks/useMembers';
import { useBranches } from '@/hooks/useBranches';
import { formatters } from '@/lib/utils/formatters';
import { useToast } from '@/lib/utils/notifications';
import { BRANCH_SCOPED_ROLES, INVITABLE_ROLES } from '@result-analysis/shared-types';
import type { Invite, InviteStatus, Member, UserRole } from '@result-analysis/shared-types';

type TabKey = 'members' | 'invites' | 'roles';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'members', label: 'Members' },
  { key: 'invites', label: 'Pending invitations' },
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
  const [roleFilter, setRoleFilter] = useState('');
  const [inviteStatusFilter, setInviteStatusFilter] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editing, setEditing] = useState<Member | null>(null);

  const toast = useToast();

  const memberFilters = {
    search: search || undefined,
    role: roleFilter || undefined,
  };
  const inviteFilters = {
    search: search || undefined,
    status: (inviteStatusFilter || undefined) as InviteStatus | undefined,
  };

  const membersQuery = useMembers(memberFilters);
  const invitesQuery = useInvites(inviteFilters);
  const countsQuery = useInviteCounts();
  const rolesQuery = useRoles();
  const branchesQuery = useBranches();

  const { mutate: inviteUser, isPending: inviting } = useInviteUser();
  const { mutate: revokeInvite } = useRevokeInvite();
  const { mutate: resendInvite } = useResendInvite();
  const { mutate: setMemberActive } = useSetMemberActive();
  const { mutate: updateMember, isPending: updatingMember } = useUpdateMember();
  const { mutate: deleteMember } = useDeleteMember();

  const members = membersQuery.data?.items ?? [];
  const invites = invitesQuery.data?.items ?? [];
  const roles = rolesQuery.data ?? [];
  const branches = branchesQuery.data?.data ?? [];

  const copyInviteLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Invitation link copied');
    } catch {
      toast.error('Could not copy the link. Select it and copy manually.');
    }
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
          <button
            type="button"
            aria-label={`Edit ${row.name}`}
            title="Edit member"
            onClick={() => setEditing(row)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full text-muted hover:bg-surface-strong hover:text-ink"
          >
            <Pencil className="h-4 w-4" aria-hidden />
          </button>
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
        <span className={INVITE_STATUS_STYLES[row.status]}>{row.status}</span>
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
          {row.inviteUrl ? (
            <button
              type="button"
              aria-label={`Copy invitation link for ${row.email}`}
              title="Copy invitation link"
              onClick={() => copyInviteLink(row.inviteUrl as string)}
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
    <section className="space-y-lg">
      <header className="flex flex-col gap-xs">
        <span className="cb-badge">Admin</span>
        <div className="flex flex-col items-start gap-sm md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="font-display text-title-lg text-ink md:text-display-sm">Members</h1>
            <p className="text-body-sm text-body">
              Invite colleagues, assign their roles, and manage access.
            </p>
          </div>
          <button
            type="button"
            className="cb-btn-primary w-full md:w-auto"
            onClick={() => setInviteOpen(true)}
          >
            <Plus className="mr-1 h-4 w-4" aria-hidden /> Invite member
          </button>
        </div>
      </header>

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
                <span className="rounded-full bg-canvas px-xs text-caption text-muted">{count}</span>
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
          >
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="cb-input md:w-48"
              aria-label="Filter by role"
            >
              <option value="">All roles</option>
              {roles.map((role) => (
                <option key={role.id} value={role.name}>
                  {role.name}
                </option>
              ))}
            </select>
          </FilterBar>

          {membersQuery.isError ? (
            <ErrorBanner message="Could not load members." retry={() => membersQuery.refetch()} />
          ) : null}

          {membersQuery.isLoading ? (
            <div className="flex items-center gap-sm text-body-sm text-body">
              <Spinner size={16} /> Loading members…
            </div>
          ) : (
            <DataTable
              columns={memberColumns}
              rows={members}
              keyExtractor={(row) => row.id}
              cardRender={(row) => (
                <div className="flex flex-col gap-sm">
                  <div className="flex items-start justify-between gap-sm">
                    <div className="flex flex-col">
                      <span className="font-semibold text-ink">{row.name}</span>
                      <span className="text-caption text-muted">{row.email}</span>
                    </div>
                    <span className={row.isActive ? 'text-body-sm text-ink' : 'text-body-sm text-muted'}>
                      {row.isActive ? 'Active' : 'Deactivated'}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-xs">
                    {row.roles.length === 0 ? (
                      <span className="text-caption text-muted">No roles assigned</span>
                    ) : (
                      row.roles.map((r) => (
                        <span key={`${r.roleName}-${r.branchId ?? 'global'}`} className="cb-badge">
                          {r.roleName}
                        </span>
                      ))
                    )}
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-sm border-t border-hairline pt-sm">
                    <span className="text-caption text-muted">
                      {row.lastLoginAt
                        ? `Last login ${formatters.date(row.lastLoginAt, 'short')}`
                        : 'Never signed in'}
                    </span>
                    <div className="flex flex-wrap gap-xs">
                      <button
                        type="button"
                        onClick={() => setEditing(row)}
                        className="cb-btn-secondary h-11"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setMemberActive({ id: row.id, isActive: !row.isActive })}
                        className="cb-btn-secondary h-11"
                      >
                        {row.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (
                            confirm(
                              `Remove ${row.name}? This permanently deletes the account and its role assignments.`,
                            )
                          ) {
                            deleteMember(row.id);
                          }
                        }}
                        className="cb-btn-secondary h-11"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              )}
              emptyState={
                <EmptyState
                  title="No members yet"
                  description="Invite your first colleague to give them access to the system."
                  icon={<Users className="h-8 w-8" aria-hidden />}
                  action={
                    <button type="button" className="cb-btn-primary" onClick={() => setInviteOpen(true)}>
                      Invite member
                    </button>
                  }
                />
              }
            />
          )}
        </>
      ) : null}

      {tab === 'invites' ? (
        <>
          <FilterBar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search by name or email"
          >
            <select
              value={inviteStatusFilter}
              onChange={(e) => setInviteStatusFilter(e.target.value)}
              className="cb-input md:w-48"
              aria-label="Filter by invitation status"
            >
              <option value="">All statuses</option>
              <option value="PENDING">Pending</option>
              <option value="ACCEPTED">Accepted</option>
              <option value="REVOKED">Revoked</option>
              <option value="EXPIRED">Expired</option>
            </select>
          </FilterBar>

          {invitesQuery.isError ? (
            <ErrorBanner message="Could not load invitations." retry={() => invitesQuery.refetch()} />
          ) : null}

          {invitesQuery.isLoading ? (
            <div className="flex items-center gap-sm text-body-sm text-body">
              <Spinner size={16} /> Loading invitations…
            </div>
          ) : (
            <DataTable
              columns={inviteColumns}
              rows={invites}
              keyExtractor={(row) => row.id}
              cardRender={(row) => (
                <div className="flex flex-col gap-sm">
                  <div className="flex items-start justify-between gap-sm">
                    <div className="flex flex-col">
                      <span className="font-semibold text-ink">{row.name}</span>
                      <span className="text-caption text-muted">{row.email}</span>
                    </div>
                    <span className={INVITE_STATUS_STYLES[row.status]}>{row.status}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-sm">
                    <span className="cb-badge">{row.roleName}</span>
                    <span className="text-caption text-muted">
                      Expires {formatters.date(row.expiresAt, 'short')}
                    </span>
                  </div>
                  {row.status === 'PENDING' ? (
                    <div className="flex flex-wrap gap-xs border-t border-hairline pt-sm">
                      <button
                        type="button"
                        onClick={() => resendInvite(row.id)}
                        className="cb-btn-secondary h-11"
                      >
                        Resend
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`Revoke the invitation for ${row.email}?`)) revokeInvite(row.id);
                        }}
                        className="cb-btn-secondary h-11"
                      >
                        Revoke
                      </button>
                    </div>
                  ) : null}
                </div>
              )}
              emptyState={
                <EmptyState
                  title="No invitations"
                  description="Invitations you send will appear here until they are accepted."
                  icon={<MailCheck className="h-8 w-8" aria-hidden />}
                />
              }
            />
          )}
        </>
      ) : null}

      {tab === 'roles' ? (
        <>
          {rolesQuery.isError ? (
            <ErrorBanner message="Could not load roles." retry={() => rolesQuery.refetch()} />
          ) : null}

          {rolesQuery.isLoading ? (
            <div className="flex items-center gap-sm text-body-sm text-body">
              <Spinner size={16} /> Loading roles…
            </div>
          ) : (
            <DataTable
              columns={[
                {
                  key: 'name',
                  header: 'Role',
                  render: (row) => <span className="font-semibold text-ink">{row.name}</span>,
                },
                {
                  key: 'description',
                  header: 'Description',
                  render: (row) => (
                    <span className="text-body-sm text-body">
                      {row.description ?? '—'}
                    </span>
                  ),
                },
                {
                  key: 'members',
                  header: 'Members',
                  render: (row) => (
                    <span className="text-body-sm text-ink">{row._count.userRoles}</span>
                  ),
                },
                {
                  key: 'permissions',
                  header: 'Permissions',
                  render: (row) => (
                    <span className="text-body-sm text-ink">{row._count.rolePermissions}</span>
                  ),
                },
              ]}
              rows={roles}
              keyExtractor={(row) => row.id}
              cardRender={(row) => (
                <div className="flex flex-col gap-xs">
                  <span className="font-semibold text-ink">{row.name}</span>
                  <span className="text-caption text-body">{row.description ?? '—'}</span>
                  <span className="text-caption text-muted">
                    {row._count.userRoles} members · {row._count.rolePermissions} permissions
                  </span>
                </div>
              )}
              emptyState={
                <EmptyState
                  title="No roles"
                  description="Roles define what each member is allowed to do."
                  icon={<ShieldCheck className="h-8 w-8" aria-hidden />}
                />
              }
            />
          )}
        </>
      ) : null}

      <Modal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        title="Invite a member"
        size="md"
        footer={
          <>
            <button
              type="button"
              className="cb-btn-secondary w-full md:w-auto"
              onClick={() => setInviteOpen(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="invite-member-form"
              className="cb-btn-primary w-full md:w-auto"
              disabled={inviting}
            >
              {inviting ? 'Sending…' : 'Send invitation'}
            </button>
          </>
        }
      >
        <InviteForm
          branches={branches}
          onSubmit={(payload) =>
            inviteUser(payload, {
              onSuccess: (invite) => {
                setInviteOpen(false);
                // The email may not arrive (SMTP unconfigured or filtered), so the
                // link is surfaced for the administrator to share manually.
                if (invite?.inviteUrl) {
                  copyInviteLink(invite.inviteUrl);
                }
              },
            })
          }
        />
      </Modal>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={`Edit ${editing?.name ?? ''}`}
        size="md"
        footer={
          <>
            <button
              type="button"
              className="cb-btn-secondary w-full md:w-auto"
              onClick={() => setEditing(null)}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="edit-member-form"
              className="cb-btn-primary w-full md:w-auto"
              disabled={updatingMember}
            >
              {updatingMember ? 'Saving…' : 'Save changes'}
            </button>
          </>
        }
      >
        {editing ? (
          <EditMemberForm
            member={editing}
            onSubmit={(payload) =>
              updateMember(
                { id: editing.id, payload },
                { onSuccess: () => setEditing(null) },
              )
            }
          />
        ) : null}
      </Modal>
    </section>
  );
}

/**
 * Edits a member's name and email.
 *
 * Roles are deliberately not editable here — a role change goes through the
 * RBAC endpoints so the permission cache is invalidated and the change is
 * audited. Editing a role in place would bypass both.
 */
function EditMemberForm({
  member,
  onSubmit,
}: {
  member: Member;
  onSubmit: (payload: { email: string; name: string }) => void;
}) {
  const [form, setForm] = useState({
    name: member.name,
    email: member.email,
  });

  return (
    <form
      id="edit-member-form"
      className="grid grid-cols-1 gap-base md:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(form);
      }}
    >
      <label className="flex flex-col gap-xs">
        <span className="text-body-sm font-semibold text-ink">Full name</span>
        <input
          required
          minLength={2}
          maxLength={100}
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="cb-input"
        />
      </label>

      <label className="flex flex-col gap-xs">
        <span className="text-body-sm font-semibold text-ink">Email</span>
        <input
          type="email"
          required
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          className="cb-input"
        />
      </label>

      <div className="flex flex-wrap gap-xs md:col-span-2">
        {member.roles.length === 0 ? (
          <span className="text-caption text-muted">No roles assigned</span>
        ) : (
          member.roles.map((r) => (
            <span key={`${r.roleName}-${r.branchId ?? 'global'}`} className="cb-badge">
              {r.roleName}
            </span>
          ))
        )}
      </div>

      <p className="text-caption text-muted md:col-span-2">
        Roles are managed through the RBAC settings so every change is audited and applied
        immediately.
      </p>
    </form>
  );
}

function InviteForm({
  branches,
  onSubmit,
}: {
  branches: { id: string; code: string; name: string }[];
  onSubmit: (payload: { email: string; name: string; roleName: UserRole; branchId?: string }) => void;
}) {
  const [form, setForm] = useState({
    name: '',
    email: '',
    roleName: 'TEACHER' as UserRole,
    branchId: '',
  });

  const needsBranch = BRANCH_SCOPED_ROLES.includes(form.roleName);

  return (
    <form
      id="invite-member-form"
      className="grid grid-cols-1 gap-base md:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          email: form.email,
          name: form.name,
          roleName: form.roleName,
          ...(needsBranch && form.branchId ? { branchId: form.branchId } : {}),
        });
      }}
    >
      <label className="flex flex-col gap-xs">
        <span className="text-body-sm font-semibold text-ink">Full name</span>
        <input
          required
          minLength={2}
          maxLength={100}
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="cb-input"
          placeholder="Jane Doe"
        />
      </label>

      <label className="flex flex-col gap-xs">
        <span className="text-body-sm font-semibold text-ink">Email</span>
        <input
          type="email"
          required
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          className="cb-input"
          placeholder="jane@college.edu"
        />
      </label>

      <Select
        label="Role"
        value={form.roleName}
        onChange={(e) => setForm({ ...form, roleName: e.target.value as UserRole })}
        className="md:col-span-2"
      >
        {INVITABLE_ROLES.map((role) => (
          <option key={role} value={role}>
            {role}
          </option>
        ))}
      </Select>

      {needsBranch ? (
        <Select
          label="Branch"
          value={form.branchId}
          onChange={(e) => setForm({ ...form, branchId: e.target.value })}
          className="md:col-span-2"
        >
          <option value="">Select a branch</option>
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.code} — {branch.name}
            </option>
          ))}
        </Select>
      ) : null}

      <p className="text-caption text-muted md:col-span-2">
        They will receive an email with a one-time link to choose their own password. The link
        expires in 7 days.
      </p>
    </form>
  );
}
