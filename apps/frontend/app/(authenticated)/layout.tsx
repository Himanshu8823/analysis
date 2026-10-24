'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';
import { Spinner } from '@/components/feedback/Spinner';
import { useCurrentUser } from '@/hooks/useAuth';
import { getSession } from '@/lib/auth/session-client';

const BREADCRUMB_MAP: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/upload': 'Upload Results',
  '/students': 'Students',
  '/reports': 'Reports',
  '/toppers': 'Toppers',
  '/analytics': 'Analytics',
  '/admin/schemes': 'Admin / Schemes',
  '/admin/members': 'Admin / Members',
  '/change-password': 'Change password',
};

export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: user, isLoading, isError } = useCurrentUser();
  const hasSession = typeof window !== 'undefined' && !!getSession();

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

  if (isLoading && hasSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas">
        <Spinner size={32} label="Loading session" />
      </div>
    );
  }

  const breadcrumb = pathname
    ? Object.entries(BREADCRUMB_MAP).find(([key]) => pathname.startsWith(key))?.[1]
    : undefined;

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <Header breadcrumb={breadcrumb} />
      <div className="flex flex-col md:flex-row">
        <aside className="hidden md:block md:w-64 md:flex-shrink-0 lg:w-72">
          <div className="sticky top-16 h-[calc(100vh-4rem)]">
            <Sidebar role={user?.role} />
          </div>
        </aside>
        <main className="flex-1 px-base py-lg md:px-lg lg:px-xl">{children}</main>
      </div>
    </div>
  );
}