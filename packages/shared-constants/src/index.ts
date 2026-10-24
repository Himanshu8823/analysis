// ============================================================================
// Shared Constants
// ============================================================================

export const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  HOD: 'HOD',
  TEACHER: 'TEACHER',
  PRINCIPAL: 'PRINCIPAL',
  STUDENT: 'STUDENT',
} as const;

export const PERMISSIONS = {
  STUDENTS_READ: 'students:read',
  STUDENTS_WRITE: 'students:write',
  MARKS_READ: 'marks:read',
  MARKS_WRITE: 'marks:write',
  MARKS_EDIT_OWN_SUBJECT: 'marks:edit_own_subject',
  REPORTS_READ: 'reports:read',
  REPORTS_GENERATE: 'reports:generate',
  REPORTS_DOWNLOAD: 'reports:download',
  UPLOAD_CREATE: 'upload:create',
  UPLOAD_PROCESS: 'upload:process',
  ANALYTICS_READ: 'analytics:read',
  ANALYTICS_READ_OWN_DEPARTMENT: 'analytics:read_own_department',
  USERS_READ: 'users:read',
  USERS_WRITE: 'users:write',
  RBAC_READ: 'rbac:read',
  RBAC_WRITE: 'rbac:write',
} as const;

export const ROLE_PERMISSIONS = {
  SUPER_ADMIN: Object.values(PERMISSIONS),
  ADMIN: [
    PERMISSIONS.STUDENTS_READ,
    PERMISSIONS.STUDENTS_WRITE,
    PERMISSIONS.MARKS_READ,
    PERMISSIONS.MARKS_WRITE,
    PERMISSIONS.REPORTS_READ,
    PERMISSIONS.REPORTS_GENERATE,
    PERMISSIONS.REPORTS_DOWNLOAD,
    PERMISSIONS.UPLOAD_CREATE,
    PERMISSIONS.UPLOAD_PROCESS,
    PERMISSIONS.ANALYTICS_READ,
    PERMISSIONS.USERS_READ,
  ],
  HOD: [
    PERMISSIONS.STUDENTS_READ,
    PERMISSIONS.MARKS_READ,
    PERMISSIONS.REPORTS_READ,
    PERMISSIONS.REPORTS_DOWNLOAD,
    PERMISSIONS.ANALYTICS_READ,
    PERMISSIONS.ANALYTICS_READ_OWN_DEPARTMENT,
  ],
  TEACHER: [
    PERMISSIONS.STUDENTS_READ,
    PERMISSIONS.MARKS_READ,
    PERMISSIONS.MARKS_EDIT_OWN_SUBJECT,
    PERMISSIONS.REPORTS_READ,
  ],
  PRINCIPAL: [
    PERMISSIONS.STUDENTS_READ,
    PERMISSIONS.MARKS_READ,
    PERMISSIONS.REPORTS_READ,
    PERMISSIONS.REPORTS_DOWNLOAD,
    PERMISSIONS.ANALYTICS_READ,
  ],
  STUDENT: [PERMISSIONS.STUDENTS_READ, PERMISSIONS.MARKS_READ, PERMISSIONS.REPORTS_READ],
} as const;

export const EXAM_TYPES = {
  CA1: 'CA1',
  CA2: 'CA2',
  MID_SEM: 'MID_SEM',
  WRITTEN: 'WRITTEN',
  PRACTICAL: 'PRACTICAL',
  ORAL: 'ORAL',
} as const;

export const SCHEMES = {
  SCHEME_2019: 'SCHEME_2019',
  SCHEME_2022: 'SCHEME_2022',
  SCHEME_2024: 'SCHEME_2024',
} as const;

export const DEFAULT_ACADEMIC_YEAR = '2024-25';

export const FILE_UPLOAD = {
  MAX_SIZE_BYTES: 50 * 1024 * 1024, // 50MB
  ALLOWED_EXCEL_TYPES: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel', 'text/csv'],
  ALLOWED_PDF_TYPES: ['application/pdf'],
} as const;

export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
} as const;

export const CACHE_KEYS = {
  USER_PERMISSIONS: (userId: string) => `cache:user:permissions:${userId}`,
  BRANCH_LIST: 'cache:branch:list',
  SCHEME_LIST: 'cache:scheme:list',
  SCHEME_RULES: (schemeId: string) => `cache:scheme:rules:${schemeId}`,
  SUBJECTS_BY_BRANCH_SCHEME_SEM: (branchId: string, schemeId: string, sem: number) =>
    `cache:subjects:${branchId}:${schemeId}:${sem}`,
} as const;

export const CACHE_TTL = {
  USER_PERMISSIONS: 5 * 60, // 5 min
  BRANCH_LIST: 60 * 60, // 1 hr
  SCHEME_LIST: 60 * 60,
  SCHEME_RULES: 30 * 60,
  SUBJECTS_LIST: 60 * 60,
} as const;

export const RATE_LIMITS = {
  LOGIN: { windowMs: 15 * 60 * 1000, max: 5 }, // 5 per 15 min
  UPLOAD: { windowMs: 60 * 60 * 1000, max: 10 }, // 10 per hr
  REPORT_GENERATE: { windowMs: 60 * 60 * 1000, max: 5 },
  GENERAL_API: { windowMs: 60 * 1000, max: 100 },
  ANALYTICS: { windowMs: 60 * 1000, max: 30 },
} as const;
