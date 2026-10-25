'use client';

import { useState } from 'react';

interface RoleFormFieldsProps {
  id: string;
  /** Pre-populates the fields when editing an existing role. */
  role?: { name: string; description: string | null };
  /** Validation message shown under the name field. */
  error?: string | null;
  onSubmit: (payload: { name: string; description?: string }) => void;
}

/**
 * RoleFormFields — the shared field set for creating and editing a role.
 *
 * The same component serves both flows; the edit page simply passes the
 * existing role so the fields come pre-filled.
 */
export function RoleFormFields({ id, role, error, onSubmit }: RoleFormFieldsProps) {
  const [form, setForm] = useState({
    name: role?.name ?? '',
    description: role?.description ?? '',
  });

  const errorId = `${id}-name-error`;

  return (
    <form
      id={id}
      className="grid grid-cols-1 gap-base md:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          name: form.name.trim().toUpperCase(),
          ...(form.description.trim() ? { description: form.description.trim() } : {}),
        });
      }}
    >
      <label className="flex flex-col gap-xs">
        <span className="text-body-sm font-semibold text-ink">Role name</span>
        <input
          required
          minLength={2}
          maxLength={50}
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="cb-input"
          placeholder="EXAMINER"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : `${id}-name-hint`}
        />
        {error ? (
          <span id={errorId} className="text-caption text-semantic-down">
            {error}
          </span>
        ) : (
          <span id={`${id}-name-hint`} className="text-caption text-muted">
            Uppercase letters, numbers and underscores. Must be unique.
          </span>
        )}
      </label>

      <label className="flex flex-col gap-xs md:col-span-2">
        <span className="text-body-sm font-semibold text-ink">Description</span>
        <input
          maxLength={255}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          className="cb-input"
          placeholder="What this role is allowed to do"
        />
      </label>
    </form>
  );
}
