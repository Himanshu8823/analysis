'use client';

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
  className?: string;
}

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 100],
  className,
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  const canGoBack = page > 1;
  const canGoForward = page < totalPages;

  return (
    <div
      className={cn(
        'flex flex-nowrap items-center justify-end gap-2 overflow-x-auto text-caption text-muted sm:gap-4',
        className,
      )}
    >
      {onPageSizeChange ? (
        <div className="flex shrink-0 items-center gap-2 whitespace-nowrap">
          <span>Rows per page</span>
          <Select
            value={String(pageSize)}
            onValueChange={(value) => onPageSizeChange(Number(value))}
          >
            <SelectTrigger
              size="sm"
              aria-label="Rows per page"
              className="h-8 w-[68px] px-2"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {pageSizeOptions.map((option) => (
                <SelectItem key={option} value={String(option)}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      <span className="shrink-0 whitespace-nowrap tabular-nums">
        {start}-{end} of {total}
      </span>

      <nav aria-label="Pagination" className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(1)}
          disabled={!canGoBack}
          aria-label="First page"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-body transition-colors hover:bg-surface-soft hover:text-ink disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronsLeft className="h-4 w-4" aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={!canGoBack}
          aria-label="Previous page"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-body transition-colors hover:bg-surface-soft hover:text-ink disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={!canGoForward}
          aria-label="Next page"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-body transition-colors hover:bg-surface-soft hover:text-ink disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronRight className="h-4 w-4" aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => onPageChange(totalPages)}
          disabled={!canGoForward}
          aria-label="Last page"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-body transition-colors hover:bg-surface-soft hover:text-ink disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronsRight className="h-4 w-4" aria-hidden />
        </button>
      </nav>
    </div>
  );
}
