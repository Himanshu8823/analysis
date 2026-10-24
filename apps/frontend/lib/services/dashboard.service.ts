import { apiClient } from '@/lib/api/client';

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
}

export const dashboardService = {
  getDashboard: async (): Promise<DashboardData> => {
    const res = await apiClient.get('/dashboard');
    return res.data.data;
  },
};