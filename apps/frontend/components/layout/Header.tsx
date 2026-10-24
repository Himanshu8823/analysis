'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Menu, X, ChevronDown, LogOut } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { useLogout, useCurrentUser } from '@/hooks/useAuth';

interface HeaderProps {
  breadcrumb?: string;
}

/**
 * Header — 64px Coinbase top-nav.
 * - Mobile (< 768px): hamburger opens a sheet below the header
 * - Tablet (md+): hamburger collapses; primary brand + breadcrumb visible
 * - Desktop (lg+): breadcrumb + user dropdown right-aligned
 */
export function Header({ breadcrumb }: HeaderProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { data: user } = useCurrentUser();
  const { mutate: logout, isPending: loggingOut } = useLogout();

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-hairline bg-canvas px-base md:px-lg">
        <div className="flex min-w-0 items-center gap-sm">
          <button
            type="button"
            aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((v) => !v)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-surface-strong text-ink md:hidden"
          >
            {mobileOpen ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
          </button>
          <div className="flex min-w-0 items-baseline gap-sm">
            <Image
              src="/images/logo.png"
              alt="Resultiq logo"
              width={32}
              height={32}
              className="h-8 w-8 object-contain"
            />
            <span className="font-display text-title-sm text-ink">Resultiq</span>
            {breadcrumb ? (
              <span className="hidden truncate text-body-sm text-muted md:inline">/ {breadcrumb}</span>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-xs">
          {user ? (
            <div className="relative">
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((v) => !v)}
                className="inline-flex h-11 items-center gap-2 rounded-full bg-surface-strong px-sm text-body-sm text-ink"
              >
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-canvas text-caption-strong text-ink">
                  {initials(user.name)}
                </span>
                <span className="hidden text-body-sm font-semibold md:inline">{user.name}</span>
                <ChevronDown className="h-4 w-4 text-muted" aria-hidden />
              </button>
              {menuOpen ? (
                <div
                  role="menu"
                  className="absolute right-0 top-12 w-56 rounded-lg border border-hairline bg-canvas p-xs shadow-coinbase"
                >
                  <div className="px-sm py-xs">
                    <p className="text-caption text-muted">Signed in as</p>
                    <p className="truncate text-body-sm text-ink">{user.email}</p>
                    <p className="mt-xs">
                      <span className="cb-badge">{user.role}</span>
                    </p>
                  </div>
                  <div className="my-xs border-t border-hairline" />
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      logout();
                    }}
                    disabled={loggingOut}
                    className="flex w-full items-center gap-sm rounded-md px-sm py-xs text-left text-body-sm text-ink hover:bg-surface-soft disabled:opacity-60"
                  >
                    <LogOut className="h-4 w-4 text-muted" aria-hidden />
                    Sign out
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => logout()}
              disabled={loggingOut}
              className="cb-btn-tertiary"
            >
              Sign out
            </button>
          )}
        </div>
      </header>

      {/* Mobile sheet — collapses below header on mobile, hidden at md+ */}
      {mobileOpen ? (
        <div className="border-b border-hairline md:hidden">
          <Sidebar onNavigate={() => setMobileOpen(false)} role={user?.role} />
        </div>
      ) : null}
    </>
  );
}

function initials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0]?.toUpperCase() ?? '')
    .slice(0, 2)
    .join('');
}