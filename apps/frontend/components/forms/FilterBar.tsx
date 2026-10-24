'use client';

import { type ReactNode } from 'react';
import { Search } from 'lucide-react';

interface FilterBarProps {
  search?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  children?: ReactNode;
}

/**
 * Coinbase-style filter bar — search pill on the left, slots for selects / actions on the right.
 * Stacks on mobile, lays out horizontally on tablet+.
 */
export function FilterBar({
  search,
  onSearchChange,
  searchPlaceholder,
  children,
}: FilterBarProps) {
  return (
    <div className="flex flex-col gap-sm md:flex-row md:items-center md:justify-between">
      {onSearchChange ? (
        <label className="relative flex w-full items-center md:max-w-sm">
          <Search
            aria-hidden
            className="pointer-events-none absolute left-sm h-4 w-4 text-muted"
          />
          <input
            type="search"
            value={search ?? ''}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder ?? 'Search'}
            className="cb-input pl-xl"
          />
        </label>
      ) : null}
      <div className="flex flex-wrap items-center gap-xs">{children}</div>
    </div>
  );
}