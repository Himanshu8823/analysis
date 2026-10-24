'use client';

import { type ReactNode } from 'react';

import { cn } from '@/lib/utils';

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  /** `card` draws its own border (standalone); `plain` sits inside a card. */
  variant?: 'card' | 'plain';
  className?: string;
}

/**
 * EmptyState — the zero-data state for a list or table.
 *
 * Design rationale:
 * - A table that has no rows should still show its frame, so the empty state
 *   sits *inside* the table card rather than replacing it. Otherwise the page
 *   loses its structure and the toolbar above appears to float.
 * - The state names what is missing and what to do next; the primary action
 *   is repeated here only when it is the one thing that resolves the state.
 * - Vertical padding is generous so the state reads as intentional rather
 *   than as a failed fetch.
 */
export function EmptyState({
  title,
  description,
  icon,
  action,
  variant = 'card',
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center px-6 py-14 text-center',
        variant === 'card' && 'rounded-xl border border-hairline bg-card',
        className,
      )}
    >
      {icon ? (
        <span
          className="mb-4 inline-flex size-11 items-center justify-center rounded-full bg-surface-strong text-muted"
          aria-hidden
        >
          {icon}
        </span>
      ) : null}

      <h3 className="font-display text-title-md text-ink">{title}</h3>

      {description ? (
        <p className="mt-2 max-w-md text-body-sm text-body">{description}</p>
      ) : null}

      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
