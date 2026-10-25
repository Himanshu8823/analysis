/**
 * The wire contract for `GET /dashboard`.
 *
 * The dashboard is rendered from a single generic card grid, so the backend
 * returns *data* (labels, values, chart sections) rather than a role-specific
 * payload shape. The frontend never needs to know which role produced a
 * response — it renders whatever `metrics` and `sections` it is given.
 */

/**
 * How far the dashboard reaches.
 *
 * - `college` — the whole institution (Super Admin, Exam Cell Admin, Principal)
 * - `branch`  — one branch (HOD)
 * - `class`   — one or more assigned classes (Teacher)
 * - `own`     — the signed-in student only
 */
export type DashboardScopeKind = 'college' | 'branch' | 'class' | 'own';

/** Direction of a metric relative to the previous comparable period. */
export type DashboardTrend = 'up' | 'down' | 'flat';

/**
 * One KPI card.
 *
 * `value` is a number for quantitative metrics and a string for ones that are
 * inherently textual (a ratio rendered as `"3 / 5"`, a status word).
 */
export interface DashboardMetric {
  key: string;
  label: string;
  value: number | string;
  /** Short supporting sentence shown under the value. */
  hint?: string;
  trend?: DashboardTrend;
}

/** How a section's `items` should be drawn. */
export type DashboardSectionKind = 'bar' | 'list' | 'donut';

/** One entry in a chart section. */
export interface DashboardSectionItem {
  label: string;
  value: number;
  /** Optional qualifier — a percentage, a status word, a secondary count. */
  secondary?: string;
}

/** One chart block on the dashboard. */
export interface DashboardSection {
  key: string;
  title: string;
  kind: DashboardSectionKind;
  items: DashboardSectionItem[];
}

/**
 * The full dashboard payload.
 *
 * `kpis`, `recentUploads` and `academicYear` are the legacy fields. They are
 * kept so the existing frontend page and any other consumer keep working
 * unchanged; new consumers should read `metrics` and `sections`.
 */
export interface DashboardResponse {
  /** The scope the figures were computed against. */
  scope: DashboardScopeKind;
  /** Human-readable label for the scope, e.g. `"Computer Science & Engineering"`. */
  scopeLabel: string;
  /** The caller's roles, comma-joined — e.g. `"HOD, TEACHER"`. */
  roleLabel: string;
  /** The active academic year the figures belong to. */
  academicYear: { id: string; year: string } | null;
  /** KPI cards, in render order. */
  metrics: DashboardMetric[];
  /** Chart blocks, in render order. */
  sections: DashboardSection[];
  /** Legacy flat KPI set — mirrors the four original cards. */
  kpis: {
    totalStudents: number;
    passPercentage: number;
    totalSubjects: number;
    averagePercentage: number;
  };
  /** Legacy recent-uploads list. */
  recentUploads: DashboardUpload[];
  /**
   * Which optional data sources were unavailable while this response was
   * built. Populated when a feature-flagged table (e.g. `examinations`) is not
   * migrated yet, so the UI can say so instead of showing a misleading zero.
   */
  degraded: string[];
}

export interface DashboardUpload {
  id: string;
  fileName: string;
  status: string;
  createdAt: string;
  /** Who raised the upload — the member's name and email. */
  uploadedBy?: { id: string; email: string; name: string } | null;
}

/**
 * The scope block alone.
 *
 * `GET /dashboard/header` returns just this, so the page chrome (title,
 * description, upload action) can render before any of the heavier figures
 * have been computed.
 */
export interface DashboardHeader {
  scope: DashboardScopeKind;
  scopeLabel: string;
  roleLabel: string;
  academicYear: { id: string; year: string } | null;
}

/** `GET /dashboard/metrics` — the KPI cards and their legacy mirrors. */
export interface DashboardMetricsResponse {
  metrics: DashboardMetric[];
  kpis: DashboardResponse['kpis'];
}

/** `GET /dashboard/sections` — the chart blocks and any degraded sources. */
export interface DashboardSectionsResponse {
  sections: DashboardSection[];
  degraded: string[];
}

/** `GET /dashboard/recent-uploads` — the latest upload jobs. */
export interface DashboardUploadsResponse {
  recentUploads: DashboardUpload[];
}

/**
 * The identity the dashboard is computed for.
 *
 * Resolved once per request from the database rather than from the JWT, because
 * the token only carries the *primary* role while the effective capability set
 * is the union of every role the member holds (§3.1).
 */
export interface DashboardViewer {
  userId: string;
  /** Every role the member holds, uppercase, de-duplicated. */
  roles: string[];
  /** Effective permission names across all roles. */
  permissions: string[];
  /** Branch ids this member is scoped to. Empty means "no branch scope". */
  branchIds: string[];
  /** The student record linked to this account, if any. */
  studentId?: string;
}
