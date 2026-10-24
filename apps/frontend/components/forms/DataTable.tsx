'use client';

import { type ReactNode } from 'react';

export interface DataTableColumn<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  /** Optional Tailwind class to set width/alignment on the column. */
  className?: string;
  /** When true, the column is hidden on mobile (cards still show it via `cardRender`). */
  hideOnMobile?: boolean;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  keyExtractor: (row: T) => string;
  /** Optional renderer for the per-row mobile card. Falls back to first 3 columns. */
  cardRender?: (row: T) => ReactNode;
  emptyState?: ReactNode;
  loading?: boolean;
}

export function DataTable<T>({
  columns,
  rows,
  keyExtractor,
  cardRender,
  emptyState,
  loading,
}: DataTableProps<T>) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-lg bg-surface-soft" aria-hidden />
        ))}
      </div>
    );
  }

  if (rows.length === 0 && emptyState) {
    return <>{emptyState}</>;
  }

  return (
    <>
      {/* Desktop / Tablet table */}
      <div className="hidden overflow-hidden rounded-lg border border-hairline md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-body-sm">
            <thead className="bg-surface-soft">
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    scope="col"
                    className={`px-base py-sm text-left font-semibold text-muted ${col.className ?? ''}`}
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={keyExtractor(row)}
                  className="border-t border-hairline first:border-t-0 transition-colors hover:bg-surface-soft"
                >
                  {columns.map((col) => (
                    <td key={col.key} className={`px-base py-sm text-ink ${col.className ?? ''}`}>
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile card view */}
      <div className="space-y-3 md:hidden">
        {rows.map((row) => (
          <div
            key={keyExtractor(row)}
            className="rounded-lg border border-hairline bg-canvas p-base"
          >
            {cardRender
              ? cardRender(row)
              : columns.slice(0, 3).map((col) => (
                  <div key={col.key} className="flex items-start justify-between gap-sm py-1">
                    <span className="text-caption text-muted">{col.header}</span>
                    <span className="text-body-sm text-ink">{col.render(row)}</span>
                  </div>
                ))}
            {cardRender ? null : columns.length > 3 ? (
              <div className="mt-sm flex flex-wrap gap-x-base gap-y-xs border-t border-hairline pt-sm">
                {columns.slice(3).map((col) => (
                  <div key={col.key} className="min-w-[120px]">
                    <span className="block text-caption text-muted">{col.header}</span>
                    <span className="text-body-sm text-ink">{col.render(row)}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </>
  );
}