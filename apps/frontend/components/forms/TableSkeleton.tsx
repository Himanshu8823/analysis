'use client';

import { cn } from '@/lib/utils';

interface TableSkeletonProps {
  columns?: number;
  rows?: number;
  bordered?: boolean;
  className?: string;
}

const COLUMN_WIDTHS = ['w-20', 'w-32', 'w-40', 'w-28', 'w-24', 'w-16', 'w-20'];

export function TableSkeleton({
  columns = 5,
  rows = 6,
  bordered = true,
  className,
}: TableSkeletonProps) {
  const columnIndexes = Array.from({ length: columns }, (_, index) => index);

  return (
    <div className={className} aria-busy aria-label="Loading table">
      <div
        className={cn(
          'hidden overflow-hidden md:block',
          bordered && 'rounded-md border border-hairline bg-card',
        )}
      >
        <div className="flex items-center gap-6 border-b border-hairline bg-surface-soft px-4 py-3">
          {columnIndexes.map((index) => (
            <span
              key={index}
              className={cn(
                'h-2.5 animate-pulse rounded-full bg-hairline',
                COLUMN_WIDTHS[index % COLUMN_WIDTHS.length],
              )}
            />
          ))}
        </div>

        {Array.from({ length: rows }, (_, rowIndex) => (
          <div
            key={rowIndex}
            className="flex items-center gap-6 border-t border-hairline px-4 py-4 first:border-t-0"
          >
            {columnIndexes.map((index) => (
              <span
                key={index}
                className={cn(
                  'h-3 animate-pulse rounded-full bg-surface-strong',
                  COLUMN_WIDTHS[(index + rowIndex) % COLUMN_WIDTHS.length],
                )}
              />
            ))}
          </div>
        ))}
      </div>

      <div className="space-y-3 md:hidden">
        {Array.from({ length: Math.min(rows, 4) }, (_, rowIndex) => (
          <div
            key={rowIndex}
            className={cn(
              'space-y-3 p-4',
              bordered && 'rounded-md border border-hairline bg-card',
            )}
          >
            <div className="flex items-center justify-between gap-4">
              <span className="h-3 w-28 animate-pulse rounded-full bg-surface-strong" />
              <span className="h-3 w-16 animate-pulse rounded-full bg-surface-strong" />
            </div>
            <span className="block h-3 w-full animate-pulse rounded-full bg-surface-soft" />
            <span className="block h-3 w-2/3 animate-pulse rounded-full bg-surface-soft" />
          </div>
        ))}
      </div>
    </div>
  );
}
