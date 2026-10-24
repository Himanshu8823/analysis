'use client';

import Image from 'next/image';
import Link from 'next/link';
import { LogOut, User, KeyRound } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { useCurrentUser, useLogout } from '@/hooks/useAuth';

/**
 * AppHeader — the 64px top bar.
 *
 * The header is a thin utility strip: the brand mark on the left, the user
 * menu on the right. It deliberately shows no page title or breadcrumb — the
 * sidebar already communicates where the user is, and the page itself owns
 * its heading.
 *
 * Background is `{colors.surface-soft}` so the bar separates from the white
 * page canvas without needing a heavy divider.
 */
export function AppHeader() {
  const { data: user } = useCurrentUser();
  const { mutate: logout, isPending: loggingOut } = useLogout();

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between gap-4 border-b border-hairline bg-surface-soft px-4 md:px-6 lg:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <SidebarTrigger className="-ml-2 focus-visible:ring-0 focus-visible:ring-offset-0 lg:hidden" />
        <Link
          href="/dashboard"
          className="flex min-w-0 items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Image
            src="/images/logo.png"
            alt="Resultiq logo"
            width={32}
            height={32}
            priority
            className="size-8 shrink-0 object-contain"
          />
          <span className="truncate font-display text-title-sm text-ink">Resultiq</span>
        </Link>
      </div>

      <div className="flex items-center gap-2">
        {user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="h-11 gap-2 rounded-full px-2 hover:bg-surface-strong focus-visible:ring-0 focus-visible:ring-offset-0"
              >
                <Avatar className="size-8">
                  <AvatarFallback className="bg-surface-strong text-caption-strong text-ink">
                    {initials(user.name)}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden max-w-[10rem] truncate text-body-sm font-semibold text-ink md:inline">
                  {user.name}
                </span>
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel className="normal-case">
                <span className="block text-caption text-muted">Signed in as</span>
                <span className="mt-0.5 block truncate text-body-sm font-semibold text-ink">
                  {user.email}
                </span>
                {user.role ? (
                  <span className="cb-badge mt-2 w-fit">{user.role}</span>
                ) : null}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/change-password">
                  <KeyRound aria-hidden />
                  Change password
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/dashboard">
                  <User aria-hidden />
                  My account
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => logout()}
                disabled={loggingOut}
                className="text-semantic-down focus:text-semantic-down [&_svg]:text-semantic-down"
              >
                <LogOut aria-hidden />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button variant="ghost" onClick={() => logout()} disabled={loggingOut}>
            Sign out
          </Button>
        )}
      </div>
    </header>
  );
}

function initials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0]?.toUpperCase() ?? '')
    .filter(Boolean)
    .slice(0, 2)
    .join('');
}
