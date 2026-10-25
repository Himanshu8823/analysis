'use client';

import { useState } from 'react';

import type { Scheme, SchemePayload } from '@/lib/services/schemes.service';
import { Select } from '@/components/forms/Select';

interface SchemeFormFieldsProps {
  /** DOM id of the `<form>` so an external save button can target it. */
  id: string;
  /** When provided the form renders pre-populated (edit flow). */
  initial?: Scheme;
  onSubmit: (payload: SchemePayload) => void;
}

/**
 * SchemeFormFields — the shared field set for a scheme.
 *
 * The rules editor takes raw JSON because the shape is strategy-specific and
 * validated server-side; the client only guards against malformed JSON so the
 * user gets an immediate, specific error instead of a generic API failure.
 */
export function SchemeFormFields({ id, initial, onSubmit }: SchemeFormFieldsProps) {
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    description: initial?.description ?? '',
    effectiveFrom: initial ? initial.effectiveFrom.slice(0, 10) : '',
    isActive: initial?.isActive ?? true,
    rulesJson: JSON.stringify(initial?.rules ?? {}, null, 2),
  });
  const [error, setError] = useState<string | null>(null);

  /**
   * True when the rules field holds something that is not valid JSON.
   *
   * The error is derived from the current text rather than latched, so it
   * disappears the moment the JSON is fixed — a stale "Rules must be valid
   * JSON" under a textarea that now parses is misleading.
   */
  const rulesAreInvalid = (() => {
    if (!error) return false;
    try {
      JSON.parse(form.rulesJson || '{}');
      return false;
    } catch {
      return true;
    }
  })();

  return (
    <form
      id={id}
      className="grid grid-cols-1 gap-base md:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        try {
          const rules = JSON.parse(form.rulesJson || '{}') as Record<string, unknown>;
          onSubmit({
            name: form.name,
            description: form.description,
            effectiveFrom: form.effectiveFrom,
            isActive: form.isActive,
            rules,
          });
        } catch {
          setError('Rules must be valid JSON');
        }
      }}
    >
      <label className="flex flex-col gap-xs">
        <span className="text-body-sm font-semibold text-ink">Name</span>
        <input
          required
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="cb-input"
        />
      </label>
      <label className="flex flex-col gap-xs">
        <span className="text-body-sm font-semibold text-ink">Description</span>
        <input
          required
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          className="cb-input"
        />
      </label>
      <label className="flex flex-col gap-xs">
        <span className="text-body-sm font-semibold text-ink">Effective from</span>
        <input
          required
          type="date"
          value={form.effectiveFrom}
          onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })}
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
      <label className="flex flex-col gap-xs md:col-span-2">
        <span className="text-body-sm font-semibold text-ink">Rules (JSON)</span>
        <textarea
          rows={8}
          value={form.rulesJson}
          onChange={(e) => setForm({ ...form, rulesJson: e.target.value })}
          className="cb-input font-mono text-caption"
          spellCheck={false}
        />
      </label>
      {rulesAreInvalid ? (
        <p className="md:col-span-2 text-body-sm text-semantic-down">{error}</p>
      ) : null}
    </form>
  );
}
