'use client';

import { useState } from 'react';
import { Pencil, FileCog } from 'lucide-react';
import { Modal } from '@/components/forms/Modal';
import { Select } from '@/components/forms/Select';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorBanner } from '@/components/feedback/ErrorBanner';
import { Spinner } from '@/components/feedback/Spinner';
import { useSchemes, useUpdateScheme } from '@/hooks/useSchemes';
import { formatters } from '@/lib/utils/formatters';
import type { Scheme } from '@/lib/services/schemes.service';

export default function AdminSchemesPage() {
  const [editing, setEditing] = useState<Scheme | null>(null);

  const { data, isLoading, isError, refetch } = useSchemes();
  const { mutate: updateScheme, isPending: updating } = useUpdateScheme();

  const schemes = data?.data ?? [];

  return (
    <section className="space-y-lg">
      <header className="flex flex-col gap-xs">
        <span className="cb-badge">Admin</span>
        <h1 className="font-display text-title-lg text-ink md:text-display-sm">
          Scheme Rules
        </h1>
        <p className="text-body-sm text-body">
          Configure evaluation schemes (2019 / 2022 / 2024) and calculator strategies.
        </p>
      </header>

      {isError ? (
        <ErrorBanner message="Could not load schemes." retry={() => refetch()} />
      ) : null}

      {isLoading ? (
        <div className="flex items-center gap-sm text-body-sm text-body">
          <Spinner size={16} /> Loading schemes…
        </div>
      ) : schemes.length === 0 ? (
        <EmptyState
          title="No schemes configured"
          description="Schemes are typically created from the backend seed; once added they appear here for editing."
          icon={<FileCog className="h-8 w-8" aria-hidden />}
        />
      ) : (
        <div className="grid grid-cols-1 gap-base md:grid-cols-2 lg:grid-cols-3">
          {schemes.map((scheme) => (
            <article
              key={scheme.id}
              className="cb-surface-card flex flex-col gap-sm"
              aria-labelledby={`scheme-${scheme.id}`}
            >
              <header className="flex items-start justify-between gap-sm">
                <div>
                  <p className="text-caption text-muted">Scheme</p>
                  <h3
                    id={`scheme-${scheme.id}`}
                    className="font-display text-title-md text-ink"
                  >
                    {scheme.name}
                  </h3>
                  <p className="num text-body-sm text-body">{scheme.code}</p>
                </div>
                <button
                  type="button"
                  aria-label={`Edit ${scheme.name}`}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full text-muted hover:bg-surface-strong hover:text-ink"
                  onClick={() => setEditing(scheme)}
                >
                  <Pencil className="h-4 w-4" aria-hidden />
                </button>
              </header>

              <dl className="grid grid-cols-2 gap-sm border-t border-hairline pt-sm">
                <div>
                  <dt className="text-caption text-muted">Year</dt>
                  <dd className="num text-body-sm text-ink">{scheme.year}</dd>
                </div>
                <div>
                  <dt className="text-caption text-muted">Updated</dt>
                  <dd className="text-body-sm text-ink">
                    {formatters.date(new Date(), 'short')}
                  </dd>
                </div>
              </dl>

              <details className="rounded-md border border-hairline bg-surface-soft p-sm text-caption text-body">
                <summary className="cursor-pointer text-body-sm font-semibold text-ink">
                  Rules
                </summary>
                <pre className="mt-xs overflow-x-auto whitespace-pre-wrap text-caption">
                  {JSON.stringify(scheme.rules ?? {}, null, 2)}
                </pre>
              </details>
            </article>
          ))}
        </div>
      )}

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
              form="edit-scheme-form"
              className="cb-btn-primary w-full md:w-auto"
              disabled={updating}
            >
              {updating ? 'Saving…' : 'Save changes'}
            </button>
          </>
        }
      >
        {editing ? (
          <SchemeForm
            id="edit-scheme-form"
            initial={editing}
            onSubmit={(payload) =>
              updateScheme(
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

function SchemeForm({
  id,
  initial,
  onSubmit,
}: {
  id: string;
  initial: Scheme;
  onSubmit: (payload: Partial<{ code: string; name: string; year: number; rules: Record<string, unknown> }>) => void;
}) {
  const [form, setForm] = useState({
    code: initial.code,
    name: initial.name,
    year: initial.year,
    rulesJson: JSON.stringify(initial.rules ?? {}, null, 2),
  });
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      id={id}
      className="grid grid-cols-1 gap-base md:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        try {
          const rules = JSON.parse(form.rulesJson || '{}') as Record<string, unknown>;
          onSubmit({ code: form.code, name: form.name, year: form.year, rules });
        } catch {
          setError('Rules must be valid JSON');
        }
      }}
    >
      <label className="flex flex-col gap-xs">
        <span className="text-body-sm font-semibold text-ink">Code</span>
        <input
          required
          value={form.code}
          onChange={(e) => setForm({ ...form, code: e.target.value })}
          className="cb-input"
        />
      </label>
      <label className="flex flex-col gap-xs">
        <span className="text-body-sm font-semibold text-ink">Name</span>
        <input
          required
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="cb-input"
        />
      </label>
      <Select
        label="Year"
        value={String(form.year)}
        onChange={(e) => setForm({ ...form, year: Number(e.target.value) })}
      >
        {[2019, 2020, 2021, 2022, 2023, 2024, 2025].map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
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
      {error ? (
        <p className="md:col-span-2 text-body-sm text-semantic-down">{error}</p>
      ) : null}
    </form>
  );
}