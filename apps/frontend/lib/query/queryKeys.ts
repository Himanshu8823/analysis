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
    /** The members holding the TEACHER role, narrowed to a branch. */
    teachers: (branchId?: string) => ['members', 'teachers', branchId ?? null] as const,
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
  },
  /**
   * Class-teacher assignments — one class teacher per class context.
   */
  classTeacherAssignments: {
    all: () => ['class-teacher-assignments'] as const,
    list: (filters?: unknown) =>
      ['class-teacher-assignments', 'list', filters ?? null] as const,
  },
  students: {
    all: () => ['students'] as const,
    list: (filters?: unknown) => ['students', 'list', filters ?? null] as const,
    detail: (id: string) => ['students', 'detail', id] as const,
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
    jobsList: () => ['upload', 'jobs'] as const,
  },
  reports: {
    all: () => ['reports'] as const,
    list: (filters?: unknown) => ['reports', 'list', filters ?? null] as const,
    detail: (id: string) => ['reports', 'detail', id] as const,
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
} as const;