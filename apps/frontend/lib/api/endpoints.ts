// All API endpoints as constants - single source of truth
export const ENDPOINTS = {
  AUTH: {
    LOGIN: '/auth/login',
    LOGOUT: '/auth/logout',
    REFRESH: '/auth/refresh',
    FORGOT_PASSWORD: '/auth/forgot-password',
    RESET_PASSWORD: '/auth/reset-password',
    ME: '/auth/me',
    ACCEPT_INVITE: '/auth/accept-invite',
    CHANGE_PASSWORD: '/auth/change-password',
  },
  USERS: {
    LIST: '/users',
    CREATE: '/users',
    GET: (id: string) => `/users/${id}`,
    UPDATE: (id: string) => `/users/${id}`,
    DELETE: (id: string) => `/users/${id}`,
    MEMBERS: '/users/members',
    ROLES: '/users/roles',
  },
  INVITES: {
    LIST: '/invites',
    CREATE: '/invites',
    COUNTS: '/invites/counts',
    VALIDATE: (token: string) => `/invites/validate?token=${encodeURIComponent(token)}`,
    REVOKE: (id: string) => `/invites/${id}/revoke`,
    RESEND: (id: string) => `/invites/${id}/resend`,
  },
  BRANCHES: {
    LIST: '/branches',
    CREATE: '/branches',
    UPDATE: (id: string) => `/branches/${id}`,
    DELETE: (id: string) => `/branches/${id}`,
  },
  SCHEMES: {
    LIST: '/schemes',
    CREATE: '/schemes',
    GET: (id: string) => `/schemes/${id}`,
    UPDATE: (id: string) => `/schemes/${id}`,
  },
  SUBJECTS: {
    LIST: '/subjects',
    CREATE: '/subjects',
    BY_BRANCH_SCHEME_SEM: (branchId: string, schemeId: string, sem: number) =>
      `/subjects?branchId=${branchId}&schemeId=${schemeId}&semester=${sem}`,
    UPDATE: (id: string) => `/subjects/${id}`,
    DELETE: (id: string) => `/subjects/${id}`,
  },
  STUDENTS: {
    LIST: '/students',
    CREATE: '/students',
    BULK_IMPORT: '/students/bulk-import',
    GET: (id: string) => `/students/${id}`,
    UPDATE: (id: string) => `/students/${id}`,
    DELETE: (id: string) => `/students/${id}`,
  },
  MARKS: {
    LIST: '/marks',
    CREATE_BULK: '/marks/bulk',
    UPDATE: (id: string) => `/marks/${id}`,
    CALCULATE: '/marks/calculate',
  },
  UPLOAD: {
    CREATE: '/upload',
    GET_JOB: (jobId: string) => `/upload/jobs/${jobId}`,
    CONFIRM: (jobId: string) => `/upload/jobs/${jobId}/confirm`,
  },
  REPORTS: {
    GENERATE: '/reports/generate',
    LIST: '/reports',
    DOWNLOAD: (id: string) => `/reports/${id}/download`,
  },
  TOPPERS: {
    SUBJECT_WISE: (params: Record<string, string>) => `/toppers/subject-wise?${new URLSearchParams(params)}`,
    CLASS: (params: Record<string, string>) => `/toppers/class?${new URLSearchParams(params)}`,
  },
  ANALYTICS: {
    OVERVIEW: '/analytics/overview',
    PASS_FAIL: '/analytics/pass-fail',
    SUBJECT_DIFFICULTY: '/analytics/subject-difficulty',
    PERFORMANCE_TRENDS: '/analytics/performance-trends',
  },
  AUDIT_LOGS: {
    LIST: '/audit-logs',
  },
} as const;