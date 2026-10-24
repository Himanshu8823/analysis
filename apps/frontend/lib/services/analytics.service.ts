import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';

export interface AnalyticsFilters {
  branchId?: string;
  schemeId?: string;
  semester?: number;
}

export interface OverviewStats {
  totalStudents: number;
  passPercentage: number;
  totalSubjects: number;
  averagePercentage: number;
  totalMarks?: number;
}

export interface PassFailBucket {
  status: 'PASS' | 'FAIL' | 'WITHELD';
  count: number;
  percentage: number;
}

export interface SubjectDifficulty {
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  averagePercentage: number;
  passCount: number;
  failCount: number;
}

export interface PerformanceTrendPoint {
  month: string;
  averagePercentage: number;
  passPercentage: number;
}

export const analyticsService = {
  overview: async (filters?: AnalyticsFilters): Promise<OverviewStats> => {
    const res = await apiClient.get(ENDPOINTS.ANALYTICS.OVERVIEW, { params: filters });
    return res.data.data;
  },
  passFail: async (filters?: AnalyticsFilters): Promise<{ data: PassFailBucket[] }> => {
    const res = await apiClient.get(ENDPOINTS.ANALYTICS.PASS_FAIL, { params: filters });
    return res.data.data;
  },
  subjectDifficulty: async (filters?: AnalyticsFilters): Promise<{ data: SubjectDifficulty[] }> => {
    const res = await apiClient.get(ENDPOINTS.ANALYTICS.SUBJECT_DIFFICULTY, { params: filters });
    return res.data.data;
  },
  performanceTrends: async (filters?: AnalyticsFilters): Promise<{ data: PerformanceTrendPoint[] }> => {
    const res = await apiClient.get(ENDPOINTS.ANALYTICS.PERFORMANCE_TRENDS, { params: filters });
    return res.data.data;
  },
};