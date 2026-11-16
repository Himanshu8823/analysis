'use client';

import { type ReactNode } from 'react';

import { cn } from '@/lib/utils';

/**
 * ProfileSection — one titled block of the student profile.
 *
 * The profile is a long page of distinct blocks, and the reader has to be
 * able to tell where one ends and the next begins. A titled card with a
 * hairline rule does that; a pile of unlabelled rows does not.
 */
export function ProfileSection({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn('cb-surface-card overflow-hidden rounded-md', className)}
      aria-label={title}
    >
      <header className="flex flex-col gap-2 border-b border-hairline px-base py-base md:flex-row md:items-start md:justify-between md:gap-4">
        <div className="min-w-0">
          <h2 className="font-display text-title-md text-ink">{title}</h2>
          {description ? (
            <p className="mt-1 text-caption text-muted">{description}</p>
          ) : null}
        </div>
        {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
      </header>
      <div className="p-base">{children}</div>
    </section>
  );
}

/**
 * DetailRow — one labelled value.
 *
 * The label sits above the value on mobile, where two columns would be too
 * narrow to read, and beside it from tablet up.
 */
export function DetailRow({
  label,
  value,
  wide,
}: {
  label: string;
  value: ReactNode;
  /** Spans the full width of the grid — for a long address or a note. */
  wide?: boolean;
}) {
  return (
    <div className={cn('flex flex-col gap-0.5', wide && 'sm:col-span-2')}>
      <dt className="text-caption uppercase tracking-wide text-muted">{label}</dt>
      <dd className="text-body-sm font-semibold text-ink break-words">{value}</dd>
    </div>
  );
}

/**
 * DetailGrid — the grid the detail rows sit in.
 */
export function DetailGrid({
  columns = 2,
  children,
}: {
  columns?: 2 | 3 | 4;
  children: ReactNode;
}) {
  const columnClass =
    columns === 4
      ? 'sm:grid-cols-2 lg:grid-cols-4'
      : columns === 3
        ? 'sm:grid-cols-2 lg:grid-cols-3'
        : 'sm:grid-cols-2';

  return <dl className={cn('grid grid-cols-1 gap-base', columnClass)}>{children}</dl>;
}

/**
 * StatusPill — a small coloured label for a state.
 *
 * Only the two semantic tones exist in the design system, so a status is
 * either good (green), bad (red) or neutral (grey). A third colour would
 * be a colour the design system does not have.
 */
export function StatusPill({
  label,
  tone,
}: {
  label: string;
  tone: 'up' | 'down' | 'neutral';
}) {
  const toneClass =
    tone === 'up'
      ? 'bg-surface-strong text-semantic-up'
      : tone === 'down'
        ? 'bg-surface-strong text-semantic-down'
        : 'bg-surface-strong text-body';

  return <span className={cn('cb-badge', toneClass)}>{label}</span>;
}
