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
  ROLES: {
    LIST: '/roles',
    CREATE: '/roles',
    GET: (id: string) => `/roles/${id}`,
    UPDATE: (id: string) => `/roles/${id}`,
    DELETE: (id: string) => `/roles/${id}`,
    PERMISSIONS: (id: string) => `/roles/${id}/permissions`,
    ASSIGN_PERMISSIONS: (id: string) => `/roles/${id}/permissions`,
  },
  PERMISSIONS: {
    LIST: '/permissions',
    CREATE: '/permissions',
    DELETE: (id: string) => `/permissions/${id}`,
  },
  BRANCHES: {
    LIST: '/branches',
    CREATE: '/branches',
    UPDATE: (id: string) => `/branches/${id}`,
    DELETE: (id: string) => `/branches/${id}`,
  },
  ACADEMIC: {
    YEARS: '/academic/years',
    BATCHES: '/academic/batches',
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
    GET: (id: string) => `/subjects/${id}`,
    UPDATE: (id: string) => `/subjects/${id}`,
    DELETE: (id: string) => `/subjects/${id}`,
  },
  /**
   * Subject offerings — the per-semester assignment of a subject to a
   * branch under a scheme. A subject is a catalogue entry; an offering is
   * the statement "this subject is taught to this branch in this semester".
   */
  SUBJECT_OFFERINGS: {
    LIST: '/subject-offerings',
    CREATE: '/subject-offerings',
    GET: (id: string) => `/subject-offerings/${id}`,
    DELETE: (id: string) => `/subject-offerings/${id}`,
  },
  /**
   * Subject-to-teacher allocations.
   *
   * The backend exposes `DELETE /teacher-allocations/:id`, so the id is
   * interpolated rather than passed as a query parameter.
   */
  TEACHER_ALLOCATIONS: {
    LIST: '/teacher-allocations',
    CREATE: '/teacher-allocations',
    DELETE: (id: string) => `/teacher-allocations/${id}`,
  },
  /**
   * Class-teacher assignments — exactly one class teacher per class
   * (branch + semester + scheme + academic year).
   */
  CLASS_TEACHER_ASSIGNMENTS: {
    LIST: '/class-teacher-assignments',
    CREATE: '/class-teacher-assignments',
    DELETE: (id: string) => `/class-teacher-assignments/${id}`,
  },
  STUDENTS: {
    LIST: '/students',
    CREATE: '/students',
    BULK_IMPORT: '/students/bulk-import',
    BULK_IMPORT_FILE: '/students/bulk-import/file',
    GET: (id: string) => `/students/${id}`,
    UPDATE: (id: string) => `/students/${id}`,
    DELETE: (id: string) => `/students/${id}`,
    /**
     * The signed-in student's own record, result and class leaderboard.
     *
     * These resolve the student from the session, so there is no id in the
     * path and no way to widen the window from the client (§3.7).
     */
    MY_RESULT: '/students/my-result',
    MY_TOPPERS: '/students/my-toppers',
    MY_STUDENT: '/students/my/student',
    /**
     * Provisions a login for a student the exam cell has just created.
     */
    PROVISION_LOGIN: (id: string) => `/students/${id}/provision-login`,
  },
  MARKS: {
    LIST: '/marks',
    CREATE_BULK: '/marks/bulk',
    UPDATE: (id: string) => `/marks/${id}`,
    CALCULATE: (studentId: string) => `/marks/calculate/${studentId}`,
  },
  UPLOAD: {
    CREATE: '/upload',
    UPLOAD_FILE: '/upload/file',
    GET_JOB: (jobId: string) => `/upload/jobs/${jobId}`,
    CONFIRM: (jobId: string) => `/upload/jobs/${jobId}/confirm`,
    JOBS: '/upload/jobs',
  },
  REPORTS: {
    GENERATE: '/reports',
    LIST: '/reports',
    GET: (id: string) => `/reports/${id}`,
    DOWNLOAD: (id: string) => `/reports/${id}/download`,
  },
  TOPPERS: {
    SUBJECT_WISE: '/toppers/subject-wise',
    CLASS: '/toppers/class',
  },
  ANALYTICS: {
    OVERVIEW: '/analytics/overview',
    PASS_FAIL: '/analytics/pass-fail',
    SUBJECT_DIFFICULTY: '/analytics/subject-difficulty',
    PERFORMANCE_TRENDS: '/analytics/performance-trends',
  },
  DASHBOARD: {
    GET: '/dashboard',
    /**
     * The dashboard is fetched in independent parts so one slow block — the
     * chart sections — never delays the page chrome or the KPI cards.
     */
    HEADER: '/dashboard/header',
    METRICS: '/dashboard/metrics',
    SECTIONS: '/dashboard/sections',
    RECENT_UPLOADS: '/dashboard/recent-uploads',
  },
  AUDIT_LOGS: {
    LIST: '/audit-logs',
    /**
     * The distinct actions, resources and users in the trail, so the filter
     * dropdowns never have to be built by paging through the whole log.
     */
    FACETS: '/audit-logs/facets',
    DETAIL: (id: string) => `/audit-logs/${id}`,
  },
} as const;