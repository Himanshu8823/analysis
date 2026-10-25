'use client';

import { useState } from 'react';

import { Select } from '@/components/forms/Select';
import type { Branch, CreateBranchPayload } from '@/lib/services/branches.service';

interface BranchFormFieldsProps {
  /** DOM id of the `<form>` so an external save button can target it. */
  id: string;
  /** When provided the form renders pre-populated (edit flow). */
  initial?: Branch;
  onSubmit: (payload: CreateBranchPayload) => void;
}

/**
 * BranchFormFields — the shared field set for a branch.
 *
 * The field count is small enough to fit one column on mobile and two on
 * tablet and up. The code mirrors the backend's `CreateBranchDto`: a short
 * code (1–10 characters) and a name (1–100 characters). The length limits are
 * enforced here as well as on the server so the user finds out before the
 * request is sent rather than after it is rejected.
 */
export function BranchFormFields({ id, initial, onSubmit }: BranchFormFieldsProps) {
  const [form, setForm] = useState({
    code: initial?.code ?? '',
    name: initial?.name ?? '',
    isActive: initial?.isActive ?? true,
  });

  return (
    <form
      id={id}
      className="grid grid-cols-1 gap-base md:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          code: form.code.trim(),
          name: form.name.trim(),
          isActive: form.isActive,
        });
      }}
    >
      <label className="flex flex-col gap-xs">
        <span className="text-body-sm font-semibold text-ink">Code</span>
        <input
          required
          maxLength={10}
          value={form.code}
          onChange={(e) => setForm({ ...form, code: e.target.value })}
          placeholder="CS"
          className="cb-input"
        />
        <span className="text-caption text-muted">
          Short code used on result sheets (up to 10 characters).
        </span>
      </label>

      <label className="flex flex-col gap-xs">
        <span className="text-body-sm font-semibold text-ink">Name</span>
        <input
          required
          maxLength={100}
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="Computer Science"
          className="cb-input"
        />
      </label>

      <Select
        label="Active"
        value={form.isActive ? 'yes' : 'no'}
        onChange={(e) => setForm({ ...form, isActive: e.target.value === 'yes' })}
      >
        <option value="yes">Active</option>
        <option value="no">Inactive</option>
      </Select>
    </form>
  );
}
