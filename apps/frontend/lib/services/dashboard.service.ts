import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';

export interface DashboardKpi {
  label: string;
  value: number | string;
  delta?: number;
  unit?: string;
}

export interface RecentUpload {
  id: string;
  fileName: string;
  status: string;
  createdAt: string;
}

/**
 * How far the dashboard reaches.
 *
 * - `college` — the whole institution
 * - `branch`  — one branch
 * - `class`   — the caller's allocated subjects and classes
 * - `own`     — the signed-in student's own result
 */
export type DashboardScope = 'college' | 'branch' | 'class' | 'own';

export type DashboardTrend = 'up' | 'down' | 'flat';

export type DashboardSectionKind = 'bar' | 'list' | 'donut';

/** One KPI card. */
export interface DashboardMetric {
  key: string;
  label: string;
  value: number | string;
  hint?: string;
  trend?: DashboardTrend;
}

/** One entry in a chart section. */
export interface DashboardSectionItem {
  label: string;
  value: number;
  secondary?: string;
}

/** One chart block on the dashboard. */
export interface DashboardSection {
  key: string;
  title: string;
  kind: DashboardSectionKind;
  items: DashboardSectionItem[];
}

export interface DashboardData {
  kpis: {
    totalStudents: number;
    passPercentage: number;
    totalSubjects: number;
    averagePercentage: number;
  };
  recentUploads: RecentUpload[];
  academicYear: { id: string; year: string } | null;
  /**
   * The scope the figures were computed against. The backend decides this
   * from the caller's effective permissions.
   */
  scope?: DashboardScope;
  /** Human-readable description of the scope, e.g. a branch name. */
  scopeLabel?: string;
  /** The caller's roles, comma-joined. */
  roleLabel?: string;
  /** KPI cards, in render order. */
  metrics?: DashboardMetric[];
  /** Chart blocks, in render order. */
  sections?: DashboardSection[];
  /**
   * Optional data sources that were unavailable while the response was built
   * — for example `result-publication-status` when the `examinations` table has
   * not been migrated yet.
   */
  degraded?: string[];
}

export const dashboardService = {
  getDashboard: async (): Promise<DashboardData> => {
    const res = await apiClient.get(ENDPOINTS.DASHBOARD.GET);
    return res.data.data;
  },
};
