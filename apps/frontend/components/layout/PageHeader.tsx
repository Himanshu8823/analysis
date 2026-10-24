'use client';

import { type ReactNode } from 'react';

import { cn } from '@/lib/utils';

interface PageHeaderProps {
  /**
   * Optional small uppercase label above the title. Rendered as a plain
   * inline text label (not a filled badge) so it stays subordinate to the
   * heading instead of competing with it.
   */
  eyebrow?: string;
  title: string;
  description?: string;
  /** Page-level actions, right-aligned on tablet and up. */
  actions?: ReactNode;
  className?: string;
}

/**
 * PageHeader — the standard header block for an authenticated page.
 *
 * Design rationale:
 * - The old pattern rendered a filled badge as the page's first element. A
 *   badge is a pill, and a filled pill at the very top of a page reads as a
 *   colour banner rather than a label — it out-shouts the title it is meant
 *   to support. The eyebrow here is a plain uppercase text label, which is
 *   what the research calls an "eyebrow": context for the H1, never a
 *   container competing with it.
 * - The title uses display type at weight 400, per DESIGN.md.
 * - Actions align to the baseline of the title block on tablet and up, and
 *   drop below it on mobile where horizontal space is scarce. Vertical
 *   padding is kept tight so the header does not eat the fold.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        'flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-6',
        className,
      )}
    >
      <div className="flex min-w-0 flex-col gap-1">
        {eyebrow ? (
          <span className="text-caption-strong uppercase tracking-wide text-muted">
            {eyebrow}
          </span>
        ) : null}
        <h1 className="font-display text-title-lg text-ink md:text-display-sm">{title}</h1>
        {description ? (
          <p className="max-w-2xl text-body-sm text-body">{description}</p>
        ) : null}
      </div>

      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2 md:pt-1">
          {actions}
        </div>
      ) : null}
    </header>
  );
}
