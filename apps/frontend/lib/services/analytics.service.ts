import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';

export interface AnalyticsFilters {
  branchId?: string;
  schemeId?: string;
  semester?: number;
  academicYearId?: string;
}

export interface OverviewStats {
  totalStudents: number;
  totalSubjects: number;
  totalMarks: number;
  overallPassPercentage: number;
  averagePercentage: number;
}

export interface PassFailStats {
  totalStudents: number;
  passCount: number;
  failCount: number;
  passPercentage: number;
  failPercentage: number;
  distinction: number;
  firstClass: number;
  secondClass: number;
  atktCount: number;
}

export interface SubjectDifficulty {
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  totalStudents: number;
  averageMarks: number;
  averagePercentage: number;
  maxMarks: number;
  minMarks: number;
  passCount: number;
  failCount: number;
  passPercentage: number;
  difficulty: 'Easy' | 'Moderate' | 'Hard';
}

export interface PerformanceTrendPoint {
  academicYearId: string;
  year: string;
  averagePercentage: number;
  passPercentage: number;
  studentCount: number;
}

export const analyticsService = {
  overview: async (filters?: AnalyticsFilters): Promise<OverviewStats> => {
    const res = await apiClient.get(ENDPOINTS.ANALYTICS.OVERVIEW, { params: filters });
    return res.data.data;
  },
  passFail: async (filters?: AnalyticsFilters): Promise<PassFailStats> => {
    const res = await apiClient.get(ENDPOINTS.ANALYTICS.PASS_FAIL, { params: filters });
    return res.data.data;
  },
  subjectDifficulty: async (filters?: AnalyticsFilters): Promise<SubjectDifficulty[]> => {
    const res = await apiClient.get(ENDPOINTS.ANALYTICS.SUBJECT_DIFFICULTY, { params: filters });
    return res.data.data;
  },
  performanceTrends: async (filters?: AnalyticsFilters): Promise<PerformanceTrendPoint[]> => {
    const res = await apiClient.get(ENDPOINTS.ANALYTICS.PERFORMANCE_TRENDS, { params: filters });
    return res.data.data;
  },
};
