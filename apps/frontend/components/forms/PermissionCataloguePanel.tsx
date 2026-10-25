'use client';

import { useMemo, useState } from 'react';
import { Plus, Trash2, X, KeyRound } from 'lucide-react';

import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorBanner } from '@/components/feedback/ErrorBanner';
import { Spinner } from '@/components/feedback/Spinner';
import {
  useCreatePermission,
  useDeletePermission,
  usePermissionCatalogue,
} from '@/hooks/useRolePermissions';
import type { Permission } from '@/lib/services/roles.service';

interface PermissionCataloguePanelProps {
  onBack: () => void;
}

/**
 * PermissionCataloguePanel — the list of every action a role can be granted.
 *
 * A permission is a `resource:action` pair — `students:read`, `marks:write`.
 * The backend enforces uniqueness on both the full name and the
 * `(resource, action)` pair, so a duplicate is rejected there; the form
 * checks the name up front to give a precise message instead of a generic
 * server error.
 */
export function PermissionCataloguePanel({ onBack }: PermissionCataloguePanelProps) {
  const catalogueQuery = usePermissionCatalogue();
  const { mutate: createPermission, isPending: creating } = useCreatePermission();
  const { mutate: deletePermission } = useDeletePermission();

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [resource, setResource] = useState('');
  const [action, setAction] = useState('');
  const [description, setDescription] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const permissions = catalogueQuery.data ?? [];

  const existingNames = useMemo(() => new Set(permissions.map((p) => p.name)), [permissions]);

  const byResource = useMemo(() => {
    const groups = new Map<string, Permission[]>();
    for (const permission of permissions) {
      const list = groups.get(permission.resource) ?? [];
      list.push(permission);
      groups.set(permission.resource, list);
    }
    return [...groups.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([resource, items]) => ({
        resource,
        permissions: [...items].sort((a, b) => a.action.localeCompare(b.action)),
      }));
  }, [permissions]);

  const resetForm = () => {
    setName('');
    setResource('');
    setAction('');
    setDescription('');
    setFormError(null);
    setShowForm(false);
  };

  const submit = () => {
    const trimmedName = name.trim();
    const trimmedResource = resource.trim();
    const trimmedAction = action.trim();

    if (!trimmedResource || !trimmedAction) {
      setFormError('A resource and an action are both required.');
      return;
    }
    if (!trimmedName) {
      setFormError('A permission name is required.');
      return;
    }
    if (existingNames.has(trimmedName)) {
      setFormError(`The permission "${trimmedName}" already exists.`);
      return;
    }

    setFormError(null);
    createPermission(
      {
        name: trimmedName,
        resource: trimmedResource,
        action: trimmedAction,
        ...(description.trim() ? { description: description.trim() } : {}),
      },
      { onSuccess: resetForm },
    );
  };

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
          <h2 className="font-display text-title-md text-ink">Permission catalogue</h2>
          <p className="mt-1 text-body-sm text-body">
            Every action a role can be granted. Permissions are grouped by the resource they act
            on.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowForm((open) => !open)}
          className="cb-btn-primary inline-flex w-full items-center justify-center md:w-auto"
        >
          <Plus className="mr-1 h-4 w-4" aria-hidden /> New permission
        </button>
      </div>

      {showForm ? (
        <div className="rounded-xl border border-hairline bg-card p-4 md:p-6">
          <h3 className="font-display text-title-md text-ink">New permission</h3>

          <div className="mt-4 grid grid-cols-1 gap-base md:grid-cols-2">
            <label className="flex flex-col gap-xs">
              <span className="text-body-sm font-semibold text-ink">Resource</span>
              <input
                required
                maxLength={50}
                value={resource}
                onChange={(e) => setResource(e.target.value)}
                className="cb-input"
                placeholder="students"
              />
            </label>

            <label className="flex flex-col gap-xs">
              <span className="text-body-sm font-semibold text-ink">Action</span>
              <input
                required
                maxLength={50}
                value={action}
                onChange={(e) => setAction(e.target.value)}
                className="cb-input"
                placeholder="read"
              />
            </label>

            <label className="flex flex-col gap-xs">
              <span className="text-body-sm font-semibold text-ink">Permission name</span>
              <input
                required
                maxLength={100}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="cb-input"
                placeholder="students:read"
                aria-invalid={formError ? true : undefined}
                aria-describedby={formError ? 'permission-form-error' : undefined}
              />
            </label>

            <label className="flex flex-col gap-xs">
              <span className="text-body-sm font-semibold text-ink">Description</span>
              <input
                maxLength={255}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="cb-input"
                placeholder="What this action allows"
              />
            </label>
          </div>

          {formError ? (
            <p id="permission-form-error" className="mt-3 text-caption text-semantic-down">
              {formError}
            </p>
          ) : null}

          <div className="mt-6 flex flex-col-reverse gap-2 border-t border-hairline pt-4 md:flex-row md:items-center md:justify-end">
            <button type="button" onClick={resetForm} className="cb-btn-secondary w-full md:w-auto">
              Cancel
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={creating}
              className="cb-btn-primary w-full md:w-auto"
            >
              {creating ? 'Creating…' : 'Create permission'}
            </button>
          </div>
        </div>
      ) : null}

      {catalogueQuery.isError ? (
        <ErrorBanner
          message="Could not load the permission catalogue."
          retry={() => catalogueQuery.refetch()}
        />
      ) : null}

      {catalogueQuery.isLoading ? (
        <div className="flex items-center gap-sm text-body-sm text-body">
          <Spinner size={16} /> Loading permissions…
        </div>
      ) : byResource.length === 0 ? (
        <EmptyState
          variant="plain"
          title="No permissions defined"
          description="Create a permission to describe an action a role can perform."
          icon={<KeyRound aria-hidden />}
        />
      ) : (
        <div className="grid grid-cols-1 gap-base md:grid-cols-2 lg:grid-cols-3">
          {byResource.map((group) => (
            <section
              key={group.resource}
              className="flex flex-col gap-xs rounded-xl border border-hairline bg-card p-base"
              aria-labelledby={`catalogue-${group.resource}`}
            >
              <header className="flex items-center justify-between gap-sm border-b border-hairline pb-xs">
                <h3
                  id={`catalogue-${group.resource}`}
                  className="font-display text-title-md text-ink"
                >
                  {group.resource}
                </h3>
                <span className="cb-badge">{group.permissions.length}</span>
              </header>

              <ul className="flex flex-col">
                {group.permissions.map((permission) => (
                  <li
                    key={permission.id}
                    className="flex min-h-11 items-center justify-between gap-sm rounded-md px-xs py-xs hover:bg-surface-soft"
                  >
                    <span className="flex min-w-0 flex-col">
                      <span className="font-semibold text-ink">{permission.name}</span>
                      {permission.description ? (
                        <span className="text-caption text-muted">{permission.description}</span>
                      ) : null}
                    </span>
                    <button
                      type="button"
                      aria-label={`Delete ${permission.name}`}
                      title="Delete permission"
                      onClick={() => {
                        if (
                          confirm(
                            `Delete ${permission.name}? It is removed from every role that holds it.`,
                          )
                        ) {
                          deletePermission(permission.id);
                        }
                      }}
                      className="inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-strong hover:text-semantic-down"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
