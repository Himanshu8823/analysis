/**
 * The main navigation.
 *
 * Every entry names the *permission* behind the screen, never a role name
 * (§3.1). The server is the authority and authorises by permission; this
 * list only avoids advertising a screen the signed-in member cannot use, and
 * it may be more permissive than the server.
 *
 * A member holding several roles gets the union of their permissions, so a
 * screen appears as soon as *any* of their roles grants its permission.
 */
export const NAV_ITEMS = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    icon: 'home',
    permissions: ['dashboard:read'],
  },
  {
    href: '/my-result',
    label: 'My Result',
    icon: 'award',
    permissions: ['marks:read_own'],
  },
  {
    href: '/upload',
    label: 'Upload Results',
    icon: 'upload',
    permissions: ['upload:create'],
  },
  {
    href: '/students',
    label: 'Students',
    icon: 'users',
    permissions: ['students:read'],
  },
  {
    href: '/marks',
    label: 'Marks Entry',
    icon: 'file',
    permissions: ['marks:enter_own_subject'],
  },
  {
    href: '/admin/subjects',
    label: 'Subjects',
    icon: 'book',
    permissions: ['subjects:read'],
  },
  {
    href: '/admin/assignments',
    label: 'Assignments',
    icon: 'assignments',
    permissions: ['teacher_allocations:read', 'class_teacher_assignments:read'],
  },
  {
    href: '/class-overview',
    label: 'Class Overview',
    icon: 'users',
    permissions: ['class_teacher_assignments:read'],
  },
  {
    href: '/reports',
    label: 'Reports',
    icon: 'file',
    permissions: ['reports:read'],
  },
  {
    href: '/toppers',
    label: 'Toppers',
    icon: 'award',
    permissions: ['toppers:read', 'toppers:read_own_class'],
  },
  {
    href: '/analytics',
    label: 'Analytics',
    icon: 'chart',
    permissions: ['analytics:read'],
  },
] as const;

export const MOBILE_BREAKPOINT = 768;
export const TABLET_BREAKPOINT = 1024;

export const QUERY_STALE_TIMES = {
  SHORT: 30 * 1000, // 30 sec
  MEDIUM: 60 * 1000, // 1 min
  LONG: 5 * 60 * 1000, // 5 min
  CONFIG: 30 * 60 * 1000, // 30 min
};
