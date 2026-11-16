'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

import { AppHeader } from '@/components/layout/AppHeader';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { NoAccess } from '@/components/feedback/NoAccess';
import { Spinner } from '@/components/feedback/Spinner';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { useCurrentUser } from '@/hooks/useAuth';
import { getSession } from '@/lib/auth/session-client';
import { canOpenScreen } from '@/lib/auth/screen-capabilities';
import { ClassContextProvider } from '@/lib/context/class-context';

interface AppShellProps {
  children: React.ReactNode;
}

/**
 * AppShell — the authenticated application chrome.
 *
 * Layout contract (3 breakpoints, mobile-first):
 * - Mobile (< 768px): the sidebar is an off-canvas sheet driven by
 *   `SidebarProvider`; the header carries the trigger.
 * - Tablet (768–1023px): the sidebar is pinned open at 16rem.
 * - Desktop (>= 1024px): the sidebar stays pinned; content gains wider
 *   gutters and a readable max-width so long lines never stretch.
 */
export function AppShell({ children }: AppShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: user, isLoading, isError } = useCurrentUser();

  /**
   * The stored session is read in an effect, never during render.
   *
   * Reading `localStorage` during the render is only possible in the browser,
   * so the first server render and the first client render would disagree on
   * whether a session exists — React then reports a hydration mismatch and
   * re-renders the whole tree.
   *
   * `null` means "not checked yet". It is distinct from `false` ("checked,
   * no session") because the redirect must not run before the check: on a
   * hard reload the query cache is empty, so `user` is briefly `undefined`
   * and treating that as "signed out" bounced every reload back to /login.
   */
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  useEffect(() => {
    setHasSession(!!getSession());
  }, []);

  useEffect(() => {
    if (hasSession === false) {
      router.replace('/login');
    }
  }, [hasSession, router]);

  /**
   * `!user` is NOT a sign-out signal on its own: the `me` query has not run
   * until the session check above enables it. Only a failed `me` request —
   * an expired session, a deactivated account — sends the user to /login.
   */
  useEffect(() => {
    if (hasSession === true && isError) {
      router.replace('/login');
    }
  }, [hasSession, isError, router]);

  /**
   * Forced password change.
   *
   * The flag comes from the backend, so the client cannot clear it by
   * editing its own state. The change-password page itself is exempt,
   * otherwise the redirect would loop.
   */
  useEffect(() => {
    if (!user?.mustChangePassword) return;
    if (pathname === '/change-password') return;
    router.replace('/change-password');
  }, [pathname, router, user?.mustChangePassword]);

  // Nothing to render until the session is known and the caller resolved:
  // the sidebar and header need `user`, and rendering them with an undefined
  // role would flash the wrong navigation.
  if (hasSession === null || isLoading || (hasSession && !user)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas">
        <Spinner size={32} label="Loading session" />
      </div>
    );
  }

  /**
   * The screen the member is on, and whether they may open it.
   *
   * The guard lives here, in the shell, rather than in each page. A guard
   * that each page has to remember to apply is a guard that some page will
   * forget — and a forgotten guard is a screen a member without the right
   * can open. The catalogue is shared with the backend, so this check and
   * the server's answer cannot drift apart.
   *
   * A path the catalogue does not name is left alone. The catalogue covers
   * the screens that carry data; the ones it does not name have no rule to
   * enforce, so the guard does not invent one.
   */
  const held = user?.permissions ?? [];
  const resolved = canOpenScreen(pathname, held);
  const refused = resolved.screen.known && !resolved.allowed;

  return (
    <SidebarProvider>
      {/* The navigation gates on the member's effective permissions — the
          union of every role they hold — not on a role name (§3.1). */}
      <AppSidebar permissions={user?.permissions} />
      <SidebarInset className="min-w-0">
        <AppHeader />
        {/* The class the member is working on is held above every screen, so
            the branch, scheme, semester and academic year are chosen once
            and are the same everywhere. */}
        <ClassContextProvider>
          <div className="flex-1 px-4 py-6 md:px-6 md:py-8 lg:px-8">
            <div className="mx-auto w-full max-w-[1200px]">
              {refused ? (
                /**
                 * The refusal replaces the screen rather than redirecting
                 * away from it. The member asked for this path; answering
                 * them on this path — with an explanation and a way back —
                 * is the difference between a decision and a dead end.
                 */
                <NoAccess screenLabel={resolved.screen.label} reason="role" />
              ) : (
                children
              )}
            </div>
          </div>
        </ClassContextProvider>
      </SidebarInset>
    </SidebarProvider>
  );
}
