'use client';

import { useMemo } from 'react';
import type { Permission } from '@/lib/services/roles.service';

/** A resource group — e.g. `students` — with the permissions it carries. */
interface PermissionGroup {
  resource: string;
  permissions: Permission[];
}

interface PermissionMatrixProps {
  /** The full permission catalogue, grouped by resource for display. */
  groups: PermissionGroup[];
  /** The IDs of the permissions currently selected. */
  selected: ReadonlySet<string>;
  onToggle: (permissionId: string) => void;
  /** Selects or clears every permission in a resource group. */
  onToggleGroup: (permissionIds: string[]) => void;
  disabled?: boolean;
}

/**
 * The tri-state state of a group's "select all" control.
 *
 * `indeterminate` is the mixed state — some but not all permissions in the
 * group are selected. The native checkbox renders it via the DOM property
 * rather than the `mixed` attribute, which React does not support.
 */
type GroupState = 'none' | 'some' | 'all';

/**
 * PermissionMatrix — the checkbox grid for assigning permissions to a role.
 *
 * Design rationale:
 * - **Permissions are grouped by resource, not listed flat.** A flat list of
 *   thirty `resource:action` strings is unscannable; grouping by resource
 *   lets the eye read "what can this role do to students?" as one block.
 * - **One column on mobile, two on tablet, three on desktop.** Each cell is
 *   a single checkbox row, so a narrow column still fits the longest
 *   permission name without truncating it or forcing a horizontal scroll.
 * - **Every row is a 44px touch target.** The label wraps the checkbox, so
 *   the whole row is clickable rather than just the small box.
 * - **The group header carries a tri-state "select all".** Toggling a whole
 *   resource at once is the common case; the mixed state shows at a glance
 *   that a resource is only partially granted.
 */
export function PermissionMatrix({
  groups,
  selected,
  onToggle,
  onToggleGroup,
  disabled = false,
}: PermissionMatrixProps) {
  const groupStates = useMemo(() => {
    const states = new Map<string, GroupState>();
    for (const group of groups) {
      const total = group.permissions.length;
      const chosen = group.permissions.filter((p) => selected.has(p.id)).length;
      if (chosen === 0) states.set(group.resource, 'none');
      else if (chosen === total) states.set(group.resource, 'all');
      else states.set(group.resource, 'some');
    }
    return states;
  }, [groups, selected]);

  return (
    <div className="grid grid-cols-1 gap-base md:grid-cols-2 lg:grid-cols-3">
      {groups.map((group) => {
        const state = groupStates.get(group.resource) ?? 'none';
        const groupIds = group.permissions.map((p) => p.id);

        return (
          <section
            key={group.resource}
            className="flex flex-col gap-xs rounded-xl border border-hairline bg-card p-base"
            aria-labelledby={`perm-group-${group.resource}`}
          >
            <header className="flex items-center justify-between gap-sm border-b border-hairline pb-xs">
              <h3
                id={`perm-group-${group.resource}`}
                className="font-display text-title-md text-ink"
              >
                {group.resource}
              </h3>
              <span className="cb-badge">
                {group.permissions.filter((p) => selected.has(p.id)).length}/
                {group.permissions.length}
              </span>
            </header>

            <label
              className={`flex min-h-11 items-center gap-sm rounded-md px-xs text-body-sm font-semibold text-ink ${
                disabled ? 'opacity-50' : 'cursor-pointer hover:bg-surface-soft'
              }`}
            >
              <input
                type="checkbox"
                className="h-4 w-4 flex-shrink-0 accent-[color:var(--color-primary)]"
                checked={state === 'all'}
                disabled={disabled}
                onChange={() => onToggleGroup(groupIds)}
                ref={(el) => {
                  if (el) el.indeterminate = state === 'some';
                }}
              />
              <span>All {group.resource} permissions</span>
            </label>

            <ul className="flex flex-col">
              {group.permissions.map((permission) => {
                const isSelected = selected.has(permission.id);
                return (
                  <li key={permission.id}>
                    <label
                      className={`flex min-h-11 items-start gap-sm rounded-md px-xs py-xs text-body-sm ${
                        disabled
                          ? 'opacity-50'
                          : 'cursor-pointer hover:bg-surface-soft'
                      } ${isSelected ? 'bg-surface-soft' : ''}`}
                    >
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 flex-shrink-0 accent-[color:var(--color-primary)]"
                        checked={isSelected}
                        disabled={disabled}
                        onChange={() => onToggle(permission.id)}
                      />
                      <span className="flex min-w-0 flex-col">
                        <span className="font-semibold text-ink">{permission.action}</span>
                        <span className="text-caption text-muted">{permission.name}</span>
                        {permission.description ? (
                          <span className="text-caption text-muted">{permission.description}</span>
                        ) : null}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
