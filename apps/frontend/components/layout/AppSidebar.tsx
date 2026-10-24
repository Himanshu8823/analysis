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
};

/**
 * Role gate for the main nav entries.
 *
 * The server enforces the same rule on every endpoint (`@Roles(...)` +
 * `@Permissions(...)`); this only avoids advertising links the signed-in user
 * cannot actually use.
 */
const ROLE_ALLOW: Record<string, readonly UserRole[]> = {
  '/upload': ['SUPER_ADMIN', 'ADMIN'] as readonly UserRole[],
  '/admin/schemes': ['SUPER_ADMIN', 'ADMIN'] as readonly UserRole[],
  '/admin/members': ['SUPER_ADMIN'] as readonly UserRole[],
};

/**
 * The Admin section as a whole is Super-Admin territory — inviting members and
 * managing roles is a Super-Admin-only capability.
 */
const ADMIN_SECTION_ROLES: readonly UserRole[] = ['SUPER_ADMIN'];

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
          <SidebarGroupLabel className="px-4">Workspace</SidebarGroupLabel>
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
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={isActivePath(pathname, '/admin/members')}
                    tooltip="Members"
                    className="h-11"
                  >
                    <Link
                      href="/admin/members"
                      aria-current={isActivePath(pathname, '/admin/members') ? 'page' : undefined}
                    >
                      <ShieldCheck aria-hidden />
                      <span>Members</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={isActivePath(pathname, '/admin/schemes')}
                    tooltip="Schemes"
                    className="h-11"
                  >
                    <Link
                      href="/admin/schemes"
                      aria-current={isActivePath(pathname, '/admin/schemes') ? 'page' : undefined}
                    >
                      <FolderCog aria-hidden />
                      <span>Schemes</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
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
