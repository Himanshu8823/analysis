'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Upload,
  Users,
  FileSpreadsheet,
  Award,
  BarChart3,
  FolderCog,
  ShieldCheck,
} from 'lucide-react';
import { NAV_ITEMS } from '@/lib/constants';
import type { UserRole } from '@/lib/types';
import type { ComponentType } from 'react';

interface SidebarProps {
  onNavigate?: () => void;
  role?: string;
}

const ICONS: Record<string, ComponentType<{ className?: string }>> = {
  home: LayoutDashboard,
  upload: Upload,
  users: Users,
  file: FileSpreadsheet,
  award: Award,
  chart: BarChart3,
  shield: ShieldCheck,
  folder: FolderCog,
};

const ROLE_ALLOW: Record<string, readonly UserRole[]> = {
  '/upload': ['SUPER_ADMIN', 'ADMIN'] as readonly UserRole[],
  '/admin/schemes': ['SUPER_ADMIN', 'ADMIN'] as readonly UserRole[],
  '/admin/members': ['SUPER_ADMIN'] as readonly UserRole[],
};

/**
 * The Admin section as a whole is Super-Admin territory — inviting members and
 * managing roles is a Super-Admin-only capability. The server enforces the
 * same rule (`@Roles('SUPER_ADMIN')` + `@Permissions('invites:*')`), so this
 * is only about not advertising links the user cannot use.
 */
const ADMIN_SECTION_ROLES: readonly UserRole[] = ['SUPER_ADMIN'];

export function Sidebar({ onNavigate, role }: SidebarProps) {
  const pathname = usePathname();

  const items = NAV_ITEMS.filter((item) => {
    const allow = ROLE_ALLOW[item.href];
    if (!allow) return true;
    if (!role) return false;
    return allow.includes(role as UserRole);
  });

  const showAdminSection =
    !!role && ADMIN_SECTION_ROLES.includes(role as UserRole);

  return (
    <nav
      aria-label="Primary"
      className="bg-canvas text-ink h-full w-full border-r border-hairline px-md py-lg"
    >
      <div className="mb-lg flex items-center gap-sm">
        <Image
          src="/images/logo.png"
          alt="Resultiq logo"
          width={36}
          height={36}
          className="h-9 w-9 object-contain"
        />
        <div>
          <p className="font-display text-title-sm text-ink">Resultiq</p>
          <p className="text-caption text-muted">Result Analysis</p>
        </div>
      </div>

      <ul className="flex flex-col gap-xs">
        {items.map((item) => {
          const Icon = ICONS[item.icon] ?? LayoutDashboard;
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? 'page' : undefined}
                className={`flex h-11 items-center gap-sm rounded-md px-sm text-body-sm transition-colors ${
                  active
                    ? 'bg-surface-strong font-semibold text-ink'
                    : 'text-body hover:bg-surface-soft hover:text-ink'
                }`}
              >
                <Icon className={`h-4 w-4 ${active ? 'text-primary' : 'text-muted'}`} aria-hidden />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>

      {/* Admin group separator + admin-only links */}
      {showAdminSection ? (
        <div className="mt-xl border-t border-hairline pt-lg">
          <p className="px-sm text-caption-strong uppercase tracking-wide text-muted">Admin</p>
          <ul className="mt-sm flex flex-col gap-xs">
            <AdminLink
              href="/admin/members"
              label="Members"
              pathname={pathname}
              onNavigate={onNavigate}
            />
            <AdminLink href="/admin/schemes" label="Schemes" pathname={pathname} onNavigate={onNavigate} />
          </ul>
        </div>
      ) : null}
    </nav>
  );
}

function AdminLink({
  href,
  label,
  pathname,
  onNavigate,
}: {
  href: string;
  label: string;
  pathname: string;
  onNavigate?: () => void;
}) {
  const active = pathname === href || pathname.startsWith(`${href}/`);
  return (
    <li>
      <Link
        href={href}
        onClick={onNavigate}
        aria-current={active ? 'page' : undefined}
        className={`flex h-11 items-center gap-sm rounded-md px-sm text-body-sm transition-colors ${
          active
            ? 'bg-surface-strong font-semibold text-ink'
            : 'text-body hover:bg-surface-soft hover:text-ink'
        }`}
      >
        {label}
      </Link>
    </li>
  );
}