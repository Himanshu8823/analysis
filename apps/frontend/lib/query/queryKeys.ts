// Centralized query keys for proper invalidation.
// Each filter-accepting factory takes `unknown` to remain compatible with
// domain-specific filter types (which don't include an index signature).
export const queryKeys = {
  auth: {
    me: () => ['auth', 'me'] as const,
  },
  members: {
    all: () => ['members'] as const,
    list: (filters?: unknown) => ['members', 'list', filters ?? null] as const,
    detail: (id: string) => ['members', 'detail', id] as const,
    roles: () => ['members', 'roles'] as const,
    /**
     * What revoking this member would do.
     *
     * A separate key from the member's detail, because it is a *preview* of
     * a change rather than the member's record — and because it goes stale
     * as soon as the member's allocations change.
     */
    revocationImpact: (id: string) => ['members', 'revocation-impact', id] as const,
  },
  /**
   * The roles a member holds.
   *
   * A separate key from `members.detail`: the member record carries the
   * role names, while this carries the role *rows* — which branch each role
   * is scoped to, and when it was granted. Invalidating one must not throw
   * away the other, because they are read by different screens.
   */
  userRoles: {
    all: () => ['user-roles'] as const,
    list: (userId: string) => ['user-roles', 'list', userId] as const,
  },
  invites: {
    all: () => ['invites'] as const,
    list: (filters?: unknown) => ['invites', 'list', filters ?? null] as const,
    counts: () => ['invites', 'counts'] as const,
    validate: (token: string) => ['invites', 'validate', token] as const,
  },
  roles: {
    all: () => ['roles'] as const,
    list: () => ['roles', 'list'] as const,
    detail: (id: string) => ['roles', 'detail', id] as const,
    permissions: (id: string) => ['roles', 'permissions', id] as const,
  },
  permissions: {
    all: () => ['permissions'] as const,
    list: () => ['permissions', 'list'] as const,
    detail: (id: string) => ['permissions', 'detail', id] as const,
  },
  branches: {
    all: () => ['branches'] as const,
    list: () => ['branches', 'list'] as const,
  },
  academic: {
    all: () => ['academic'] as const,
    years: () => ['academic', 'years'] as const,
    batches: (admissionYearId?: string) =>
      ['academic', 'batches', admissionYearId ?? null] as const,
  },
  schemes: {
    all: () => ['schemes'] as const,
    list: () => ['schemes', 'list'] as const,
    detail: (id: string) => ['schemes', 'detail', id] as const,
  },
  /**
   * The scheme reader.
   *
   * Only the availability is cached. A *reading* is not: it is a one-off
   * look at a document, and the review screen holds the corrections to it
   * in its own state, so a cached reading could only ever be a stale one.
   */
  schemeReader: {
    all: () => ['scheme-reader'] as const,
    availability: () => ['scheme-reader', 'availability'] as const,
  },
  subjects: {
    all: () => ['subjects'] as const,
    list: (filters?: unknown) => ['subjects', 'list', filters ?? null] as const,
    detail: (id: string) => ['subjects', 'detail', id] as const,
    byBranchSchemeSem: (branchId: string, schemeId: string, sem: number) =>
      ['subjects', 'list', { branchId, schemeId, semester: sem }] as const,
    /** The subject offerings — a subject as taught in one class context. */
    offerings: (filters?: unknown) => ['subjects', 'offerings', filters ?? null] as const,
  },
  /**
   * Subject-to-teacher allocations.
   *
   * The list key embeds the active filters (branch / semester / academic
   * year), so invalidation has to target the `list` prefix rather than the
   * bare `all` prefix.
   */
  teacherAllocations: {
    all: () => ['teacher-allocations'] as const,
    list: (filters?: unknown) => ['teacher-allocations', 'list', filters ?? null] as const,
    /**
     * The subject offerings as the allocation picker needs them.
     *
     * A separate key from `subjects.offerings`: this one holds the
     * normalised, picker-shaped rows, and sharing a cache slot with the
     * catalogue's offering view would let one hook read the other's rows.
     */
    offeringOptions: (filters?: unknown) =>
      ['teacher-allocations', 'offering-options', filters ?? null] as const,
    /**
     * The teachers assignable in a branch.
     *
     * A separate key from `members.teachers`: the two hold different shapes
     * — this one carries no roles or permissions — and the member list is no
     * longer what the allocation picker reads.
     */
    assignableTeachers: (branchId?: string) =>
      ['teacher-allocations', 'assignable-teachers', branchId ?? null] as const,
  },
  /**
   * Class-teacher assignments — one class teacher per class context.
   */
  classTeacherAssignments: {
    all: () => ['class-teacher-assignments'] as const,
    list: (filters?: unknown) =>
      ['class-teacher-assignments', 'list', filters ?? null] as const,
    /**
     * The classes that have students but no class teacher.
     *
     * A separate key from the assignment list, because it is a different
     * question — and because invalidating the assignments must also refresh
     * the gap they leave behind.
     */
    needsTeacher: (filters?: unknown) =>
      ['class-teacher-assignments', 'needs-teacher', filters ?? null] as const,
  },
  students: {
    all: () => ['students'] as const,
    list: (filters?: unknown) => ['students', 'list', filters ?? null] as const,
    detail: (id: string) => ['students', 'detail', id] as const,
    /**
     * The student's whole profile.
     *
     * It is a separate key from the plain detail because it is a different
     * payload with a different cache lifetime: the profile carries marks,
     * results and an audit trail, and it changes far less often than the
     * roster does.
     */
    profile: (id: string) => ['students', 'profile', id] as const,
    /**
     * The signed-in student's own result and class leaderboard.
     *
     * These are separate keys from the roster ones because they are scoped to
     * the session, not to a filter — invalidating the roster must not throw
     * away the student's own marksheet, and vice versa.
     */
    myResult: () => ['students', 'my-result'] as const,
    myToppers: (limit?: number) => ['students', 'my-toppers', limit ?? null] as const,
  },
  marks: {
    all: () => ['marks'] as const,
    list: (filters?: unknown) => ['marks', 'list', filters ?? null] as const,
    byStudent: (studentId: string) => ['marks', 'student', studentId] as const,
  },
  upload: {
    all: () => ['upload'] as const,
    job: (jobId: string) => ['upload', 'job', jobId] as const,
    /**
     * The upload history. The filters are part of the key, so switching a
     * filter does not serve the previous filter's rows.
     */
    jobsList: (filters?: unknown) => ['upload', 'jobs', filters ?? null] as const,
  },
  reports: {
    all: () => ['reports'] as const,
    list: (filters?: unknown) => ['reports', 'list', filters ?? null] as const,
    detail: (id: string) => ['reports', 'detail', id] as const,
    /**
     * Whether a class's result is complete enough to report on.
     *
     * The scope is part of the key, so switching the scope refetches.
     */
    readiness: (scope?: unknown) => ['reports', 'readiness', scope ?? null] as const,
  },
  /**
   * The class overview of the signed-in class teacher.
   *
   * The keys are scoped to the session, so they are separate from the
   * roster and topper keys: invalidating those must not throw away the
   * class teacher's own class view.
   */
  classOverview: {
    all: () => ['class-overview'] as const,
    myClasses: () => ['class-overview', 'my-classes'] as const,
    detail: (assignmentId: string) => ['class-overview', 'detail', assignmentId] as const,
  },
  toppers: {
    subjectWise: (filters?: unknown) => ['toppers', 'subject', filters ?? null] as const,
    class: (filters?: unknown) => ['toppers', 'class', filters ?? null] as const,
  },
  analytics: {
    overview: (filters?: unknown) => ['analytics', 'overview', filters ?? null] as const,
    passFail: (filters?: unknown) => ['analytics', 'pass-fail', filters ?? null] as const,
    subjectDifficulty: (filters?: unknown) =>
      ['analytics', 'subject-difficulty', filters ?? null] as const,
    performanceTrends: (filters?: unknown) =>
      ['analytics', 'performance-trends', filters ?? null] as const,
  },
  dashboard: {
    all: () => ['dashboard'] as const,
    get: () => ['dashboard', 'get'] as const,
    /**
     * One key per block. Each block is fetched and cached independently, so a
     * slow chart query cannot invalidate or delay the KPI row.
     */
    header: () => ['dashboard', 'header'] as const,
    metrics: () => ['dashboard', 'metrics'] as const,
    sections: () => ['dashboard', 'sections'] as const,
    recentUploads: () => ['dashboard', 'recent-uploads'] as const,
  },
  auditLogs: {
    all: () => ['audit-logs'] as const,
    /** The filters are part of the key, so changing one refetches. */
    list: (filters?: unknown) => ['audit-logs', 'list', filters ?? null] as const,
    facets: () => ['audit-logs', 'facets'] as const,
    detail: (id: string) => ['audit-logs', 'detail', id] as const,
  },
} as const;