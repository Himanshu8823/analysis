'use client';

import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';

import { Spinner } from '@/components/feedback/Spinner';
import { useCurrentUser } from '@/hooks/useAuth';

interface RequirePermissionProps {
  /**
   * The permission the screen needs.
   *
   * The member qualifies when they hold *any* of them — the same union rule
   * the navigation uses (§3.1). A screen is reachable because the member
   * holds the permission behind it, never because of a role name.
   */
  permissions: readonly string[];
  children: ReactNode;
  /**
   * Where to send a member who does not hold the permission.
   *
   * Defaults to the dashboard, which every member can reach.
   */
  fallbackHref?: string;
}

/**
 * RequirePermission — the route-level guard for a screen.
 *
 * A screen that a member may not use must not merely hide its link; the
 * page itself has to refuse. Without this, anyone with a session could type
 * the path and land on a screen whose every action the server will reject
 * with a 403 — a broken page rather than a clear answer.
 *
 * The server remains the authority: this only avoids showing a screen the
 * member cannot use. Every route behind it is guarded server-side too, so
 * the check here is a convenience, not the security boundary.
 *
 * While the session is still resolving the guard renders nothing rather than
 * redirecting — a redirect fired before the permissions are known would send
 * a legitimate member away.
 */
export function RequirePermission({
  permissions,
  children,
  fallbackHref = '/dashboard',
}: RequirePermissionProps) {
  const router = useRouter();
  const { data: user, isLoading } = useCurrentUser();

  const held = user?.permissions ?? [];
  const allowed = permissions.some((permission) => held.includes(permission));

  useEffect(() => {
    if (!isLoading && user && !allowed) {
      router.replace(fallbackHref);
    }
  }, [isLoading, user, allowed, fallbackHref, router]);

  if (isLoading || !user) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner size={28} label="Checking access" />
      </div>
    );
  }

  if (!allowed) {
    // The effect above is already redirecting. This branch is what is
    // painted for the frame in between, so it must not flash the screen.
    return null;
  }

  return <>{children}</>;
}
