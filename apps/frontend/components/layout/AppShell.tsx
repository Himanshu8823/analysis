'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

import { AppHeader } from '@/components/layout/AppHeader';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { Spinner } from '@/components/feedback/Spinner';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { useCurrentUser } from '@/hooks/useAuth';
import { getSession } from '@/lib/auth/session-client';

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
   * re-renders the whole tree. Keeping the value in state, initialised to a
   * fixed value, keeps the server and the client markup identical.
   */
  const [hasSession, setHasSession] = useState(true);

  useEffect(() => {
    setHasSession(!!getSession());
  }, []);

  useEffect(() => {
    if (!hasSession) {
      router.replace('/login');
    }
  }, [hasSession, router]);

  useEffect(() => {
    if (hasSession && !isLoading && (isError || !user)) {
      router.replace('/login');
    }
  }, [hasSession, isError, isLoading, router, user]);

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

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas">
        <Spinner size={32} label="Loading session" />
      </div>
    );
  }

  return (
    <SidebarProvider>
      <AppSidebar role={user?.role} />
      <SidebarInset className="min-w-0">
        <AppHeader />
        <div className="flex-1 px-4 py-6 md:px-6 md:py-8 lg:px-8">
          <div className="mx-auto w-full max-w-[1200px]">{children}</div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
