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

/**
 * The permission catalogue.
 *
 * These mirror the `PERMISSIONS` list in `apps/backend/prisma/seed.ts`, which
 * is the live source of truth — the seed writes these rows into the
 * `permissions` table. Keep the two in step.
 */
export const PERMISSIONS = {
  STUDENTS_READ: 'students:read',
  STUDENTS_READ_OWN: 'students:read_own',
  STUDENTS_WRITE: 'students:write',
  MARKS_READ: 'marks:read',
  MARKS_READ_OWN: 'marks:read_own',
  MARKS_WRITE: 'marks:write',
  MARKS_ENTER_OWN_SUBJECT: 'marks:enter_own_subject',
  REPORTS_READ: 'reports:read',
  REPORTS_GENERATE: 'reports:generate',
  REPORTS_DOWNLOAD: 'reports:download',
  UPLOAD_CREATE: 'upload:create',
  UPLOAD_READ: 'upload:read',
  UPLOAD_PROCESS: 'upload:process',
  /**
   * Writing marks that came from an upload, for the subjects the member is
   * allocated to. Narrower than `upload:process` — the exam cell's
   * administrative reach over a whole extraction batch.
   */
  UPLOAD_PROCESS_OWN_SUBJECT: 'upload:process_own_subject',
  ANALYTICS_READ: 'analytics:read',
  ANALYTICS_READ_OWN_DEPARTMENT: 'analytics:read_own_department',
  USERS_READ: 'users:read',
  USERS_WRITE: 'users:write',
  RBAC_READ: 'rbac:read',
  RBAC_WRITE: 'rbac:write',
  AUDIT_READ: 'audit:read',
  INVITES_READ: 'invites:read',
  INVITES_WRITE: 'invites:write',
  BRANCHES_READ: 'branches:read',
  BRANCHES_WRITE: 'branches:write',
  BRANCHES_DELETE: 'branches:delete',
  SCHEMES_READ: 'schemes:read',
  SCHEMES_WRITE: 'schemes:write',
  SUBJECTS_READ: 'subjects:read',
  SUBJECTS_WRITE: 'subjects:write',
  SUBJECTS_DELETE: 'subjects:delete',
  SUBJECT_OFFERINGS_READ: 'subject_offerings:read',
  SUBJECT_OFFERINGS_WRITE: 'subject_offerings:write',
  ACADEMIC_YEARS_READ: 'academic_years:read',
  ACADEMIC_YEARS_WRITE: 'academic_years:write',
  EXAMINATIONS_READ: 'examinations:read',
  EXAMINATIONS_WRITE: 'examinations:write',
  TEACHER_ALLOCATIONS_READ: 'teacher_allocations:read',
  TEACHER_ALLOCATIONS_WRITE: 'teacher_allocations:write',
  CLASS_TEACHER_ASSIGNMENTS_READ: 'class_teacher_assignments:read',
  CLASS_TEACHER_ASSIGNMENTS_WRITE: 'class_teacher_assignments:write',
  NOTIFICATIONS_WRITE: 'notifications:write',
  TOPPERS_READ: 'toppers:read',
  TOPPERS_READ_OWN_CLASS: 'toppers:read_own_class',
  DASHBOARD_READ: 'dashboard:read',
} as const;

/**
 * The permissions each role holds.
 *
 * These mirror the `ROLE_PERMISSIONS` map in
 * `apps/backend/prisma/seed.ts`, which is the live source of truth. Keep the
 * two in step.
 *
 * The model is permission-first: a route is guarded by the permission it
 * needs, never by a role name. A role is a named bundle of permissions, and
 * a user may hold several roles at once — the union of their permissions is
 * what the guard sees.
 */
export const ROLE_PERMISSIONS = {
  /**
   * Configuration and read-only access to the academic data. Entering marks
   * and creating students belong to the exam cell; teaching belongs to the
   * allocated teacher.
   */
  SUPER_ADMIN: [
    PERMISSIONS.USERS_READ,
    PERMISSIONS.USERS_WRITE,
    PERMISSIONS.RBAC_READ,
    PERMISSIONS.RBAC_WRITE,
    PERMISSIONS.INVITES_READ,
    PERMISSIONS.INVITES_WRITE,
    PERMISSIONS.BRANCHES_READ,
    PERMISSIONS.BRANCHES_WRITE,
    PERMISSIONS.BRANCHES_DELETE,
    PERMISSIONS.ACADEMIC_YEARS_READ,
    PERMISSIONS.ACADEMIC_YEARS_WRITE,
    PERMISSIONS.SCHEMES_READ,
    PERMISSIONS.SCHEMES_WRITE,
    PERMISSIONS.SUBJECTS_READ,
    PERMISSIONS.SUBJECT_OFFERINGS_READ,
    PERMISSIONS.STUDENTS_READ,
    PERMISSIONS.MARKS_READ,
    PERMISSIONS.REPORTS_READ,
    PERMISSIONS.ANALYTICS_READ,
    PERMISSIONS.TOPPERS_READ,
    PERMISSIONS.DASHBOARD_READ,
    PERMISSIONS.AUDIT_READ,
  ],
  /** The exam cell: students, marks, reports and results publication. */
  ADMIN: [
    PERMISSIONS.STUDENTS_READ,
    PERMISSIONS.STUDENTS_WRITE,
    PERMISSIONS.SUBJECTS_READ,
    PERMISSIONS.SUBJECTS_WRITE,
    PERMISSIONS.SUBJECTS_DELETE,
    PERMISSIONS.SUBJECT_OFFERINGS_READ,
    PERMISSIONS.SUBJECT_OFFERINGS_WRITE,
    PERMISSIONS.MARKS_READ,
    PERMISSIONS.MARKS_WRITE,
    PERMISSIONS.MARKS_ENTER_OWN_SUBJECT,
    PERMISSIONS.UPLOAD_CREATE,
    PERMISSIONS.UPLOAD_READ,
    // The exam cell approves an extraction for the whole batch. The teacher's
    // narrower right — `upload:process_own_subject` — is deliberately absent:
    // a teacher writes a score only for the subjects the HOD allocated to
    // them, and an exam-cell admin holds no allocation (§3.3, §3.6).
    PERMISSIONS.UPLOAD_PROCESS,
    PERMISSIONS.REPORTS_READ,
    PERMISSIONS.REPORTS_GENERATE,
    PERMISSIONS.REPORTS_DOWNLOAD,
    PERMISSIONS.ANALYTICS_READ,
    PERMISSIONS.TOPPERS_READ,
    PERMISSIONS.DASHBOARD_READ,
    PERMISSIONS.BRANCHES_READ,
    PERMISSIONS.SCHEMES_READ,
    PERMISSIONS.ACADEMIC_YEARS_READ,
    PERMISSIONS.EXAMINATIONS_READ,
    PERMISSIONS.EXAMINATIONS_WRITE,
    PERMISSIONS.NOTIFICATIONS_WRITE,
  ],
  /** The branch-scoped department head who allocates the teaching. */
  HOD: [
    PERMISSIONS.STUDENTS_READ,
    PERMISSIONS.MARKS_READ,
    PERMISSIONS.REPORTS_READ,
    PERMISSIONS.REPORTS_GENERATE,
    PERMISSIONS.REPORTS_DOWNLOAD,
    PERMISSIONS.UPLOAD_READ,
    PERMISSIONS.ANALYTICS_READ,
    PERMISSIONS.ANALYTICS_READ_OWN_DEPARTMENT,
    PERMISSIONS.DASHBOARD_READ,
    PERMISSIONS.BRANCHES_READ,
    PERMISSIONS.SCHEMES_READ,
    PERMISSIONS.SUBJECTS_READ,
    PERMISSIONS.SUBJECT_OFFERINGS_READ,
    PERMISSIONS.SUBJECTS_WRITE,
    PERMISSIONS.SUBJECT_OFFERINGS_WRITE,
    PERMISSIONS.TOPPERS_READ,
    PERMISSIONS.TEACHER_ALLOCATIONS_READ,
    PERMISSIONS.TEACHER_ALLOCATIONS_WRITE,
    PERMISSIONS.CLASS_TEACHER_ASSIGNMENTS_READ,
    PERMISSIONS.CLASS_TEACHER_ASSIGNMENTS_WRITE,
  ],
  /**
   * Strictly read-only — not a single write permission.
   *
   * `audit:read` is read-only too, and §7.18 names the Principal as one of
   * the two roles that need to see who changed what.
   */
  PRINCIPAL: [
    PERMISSIONS.STUDENTS_READ,
    PERMISSIONS.MARKS_READ,
    PERMISSIONS.REPORTS_READ,
    PERMISSIONS.REPORTS_DOWNLOAD,
    PERMISSIONS.ANALYTICS_READ,
    PERMISSIONS.DASHBOARD_READ,
    PERMISSIONS.BRANCHES_READ,
    PERMISSIONS.SCHEMES_READ,
    PERMISSIONS.SUBJECTS_READ,
    PERMISSIONS.SUBJECT_OFFERINGS_READ,
    PERMISSIONS.TOPPERS_READ,
    PERMISSIONS.AUDIT_READ,
  ],
  /**
   * The subject teacher. Marks are entered under `marks:enter_own_subject`
   * rather than `marks:write` — the allocation check restricts the teacher
   * to the subjects the HOD has allocated to them.
   *
   * The teacher is one of the two roles the Upload Results screen is for
   * (§5): they upload the statement for the subjects they teach, and
   * `upload:process_own_subject` lets them write the extracted score for
   * those subjects and no others.
   */
  TEACHER: [
    PERMISSIONS.STUDENTS_READ,
    PERMISSIONS.MARKS_READ,
    PERMISSIONS.MARKS_ENTER_OWN_SUBJECT,
    PERMISSIONS.REPORTS_READ,
    PERMISSIONS.UPLOAD_READ,
    PERMISSIONS.UPLOAD_CREATE,
    PERMISSIONS.UPLOAD_PROCESS_OWN_SUBJECT,
    PERMISSIONS.DASHBOARD_READ,
    PERMISSIONS.BRANCHES_READ,
    PERMISSIONS.SCHEMES_READ,
    PERMISSIONS.SUBJECTS_READ,
    PERMISSIONS.SUBJECT_OFFERINGS_READ,
    PERMISSIONS.TOPPERS_READ,
    PERMISSIONS.ANALYTICS_READ,
    PERMISSIONS.TEACHER_ALLOCATIONS_READ,
    PERMISSIONS.CLASS_TEACHER_ASSIGNMENTS_READ,
  ],
  /**
   * A student sees exactly four things: the dashboard shell, their own
   * result, their own marks and their own class's toppers.
   *
   * `students:read`, `marks:read` and `reports:read` are deliberately
   * absent — they would expose the whole roster, every student's marks and
   * every report.
   */
  STUDENT: [
    PERMISSIONS.DASHBOARD_READ,
    PERMISSIONS.STUDENTS_READ_OWN,
    PERMISSIONS.MARKS_READ_OWN,
    PERMISSIONS.TOPPERS_READ_OWN_CLASS,
  ],
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
