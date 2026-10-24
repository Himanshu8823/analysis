'use client';

import { type ReactNode } from 'react';
import { X } from 'lucide-react';

import { SearchInput } from '@/components/ui/search-input';
import { cn } from '@/lib/utils';

interface FilterBarProps {
  search?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  /** Filter dropdowns and other controls that scope the list. */
  children?: ReactNode;
  /** Page-level actions (buttons) that belong on the far right. */
  actions?: ReactNode;
  /** Optional summary line, e.g. "24 students". */
  resultCount?: ReactNode;
  /**
   * True when at least one filter is narrowing the list. When set, the bar
   * renders a "Clear filters" control so the user can reset without
   * scrolling down to the empty state.
   */
  hasActiveFilters?: boolean;
  /** Resets search and every filter. Required when `hasActiveFilters` is set. */
  onClearFilters?: () => void;
  className?: string;
}

/**
 * FilterBar — the toolbar above a data table.
 *
 * Design rationale:
 * - **Search and filters sit on one row, grouped on the left.** They are one
 *   mental group ("narrow this list"), and splitting them across separate
 *   rows or to opposite ends of the page leaves the eye travelling and makes
 *   the filters look unanchored.
 * - **Actions sit on the far right.** They belong to the page, not to the
 *   current filter state, so they get their own region.
 * - **The whole toolbar reads as one card** with a hairline border, matching
 *   the table card directly beneath it. The shared border makes the
 *   connection between "controls" and "results" explicit instead of implied.
 * - **Filters show their current value, not a generic label.** "All branches"
 *   as a permanent placeholder reads as a disabled control; showing the
 *   active value (or a muted "All branches" when unset) is clearer.
 * - **A "Clear filters" control appears only while filters are active.** It
 *   sits in the toolbar so the reset is reachable without scrolling down to
 *   the results area, and it disappears entirely when nothing is filtered.
 */
export function FilterBar({
  search,
  onSearchChange,
  searchPlaceholder,
  children,
  actions,
  resultCount,
  hasActiveFilters,
  onClearFilters,
  className,
}: FilterBarProps) {
  const hasFilters = Array.isArray(children) ? children.length > 0 : !!children;
  const showClear = !!hasActiveFilters && !!onClearFilters;

  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded-xl bg-card md:flex-row md:items-center md:gap-3',
        className,
      )}
    >
      {/* Left region — the scoping controls, grouped. */}
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 md:flex-nowrap">
        {hasFilters ? (
          <div className="flex flex-wrap items-center gap-2">{children}</div>
        ) : null}

        {resultCount ? (
          <span className="whitespace-nowrap text-caption text-muted">{resultCount}</span>
        ) : null}

        {showClear ? (
          <button
            type="button"
            onClick={onClearFilters}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-body-sm text-body transition-colors hover:bg-surface-strong hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="size-4" aria-hidden />
            Clear filters
          </button>
        ) : null}
      </div>

      {/* Right region — search sits at the far right of the toolbar. */}
      {onSearchChange ? (
        <SearchInput
          value={search ?? ''}
          onValueChange={onSearchChange}
          placeholder={searchPlaceholder ?? 'Search'}
          className="w-full md:w-64 md:shrink-0"
        />
      ) : null}

      {actions ? (
        <div className="flex flex-wrap items-center gap-2 md:shrink-0">{actions}</div>
      ) : null}
    </div>
  );
}
