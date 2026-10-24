export const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: 'home' },
  { href: '/upload', label: 'Upload Results', icon: 'upload', roles: ['SUPER_ADMIN', 'ADMIN'] },
  { href: '/students', label: 'Students', icon: 'users' },
  { href: '/reports', label: 'Reports', icon: 'file' },
  { href: '/toppers', label: 'Toppers', icon: 'award' },
  { href: '/analytics', label: 'Analytics', icon: 'chart' },
] as const;

export const MOBILE_BREAKPOINT = 768;
export const TABLET_BREAKPOINT = 1024;

export const QUERY_STALE_TIMES = {
  SHORT: 30 * 1000, // 30 sec
  MEDIUM: 60 * 1000, // 1 min
  LONG: 5 * 60 * 1000, // 5 min
  CONFIG: 30 * 60 * 1000, // 30 min
} as const;