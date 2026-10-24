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
  },
  invites: {
    all: () => ['invites'] as const,
    list: (filters?: unknown) => ['invites', 'list', filters ?? null] as const,
    counts: () => ['invites', 'counts'] as const,
    validate: (token: string) => ['invites', 'validate', token] as const,
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
    byBranchSchemeSem: (branchId: string, schemeId: string, sem: number) =>
      ['subjects', 'list', { branchId, schemeId, semester: sem }] as const,
  },
  students: {
    all: () => ['students'] as const,
    list: (filters?: unknown) => ['students', 'list', filters ?? null] as const,
    detail: (id: string) => ['students', 'detail', id] as const,
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
    list: () => ['reports', 'list'] as const,
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
  },
} as const;