'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Upload,
  Users,
  FileSpreadsheet,
  Award,
  BarChart3,
  ShieldCheck,
  FolderCog,
  Building2,
  CalendarRange,
  KeyRound,
  BookOpen,
  ClipboardCheck,
  type LucideIcon,
} from 'lucide-react';

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar';
import { NAV_ITEMS } from '@/lib/constants';
import type { UserRole } from '@result-analysis/shared-types';

interface AppSidebarProps {
  role?: string;
  /** Rendered in the footer — used for the signed-in user block. */
  footer?: React.ReactNode;
}

const ICONS: Record<string, LucideIcon> = {
  home: LayoutDashboard,
  upload: Upload,
  users: Users,
  file: FileSpreadsheet,
  award: Award,
  chart: BarChart3,
  shield: ShieldCheck,
  folder: FolderCog,
  book: BookOpen,
  assignments: ClipboardCheck,
};

/**
 * Navigation gate for the main nav entries.
 *
 * The server is the authority and authorises purely by permission
 * (`@Permissions(...)`); this map only avoids advertising links the signed-in
 * user is unlikely to use, and may be more conservative than the server.
 *
 * The map overrides the `roles` field on `NAV_ITEMS` where an entry appears
 * in both. Entries absent from this map are shown to everyone.
 */
const ROLE_ALLOW: Record<string, readonly UserRole[]> = {
  '/upload': ['SUPER_ADMIN', 'ADMIN'] as readonly UserRole[],
  '/admin/schemes': ['SUPER_ADMIN', 'ADMIN'] as readonly UserRole[],
  '/admin/members': ['SUPER_ADMIN'] as readonly UserRole[],
  // The exam cell (Admin) defines subjects; a HOD manages their own
  // branch's subjects; the Super Admin reads the whole catalogue.
  '/admin/subjects': ['SUPER_ADMIN', 'ADMIN', 'HOD'] as readonly UserRole[],
  // Allocating the teaching staff is the HOD's job within their own branch;
  // an Admin or the Super Admin can do it college-wide.
  '/admin/assignments': ['SUPER_ADMIN', 'ADMIN', 'HOD'] as readonly UserRole[],
};

/**
 * The Admin section as a whole is Super-Admin territory — inviting members and
 * managing roles is a Super-Admin-only capability.
 */
const ADMIN_SECTION_ROLES: readonly UserRole[] = ['SUPER_ADMIN'];

/**
 * The Administration section.
 *
 * These are Super-Admin-only pages (branches, academic years, members,
 * schemes), so they live in their own section below the workspace rather than
 * in `NAV_ITEMS`. The whole section is gated by `ADMIN_SECTION_ROLES`.
 */
const ADMIN_ITEMS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: '/admin/members', label: 'Members', icon: ShieldCheck },
  { href: '/admin/roles', label: 'Roles & Permissions', icon: KeyRound },
  { href: '/admin/schemes', label: 'Schemes', icon: FolderCog },
  { href: '/admin/branches', label: 'Branches', icon: Building2 },
  { href: '/admin/academic-years', label: 'Academic Years', icon: CalendarRange },
];

export function AppSidebar({ role, footer }: AppSidebarProps) {
  const pathname = usePathname();

  const items = NAV_ITEMS.filter((item) => {
    const allow = ROLE_ALLOW[item.href];
    if (!allow) return true;
    if (!role) return false;
    return allow.includes(role as UserRole);
  });

  const showAdminSection = !!role && ADMIN_SECTION_ROLES.includes(role as UserRole);

  return (
    <Sidebar collapsible="icon" className="border-r border-hairline">
      <SidebarRail />

      <SidebarContent className="py-5">
        <SidebarGroup className="p-0">
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const Icon = ICONS[item.icon] ?? LayoutDashboard;
                const active = isActivePath(pathname, item.href);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={item.label}
                      className="h-11"
                    >
                      <Link href={item.href} aria-current={active ? 'page' : undefined}>
                        <Icon aria-hidden />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {showAdminSection ? (
          <SidebarGroup className="mt-6 p-0">
            <SidebarGroupLabel className="px-4">Administration</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {ADMIN_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const active = isActivePath(pathname, item.href);
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                        isActive={active}
                        tooltip={item.label}
                        className="h-11"
                      >
                        <Link href={item.href} aria-current={active ? 'page' : undefined}>
                          <Icon aria-hidden />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : null}
      </SidebarContent>

      {footer ? <SidebarFooter className="border-t border-hairline p-3">{footer}</SidebarFooter> : null}
    </Sidebar>
  );
}

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}
