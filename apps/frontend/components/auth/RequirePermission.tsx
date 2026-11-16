'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

import { NoAccess } from '@/components/feedback/NoAccess';
import { Spinner } from '@/components/feedback/Spinner';
import { useCurrentUser } from '@/hooks/useAuth';
import { canOpenScreen } from '@/lib/auth/screen-capabilities';

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
  /**
   * The name of the screen, shown in the refusal.
   *
   * "You do not have access to the Marks Entry screen" answers the member's
   * question; "You do not have access" leaves them guessing which page the
   * message belongs to.
   */
  screenLabel?: string;
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
 * A refusal is a **page**, not a redirect. Redirecting a member who typed a
 * path they may not use sends them somewhere they did not ask for, without
 * saying why — the dead end §1.7 rules out. The `NoAccess` page says what
 * happened and offers a way back.
 *
 * While the session is still resolving the guard renders a spinner rather
 * than refusing: a refusal fired before the permissions are known would turn
 * away a legitimate member.
 */
export function RequirePermission({
  permissions,
  children,
  fallbackHref = '/dashboard',
  screenLabel,
}: RequirePermissionProps) {
  const pathname = usePathname();
  const { data: user, isLoading } = useCurrentUser();

  const held = user?.permissions ?? [];
  const allowed = permissions.some((permission) => held.includes(permission));

  if (isLoading || !user) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner size={28} label="Checking access" />
      </div>
    );
  }

  if (!allowed) {
    return (
      <NoAccess
        screenLabel={screenLabel}
        homeHref={fallbackHref}
        reason="role"
      />
    );
  }

  /**
   * The screen may still name something the catalogue guards differently.
   *
   * The explicit `permissions` above are the screen's own rule; the
   * catalogue is the shared one. When they disagree, the stricter of the two
   * wins — a member is refused by whichever rule is narrower. This can only
   * happen if a screen declares its permissions loosely, so it is a signal
   * worth honouring rather than a branch to expect.
   */
  const resolved = canOpenScreen(pathname, held);
  if (!resolved.allowed) {
    return (
      <NoAccess
        screenLabel={screenLabel ?? resolved.screen.label}
        homeHref={fallbackHref}
        reason="role"
      />
    );
  }

  return <>{children}</>;
}
