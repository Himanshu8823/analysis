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
    /**
     * The signed-in user's own profile. These are scoped to the session —
     * there is no id in the path, so the client cannot address another
     * member's account.
     */
    PROFILE: '/auth/profile',
    PROFILE_AVATAR: '/auth/profile/avatar',
  },
  USERS: {
    GET: (id: string) => `/users/${id}`,
    UPDATE: (id: string) => `/users/${id}`,
    DELETE: (id: string) => `/users/${id}`,
    MEMBERS: '/users/members',
    ROLES: '/users/roles',
    /**
     * What revoking this member would do.
     *
     * Called before the confirmation is shown, so the administrator sees the
     * consequences — the allocations released, the classes that lose their
     * teacher — before committing to the change.
     */
    REVOCATION_IMPACT: (id: string) => `/users/${id}/revocation-impact`,
    /**
     * Restores a revoked member's account.
     *
     * Their allocations and roles are not restored automatically — they were
     * released deliberately, and the administrator re-applies them by hand.
     */
    RESTORE: (id: string) => `/users/${id}/restore`,
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
  /**
   * The roles a member holds.
   *
   * Assigning and taking back a role are the most consequential things in
   * the system, so they go through their own endpoints rather than being
   * an edit to the member record — the change is audited and the
   * permission cache is invalidated on the member's very next request.
   */
  USER_ROLES: {
    LIST: (userId: string) => `/user-roles/${userId}`,
    ASSIGN: '/user-roles',
    REVOKE: '/user-roles',
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
    /**
     * Creates an academic year.
     *
     * The dates are what the system uses to work out which year is running.
     */
    CREATE_YEAR: '/academic/years',
    /**
     * Makes an academic year the running one.
     */
    ACTIVATE_YEAR: (id: string) => `/academic/years/${id}/activate`,
    /**
     * The academic structure — branches, years, semesters, subjects,
     * teachers and how ready each class is.
     */
    STRUCTURE: '/academic/structure',
  },
  SCHEMES: {
    LIST: '/schemes',
    CREATE: '/schemes',
    GET: (id: string) => `/schemes/${id}`,
    UPDATE: (id: string) => `/schemes/${id}`,
  },
  /**
   * The scheme reader — reading a syllabus PDF into reviewable subjects.
   *
   * The flow is deliberately three steps: read the document, let a human
   * check what came back, then write it. The sample document is public,
   * because a reference file cannot be privileged — anyone may look at a
   * published university syllabus.
   */
  SCHEME_READER: {
    /** Whether automatic reading is available on this system. */
    AVAILABILITY: '/scheme-reader/availability',
    /** Uploads a PDF and reads it into courses, in one call. */
    READ_FILE: '/scheme-reader/read-file',
    /** Writes the reviewed courses as subjects. */
    CONFIRM: '/scheme-reader/confirm',
    /** The sample syllabus PDF — served as a download. */
    SAMPLE: '/scheme-reader/sample',
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
    /**
     * The teachers assignable in a branch — a narrower read than the member
     * list, which carries every account in the college.
     */
    ASSIGNABLE_TEACHERS: '/teacher-allocations/assignable-teachers',
  },
  /**
   * Class-teacher assignments — exactly one class teacher per class
   * (branch + semester + scheme + academic year).
   */
  CLASS_TEACHER_ASSIGNMENTS: {
    LIST: '/class-teacher-assignments',
    CREATE: '/class-teacher-assignments',
    DELETE: (id: string) => `/class-teacher-assignments/${id}`,
    /**
     * The classes that have students but no class teacher.
     *
     * This is the "class teacher required" state — it is what keeps the gap
     * visible after a member is revoked.
     */
    NEEDS_TEACHER: '/class-teacher-assignments/needs-teacher',
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
     *
     * The paths have **no** `/students` prefix: the server's own
     * `MyResultController` sits at the root, because these routes are the
     * student's own record rather than a part of the roster. Calling
     * `/students/my-result` would fall through to the roster's
     * `GET /students/:id` and be refused — the student's own result would
     * never load.
     */
    MY_RESULT: '/my-result',
    MY_TOPPERS: '/my-toppers',
    MY_STUDENT: '/my/student',
    /**
     * Provisions a login for a student the exam cell has just created.
     */
    PROVISION_LOGIN: (id: string) => `/students/${id}/provision-login`,
    /**
     * The student's whole profile.
     *
     * The server decides what the caller receives: a section they may not
     * read is absent from the payload, not present and empty.
     */
    PROFILE: (id: string) => `/students/${id}/profile`,
    /**
     * Provisions logins for a whole class, or for a selected set.
     */
    BULK_PROVISION_LOGINS: '/students/bulk-provision-logins',
  },
  MARKS: {
    LIST: '/marks',
    CREATE_BULK: '/marks/bulk',
    UPDATE: (id: string) => `/marks/${id}`,
    CALCULATE: (studentId: string) => `/marks/calculate/${studentId}`,
    /**
     * The examination cell's correction of a mark a teacher holds.
     *
     * A correction is a different operation from an ordinary entry: it
     * needs a reason, and the mark it replaces is kept on record.
     */
    CORRECT: '/marks/correct',
  },
  UPLOAD: {
    CREATE: '/upload',
    UPLOAD_FILE: '/upload/file',
    GET_JOB: (jobId: string) => `/upload/jobs/${jobId}`,
    CONFIRM: (jobId: string) => `/upload/jobs/${jobId}/confirm`,
    JOBS: '/upload/jobs',
  },
  EXAMINATIONS: {
    LIST: '/examinations',
    GET: (id: string) => `/examinations/${id}`,
    CREATE: '/examinations',
    /**
     * Publishes a class's result.
     *
     * The server refuses it unless every student's result is in.
     */
    PUBLISH: (id: string) => `/examinations/${id}/publish`,
    /**
     * Returns a published result to being worked on.
     */
    UNPUBLISH: (id: string) => `/examinations/${id}/publish`,
  },
  REPORTS: {
    GENERATE: '/reports',
    LIST: '/reports',
    GET: (id: string) => `/reports/${id}`,
    DOWNLOAD: (id: string) => `/reports/${id}/download`,
    /**
     * Archives a report.
     *
     * The report is not deleted — it is a statement about a class's results,
     * and the record is kept with the reason it was archived.
     */
    DELETE: (id: string) => `/reports/${id}`,
    /**
     * Whether a class's result is complete enough to report on.
     *
     * The scope travels as query parameters here — the check is a read, and
     * it needs the same branch / scheme / semester / year the report would
     * be generated for.
     */
    READINESS: '/reports/readiness',
  },
  /**
   * The class overview of the signed-in class teacher.
   *
   * These resolve the class from the session, so there is no branch,
   * semester or teacher id in the path — a member can only read the classes
   * they are the class teacher of.
   */
  CLASS_OVERVIEW: {
    LIST: '/class-overview',
    DETAIL: (assignmentId: string) => `/class-overview/${assignmentId}`,
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