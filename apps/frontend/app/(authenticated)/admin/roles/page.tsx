'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ShieldCheck,
  KeyRound,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  Users,
} from 'lucide-react';

import { PageHeader } from '@/components/layout/PageHeader';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorBanner } from '@/components/feedback/ErrorBanner';
import { Spinner } from '@/components/feedback/Spinner';
import { PermissionMatrix } from '@/components/forms/PermissionMatrix';
import { PermissionCataloguePanel } from '@/components/forms/PermissionCataloguePanel';
import { RoleFormFields } from '@/components/forms/RoleFormFields';
import {
  useAssignRolePermissions,
  useCreateRole,
  useDeactivateRole,
  usePermissionCatalogue,
  useRole,
  useRoleList,
  useRolePermissions,
  useUpdateRole,
} from '@/hooks/useRolePermissions';
import type { Permission } from '@/lib/services/roles.service';

/**
 * Which panel the page is showing.
 *
 * `list` is the role directory; the other three are the create form, the
 * edit form and the permission matrix. A discriminated union keeps the
 * panels mutually exclusive — the page never renders two at once.
 */
type Panel =
  | { kind: 'list' }
  | { kind: 'create' }
  | { kind: 'edit'; id: string }
  | { kind: 'permissions'; id: string }
  | { kind: 'catalogue' };

export default function AdminRolesPage() {
  const rolesQuery = useRoleList();
  const catalogueQuery = usePermissionCatalogue();
  const { mutate: deactivateRole } = useDeactivateRole();

  const [panel, setPanel] = useState<Panel>({ kind: 'list' });
  const [search, setSearch] = useState('');

  const roles = rolesQuery.data ?? [];

  const filteredRoles = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return roles;
    return roles.filter(
      (role) =>
        role.name.toLowerCase().includes(term) ||
        (role.description ?? '').toLowerCase().includes(term),
    );
  }, [roles, search]);

  return (
    <section className="flex flex-col gap-6 md:gap-8">
      <PageHeader
        title="Roles & Permissions"
        description="Create roles, decide what each one can do, and keep the permission catalogue tidy."
        actions={
          panel.kind === 'list' ? (
            <>
              <button
                type="button"
                onClick={() => setPanel({ kind: 'catalogue' })}
                className="cb-btn-secondary inline-flex w-full items-center justify-center md:w-auto"
              >
                <KeyRound className="mr-1 h-4 w-4" aria-hidden /> Permission catalogue
              </button>
              <button
                type="button"
                onClick={() => setPanel({ kind: 'create' })}
                className="cb-btn-primary inline-flex w-full items-center justify-center md:w-auto"
              >
                <Plus className="mr-1 h-4 w-4" aria-hidden /> Create role
              </button>
            </>
          ) : null
        }
      />

      {rolesQuery.isError ? (
        <ErrorBanner message="Could not load roles." retry={() => rolesQuery.refetch()} />
      ) : null}

      {panel.kind === 'list' ? (
        <>
          <div className="flex flex-col gap-2 rounded-xl border border-hairline bg-card p-3 md:flex-row md:items-center md:justify-between">
            <label className="flex flex-col gap-xs md:w-72">
              <span className="sr-only">Search roles</span>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="cb-input"
                placeholder="Search roles"
              />
            </label>
            <span className="text-caption text-muted">
              {filteredRoles.length} of {roles.length} roles
            </span>
          </div>

          {rolesQuery.isLoading ? (
            <div className="flex items-center gap-sm text-body-sm text-body">
              <Spinner size={16} /> Loading roles…
            </div>
          ) : filteredRoles.length === 0 ? (
            <EmptyState
              variant="plain"
              title={search.trim() ? 'No roles match your search' : 'No roles configured'}
              description={
                search.trim()
                  ? 'Adjust the search to see every role.'
                  : 'Create a role to describe a group of members and what they can do.'
              }
              icon={<ShieldCheck aria-hidden />}
              action={
                search.trim() ? (
                  <button type="button" onClick={() => setSearch('')} className="cb-btn-secondary">
                    Clear search
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setPanel({ kind: 'create' })}
                    className="cb-btn-primary"
                  >
                    <Plus className="mr-1 h-4 w-4" aria-hidden /> Create role
                  </button>
                )
              }
            />
          ) : (
            <div className="grid grid-cols-1 gap-base md:grid-cols-2 lg:grid-cols-3">
              {filteredRoles.map((role) => (
                <article
                  key={role.id}
                  className="cb-surface-card flex flex-col gap-sm"
                  aria-labelledby={`role-${role.id}`}
                >
                  <header className="flex items-start justify-between gap-sm">
                    <div className="min-w-0">
                      <h3 id={`role-${role.id}`} className="font-display text-title-md text-ink">
                        {role.name}
                      </h3>
                      {role.description ? (
                        <p className="text-body-sm text-body">{role.description}</p>
                      ) : null}
                    </div>
                    <span className="cb-badge">{role.isActive ? 'Active' : 'Inactive'}</span>
                  </header>

                  <dl className="grid grid-cols-2 gap-sm border-t border-hairline pt-sm">
                    <div>
                      <dt className="text-caption text-muted">Members</dt>
                      <dd className="num text-body-sm text-ink">{role._count?.userRoles ?? 0}</dd>
                    </div>
                    <div>
                      <dt className="text-caption text-muted">Permissions</dt>
                      <dd className="num text-body-sm text-ink">
                        {role._count?.rolePermissions ?? 0}
                      </dd>
                    </div>
                  </dl>

                  <div className="flex flex-wrap items-center gap-xs border-t border-hairline pt-sm">
                    <button
                      type="button"
                      onClick={() => setPanel({ kind: 'permissions', id: role.id })}
                      className="cb-btn-secondary inline-flex flex-1 items-center justify-center"
                    >
                      <KeyRound className="mr-1 h-4 w-4" aria-hidden /> Permissions
                    </button>
                    <button
                      type="button"
                      aria-label={`Edit ${role.name}`}
                      title="Edit role"
                      onClick={() => setPanel({ kind: 'edit', id: role.id })}
                      className="inline-flex h-11 w-11 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-strong hover:text-ink"
                    >
                      <Pencil className="h-4 w-4" aria-hidden />
                    </button>
                    <button
                      type="button"
                      aria-label={`Deactivate ${role.name}`}
                      title="Deactivate role"
                      onClick={() => {
                        if (
                          confirm(
                            `Deactivate ${role.name}? Members holding this role will lose the access it grants. The role itself is kept and can be reactivated.`,
                          )
                        ) {
                          deactivateRole(role.id);
                        }
                      }}
                      className="inline-flex h-11 w-11 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-strong hover:text-semantic-down"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      ) : null}

      {panel.kind === 'create' ? (
        <RoleCreatePanel
          existingNames={roles.map((role) => role.name)}
          onCancel={() => setPanel({ kind: 'list' })}
          onCreated={() => setPanel({ kind: 'list' })}
        />
      ) : null}

      {panel.kind === 'edit' ? (
        <RoleEditPanel
          roleId={panel.id}
          onCancel={() => setPanel({ kind: 'list' })}
          onSaved={() => setPanel({ kind: 'list' })}
        />
      ) : null}

      {panel.kind === 'permissions' ? (
        <RolePermissionsPanel
          roleId={panel.id}
          catalogue={catalogueQuery.data ?? []}
          catalogueLoading={catalogueQuery.isLoading}
          catalogueError={catalogueQuery.isError}
          onBack={() => setPanel({ kind: 'list' })}
        />
      ) : null}

      {panel.kind === 'catalogue' ? (
        <PermissionCataloguePanel
          onBack={() => setPanel({ kind: 'list' })}
        />
      ) : null}
    </section>
  );
}

/** Create-role form panel. */
function RoleCreatePanel({
  existingNames,
  onCancel,
  onCreated,
}: {
  existingNames: string[];
  onCancel: () => void;
  onCreated: () => void;
}) {
  const { mutate: createRole, isPending: creating } = useCreateRole();
  const [nameError, setNameError] = useState<string | null>(null);

  return (
    <div className="rounded-xl border border-hairline bg-card p-4 md:p-6">
      <h2 className="font-display text-title-md text-ink">New role</h2>
      <p className="mt-1 text-body-sm text-body">
        A role groups members and the permissions they share. Permissions are assigned once the
        role exists.
      </p>

      <div className="mt-6">
        <RoleFormFields
          id="new-role-form"
          error={nameError}
          onSubmit={(payload) => {
            // A role name is unique. The backend surfaces the clash as an
            // unhandled unique-constraint error, so it is caught here
            // instead of letting the request fail with a generic message.
            if (existingNames.includes(payload.name)) {
              setNameError(`The role "${payload.name}" already exists.`);
              return;
            }
            setNameError(null);
            createRole(payload, { onSuccess: () => onCreated() });
          }}
        />
      </div>

      <div className="mt-6 flex flex-col-reverse gap-2 border-t border-hairline pt-4 md:flex-row md:items-center md:justify-end">
        <button type="button" onClick={onCancel} className="cb-btn-secondary w-full md:w-auto">
          Cancel
        </button>
        <button
          type="submit"
          form="new-role-form"
          disabled={creating}
          className="cb-btn-primary w-full md:w-auto"
        >
          {creating ? 'Creating…' : 'Create role'}
        </button>
      </div>
    </div>
  );
}

/** Edit-role form panel. */
function RoleEditPanel({
  roleId,
  onCancel,
  onSaved,
}: {
  roleId: string;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const roleQuery = useRole(roleId);
  const { mutate: updateRole, isPending: saving } = useUpdateRole();

  const role = roleQuery.data;

  return (
    <div className="rounded-xl border border-hairline bg-card p-4 md:p-6">
      <h2 className="font-display text-title-md text-ink">Edit role</h2>

      {roleQuery.isError ? (
        <div className="mt-4">
          <ErrorBanner message="Could not load the role." retry={() => roleQuery.refetch()} />
        </div>
      ) : null}

      {roleQuery.isLoading || !role ? (
        <div className="mt-4 flex items-center gap-sm text-body-sm text-body">
          <Spinner size={16} /> Loading role…
        </div>
      ) : (
        <>
          <div className="mt-6">
            <RoleFormFields
              id="edit-role-form"
              role={role}
              onSubmit={(payload) =>
                updateRole({ id: roleId, payload }, { onSuccess: () => onSaved() })
              }
            />
          </div>

          <div className="mt-6 flex flex-col-reverse gap-2 border-t border-hairline pt-4 md:flex-row md:items-center md:justify-end">
            <button type="button" onClick={onCancel} className="cb-btn-secondary w-full md:w-auto">
              Cancel
            </button>
            <button
              type="submit"
              form="edit-role-form"
              disabled={saving}
              className="cb-btn-primary w-full md:w-auto"
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * The permission assignment panel for a single role.
 *
 * The selected set is held locally while the panel is open so the checkboxes
 * respond instantly; the server is only written to on "Save". The local set
 * is seeded from the server, and re-seeded only when the server's answer
 * actually changes — a background refetch must not wipe unsaved edits.
 */
function RolePermissionsPanel({
  roleId,
  catalogue,
  catalogueLoading,
  catalogueError,
  onBack,
}: {
  roleId: string;
  catalogue: Permission[];
  catalogueLoading: boolean;
  catalogueError: boolean;
  onBack: () => void;
}) {
  const roleQuery = useRole(roleId);
  const assignedQuery = useRolePermissions(roleId);
  const { mutate: assignPermissions, isPending: saving } = useAssignRolePermissions();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [serverIds, setServerIds] = useState<string>('');

  // The server's answer, as a stable string identity. When it changes, the
  // local selection is re-seeded from it.
  const nextServerIds = useMemo(
    () => (assignedQuery.data ?? []).map((permission) => permission.id).join(','),
    [assignedQuery.data],
  );

  useEffect(() => {
    if (!assignedQuery.data) return;
    // A refetch that returns the same set must not discard unsaved edits.
    if (nextServerIds === serverIds) return;
    setSelected(new Set(assignedQuery.data.map((permission) => permission.id)));
    setServerIds(nextServerIds);
  }, [nextServerIds, serverIds, assignedQuery.data]);

  /**
   * Saves the selection.
   *
   * The server's own answer is adopted immediately rather than waiting for
   * the invalidated query to settle: the write already succeeded, so the
   * selection is by definition the saved state and the panel must stop
   * reporting unsaved changes. The follow-up refetch returns the same set
   * and is then a no-op for the seeding effect above.
   */
  const save = (permissionIds: string[]) => {
    assignPermissions(
      { id: roleId, permissionIds },
      {
        onSuccess: () => {
          setServerIds(permissionIds.join(','));
        },
      },
    );
  };

  const groups = useMemo(() => {
    const byResource = new Map<string, Permission[]>();
    for (const permission of catalogue) {
      const list = byResource.get(permission.resource) ?? [];
      list.push(permission);
      byResource.set(permission.resource, list);
    }
    return [...byResource.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([resource, permissions]) => ({
        resource,
        permissions: [...permissions].sort((a, b) => a.action.localeCompare(b.action)),
      }));
  }, [catalogue]);

  const role = roleQuery.data;

  const toggle = (permissionId: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(permissionId)) next.delete(permissionId);
      else next.add(permissionId);
      return next;
    });
  };

  const toggleGroup = (permissionIds: string[]) => {
    setSelected((current) => {
      const allSelected = permissionIds.every((id) => current.has(id));
      const next = new Set(current);
      for (const id of permissionIds) {
        if (allSelected) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  };

  /**
   * Whether the selection differs from the last known server state.
   *
   * The baseline is `serverIds` — the set the server last confirmed — rather
   * than the query data, so a successful save immediately clears the
   * "unsaved" state instead of waiting for the invalidated query to settle.
   */
  const dirty = useMemo(() => {
    const baseline = serverIds ? serverIds.split(',') : [];
    if (baseline.length !== selected.size) return true;
    return baseline.some((id) => !selected.has(id));
  }, [serverIds, selected]);

  const isLoading = roleQuery.isLoading || assignedQuery.isLoading || catalogueLoading;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-xl border border-hairline bg-card p-4 md:flex-row md:items-start md:justify-between md:p-6">
        <div className="min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="cb-btn-tertiary mb-2 inline-flex items-center justify-center"
          >
            <X className="mr-1 h-4 w-4" aria-hidden /> Back to roles
          </button>
          <h2 className="font-display text-title-md text-ink">
            {role ? role.name : 'Permissions'}
          </h2>
          {role?.description ? (
            <p className="mt-1 text-body-sm text-body">{role.description}</p>
          ) : null}
          <p className="mt-2 flex items-center gap-sm text-caption text-muted">
            <Users className="h-4 w-4" aria-hidden />
            {role?._count?.userRoles ?? 0} member
            {(role?._count?.userRoles ?? 0) === 1 ? '' : 's'} hold this role
          </p>
        </div>

        <div className="flex flex-col gap-2 md:items-end">
          <span className="text-caption text-muted">
            {selected.size} of {catalogue.length} permissions selected
          </span>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <button
              type="button"
              onClick={onBack}
              disabled={saving}
              className="cb-btn-secondary w-full sm:w-auto"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => save([...selected])}
              disabled={saving || !dirty}
              className="cb-btn-primary inline-flex w-full items-center justify-center sm:w-auto"
            >
              <Check className="mr-1 h-4 w-4" aria-hidden />
              {saving ? 'Saving…' : 'Save permissions'}
            </button>
          </div>
        </div>
      </div>

      {roleQuery.isError || assignedQuery.isError ? (
        <ErrorBanner
          message="Could not load the permissions for this role."
          retry={() => {
            void roleQuery.refetch();
            void assignedQuery.refetch();
          }}
        />
      ) : null}

      {catalogueError ? <ErrorBanner message="Could not load the permission catalogue." /> : null}

      {isLoading ? (
        <div className="flex items-center gap-sm text-body-sm text-body">
          <Spinner size={16} /> Loading permissions…
        </div>
      ) : groups.length === 0 ? (
        <EmptyState
          variant="plain"
          title="No permissions defined"
          description="Permissions are the actions a role can perform, such as reading students or generating reports."
          icon={<KeyRound aria-hidden />}
        />
      ) : (
        <PermissionMatrix
          groups={groups}
          selected={selected}
          onToggle={toggle}
          onToggleGroup={toggleGroup}
          disabled={saving}
        />
      )}
    </div>
  );
}
