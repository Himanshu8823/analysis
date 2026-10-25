'use client';

import Link from 'next/link';
import { Pencil, FileCog, Plus } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorBanner } from '@/components/feedback/ErrorBanner';
import { Spinner } from '@/components/feedback/Spinner';
import { useSchemes } from '@/hooks/useSchemes';
import { formatters } from '@/lib/utils/formatters';

export default function AdminSchemesPage() {
  const { data, isLoading, isError, refetch } = useSchemes();

  const schemes = data ?? [];

  return (
    <section className="flex flex-col gap-6 md:gap-8">
      <PageHeader
        title="Scheme Rules"
        description="Configure evaluation schemes (2019 / 2022 / 2024) and calculator strategies."
        actions={
          <Link
            href="/admin/schemes/new"
            className="cb-btn-primary inline-flex w-full items-center justify-center md:w-auto"
          >
            <Plus className="mr-1 h-4 w-4" aria-hidden /> Create scheme
          </Link>
        }
      />

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
          description="Create a scheme to define how marks are evaluated and calculated."
          icon={<FileCog className="h-8 w-8" aria-hidden />}
          action={
            <Link href="/admin/schemes/new" className="cb-btn-primary">
              <Plus className="mr-1 h-4 w-4" aria-hidden /> Create scheme
            </Link>
          }
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
                  <p className="text-body-sm text-body">{scheme.description}</p>
                </div>
                <Link
                  href={`/admin/schemes/${scheme.id}/edit`}
                  aria-label={`Edit ${scheme.name}`}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-strong hover:text-ink"
                >
                  <Pencil className="h-4 w-4" aria-hidden />
                </Link>
              </header>

              <dl className="grid grid-cols-2 gap-sm border-t border-hairline pt-sm">
                <div>
                  <dt className="text-caption text-muted">Effective from</dt>
                  <dd className="num text-body-sm text-ink">
                    {formatters.date(new Date(scheme.effectiveFrom), 'short')}
                  </dd>
                </div>
                <div>
                  <dt className="text-caption text-muted">Status</dt>
                  <dd className="text-body-sm text-ink">
                    {scheme.isActive ? 'Active' : 'Inactive'}
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

    </section>
  );
}