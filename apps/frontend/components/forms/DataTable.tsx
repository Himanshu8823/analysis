'use client';

import { type ReactNode } from 'react';

import { TableSkeleton } from './TableSkeleton';

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
  /** Rendered under the table body, e.g. a pagination row. */
  footer?: ReactNode;
}

/**
 * DataTable — the table body used by every list page.
 *
 * Design rationale:
 * - The table lives inside a bordered card, matching the toolbar card
 *   directly above it, so the controls and the results read as one unit.
 * - The header row uses a tinted surface (`{colors.surface-soft}`) with
 *   uppercase caption labels — a table header is a column-label strip, not
 *   a data row, and the tint separates it without adding a heavy rule.
 * - Rows are separated by hairlines rather than zebra striping; striping
 *   fights with the hover state and adds visual noise on a white canvas.
 * - Row height stays generous (16px vertical padding) for comfortable
 *   scanning and touch targets.
 */
export function DataTable<T>({
  columns,
  rows,
  keyExtractor,
  cardRender,
  emptyState,
  loading,
  footer,
}: DataTableProps<T>) {
  if (loading) {
    return <TableSkeleton columns={columns.length} />;
  }

  if (rows.length === 0 && emptyState) {
    // The empty state keeps the table's frame so the toolbar above still
    // reads as connected to a results area.
    return (
      <div className="overflow-hidden rounded-md border border-hairline bg-card">
        {emptyState}
      </div>
    );
  }

  return (
    <>
      {/* Desktop / Tablet table */}
      <div className="hidden overflow-hidden rounded-md border border-hairline bg-card md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-body-sm">
            <thead className="bg-surface-soft">
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    scope="col"
                    className={`px-4 py-3 text-left text-caption-strong uppercase tracking-wide text-muted ${col.className ?? ''}`}
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
                  className="border-t border-hairline transition-colors hover:bg-surface-soft"
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`px-4 py-4 text-ink ${col.className ?? ''}`}
                    >
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {footer ? (
          <div className="border-t border-hairline px-4 py-3">{footer}</div>
        ) : null}
      </div>

      {/* Mobile card view */}
      <div className="space-y-3 md:hidden">
        {rows.map((row) => (
          <div
            key={keyExtractor(row)}
            className="rounded-md border border-hairline bg-card p-4"
          >
            {cardRender
              ? cardRender(row)
              : columns.slice(0, 3).map((col) => (
                  <div key={col.key} className="flex items-start justify-between gap-3 py-1">
                    <span className="text-caption text-muted">{col.header}</span>
                    <span className="text-body-sm text-ink">{col.render(row)}</span>
                  </div>
                ))}
            {cardRender ? null : columns.length > 3 ? (
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 border-t border-hairline pt-3">
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

      {footer ? <div className="mt-3 md:hidden">{footer}</div> : null}
    </>
  );
}
