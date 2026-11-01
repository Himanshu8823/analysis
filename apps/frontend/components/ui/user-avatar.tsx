'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

/**
 * UserAvatar — a member's picture, or their initials when there is no picture.
 *
 * The image is rendered through Radix's `AvatarImage`, which only paints
 * once the picture has actually loaded. Until then — and whenever the
 * member has no picture at all — the initials fallback shows through, so
 * the slot never appears empty.
 *
 * `avatarUrl` points into the object-storage bucket. A picture that fails to
 * load (the member deleted it, or the URL went stale) falls back to the
 * initials rather than leaving a broken image.
 */
interface UserAvatarProps {
  name: string;
  avatarUrl?: string | null;
  /** The rendered size of the circle. */
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZES = {
  sm: 'size-8 text-caption-strong',
  md: 'size-12 text-body-sm',
  lg: 'size-24 text-title-sm',
} as const;

export function UserAvatar({ name, avatarUrl, size = 'md', className }: UserAvatarProps) {
  return (
    <Avatar className={cn(SIZES[size], className)}>
      {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
      <AvatarFallback
        className={cn(
          'bg-surface-strong font-semibold text-ink',
          SIZES[size],
        )}
      >
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  );
}

/**
 * The first two letters of the member's name.
 *
 * A name with fewer than two words yields a single letter, and a name that
 * is only whitespace yields nothing — the fallback then shows the first
 * letter of whatever the browser has, which keeps the slot from collapsing.
 */
function initials(name: string): string {
  const letters = name
    .trim()
    .split(/\s+/)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .filter(Boolean)
    .slice(0, 2)
    .join('');

  return letters || '?';
}
