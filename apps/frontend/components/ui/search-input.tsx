'use client';

import { forwardRef, type InputHTMLAttributes } from 'react';
import { Search, X } from 'lucide-react';

import { cn } from '@/lib/utils';

interface SearchInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  value: string;
  onValueChange: (value: string) => void;
  /** Width of the field. `sm` for compact toolbars, `default` for full pages. */
  size?: 'sm' | 'default';
}

/**
 * SearchInput — the search field used in data-table toolbars.
 *
 * Follows DESIGN.md `components.search-input-pill`: a pill-shaped field on
 * `{colors.surface-strong}` with a 44px height. The magnifier sits inside the
 * field on the left; a clear button appears on the right only once the field
 * has a value, so the empty state stays uncluttered.
 *
 * The `className` prop lands on the outer wrapper so callers can size the
 * whole control; the inner input is always `w-full` and `min-w-0` so the
 * placeholder truncates instead of overflowing the field.
 */
export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  ({ value, onValueChange, size = 'default', className, placeholder = 'Search', ...props }, ref) => (
    <div className={cn('relative flex min-w-0 items-center', className)}>
      <Search
        aria-hidden
        className={cn(
          'pointer-events-none absolute left-4 text-muted',
          size === 'sm' ? 'size-4' : 'size-[18px]',
        )}
      />
      <input
        ref={ref}
        type="search"
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        placeholder={placeholder}
        className={cn(
          'w-full min-w-0 rounded-full border border-transparent bg-surface-strong pl-11 pr-11 text-body-sm text-ink transition-colors placeholder:truncate placeholder:text-muted hover:bg-surface-strong focus:border-primary focus:bg-canvas focus:outline-none focus:ring-0 [&::-webkit-search-cancel-button]:appearance-none',
          size === 'sm' ? 'h-9' : 'h-11',
        )}
        {...props}
      />
      {value ? (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onValueChange('')}
          className={cn(
            'absolute right-2 inline-flex items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-strong hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            size === 'sm' ? 'size-7' : 'size-8',
          )}
        >
          <X className="size-4" aria-hidden />
        </button>
      ) : null}
    </div>
  ),
);
SearchInput.displayName = 'SearchInput';
