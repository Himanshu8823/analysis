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

export interface DashboardData {
  kpis: {
    totalStudents: number;
    passPercentage: number;
    totalSubjects: number;
    averagePercentage: number;
  };
  recentUploads: RecentUpload[];
  academicYear: { id: string; year: string } | null;
}

export const dashboardService = {
  getDashboard: async (): Promise<DashboardData> => {
    const res = await apiClient.get(ENDPOINTS.DASHBOARD.GET);
    return res.data.data;
  },
};
