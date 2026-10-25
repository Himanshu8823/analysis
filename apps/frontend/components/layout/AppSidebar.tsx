'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Upload,
  History,
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
  ScrollText,
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

interface AppSidebarProps {
  /**
   * The member's effective permissions — the union of every role they hold.
   *
   * The navigation gates on these, never on a role name (§3.1): a feature is
   * reachable because the member holds the permission behind it.
   */
  permissions?: string[];
  /** Rendered in the footer — used for the signed-in user block. */
  footer?: React.ReactNode;
}

const ICONS: Record<string, LucideIcon> = {
  home: LayoutDashboard,
  upload: Upload,
  history: History,
  users: Users,
  file: FileSpreadsheet,
  award: Award,
  chart: BarChart3,
  shield: ShieldCheck,
  folder: FolderCog,
  book: BookOpen,
  assignments: ClipboardCheck,
  audit: ScrollText,
};

/**
 * The Administration section.
 *
 * These are the governance screens — the ones that manage who may do what.
 * They are listed separately because they are a distinct concern from the
 * day-to-day workspace, and each still gates on its own permission.
 */
const ADMIN_ITEMS: {
  href: string;
  label: string;
  icon: LucideIcon;
  permissions: string[];
}[] = [
  {
    href: '/admin/members',
    label: 'Members',
    icon: ShieldCheck,
    permissions: ['users:read'],
  },
  {
    href: '/admin/roles',
    label: 'Roles & Permissions',
    icon: KeyRound,
    permissions: ['rbac:read'],
  },
  {
    href: '/admin/schemes',
    label: 'Schemes',
    icon: FolderCog,
    permissions: ['schemes:read'],
  },
  {
    href: '/admin/branches',
    label: 'Branches',
    icon: Building2,
    permissions: ['branches:read'],
  },
  {
    href: '/admin/academic-years',
    label: 'Academic Years',
    icon: CalendarRange,
    permissions: ['academic_years:read'],
  },
  {
    href: '/admin/audit-log',
    label: 'Audit Log',
    icon: ScrollText,
    permissions: ['audit:read'],
  },
];

export function AppSidebar({ permissions, footer }: AppSidebarProps) {
  const pathname = usePathname();

  /**
   * A screen is shown when the member holds *any* of its permissions.
   *
   * A member with no permissions at all — or a session that has not resolved
   * yet — sees no workspace entries, because showing a link that the server
   * will reject is worse than showing nothing.
   */
  const held = new Set(permissions ?? []);

  const can = (required: readonly string[]) =>
    required.some((permission) => held.has(permission));

  const items = NAV_ITEMS.filter((item) => can(item.permissions));
  const adminItems = ADMIN_ITEMS.filter((item) => can(item.permissions));
  const showAdminSection = adminItems.length > 0;

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
                {adminItems.map((item) => {
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
