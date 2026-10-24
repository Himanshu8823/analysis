import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';

export interface TopperEntry {
  studentId: string;
  rollNo: string;
  name: string;
  marksObtained: number;
  maxMarks: number;
  percentage: number;
  rank: number;
  isTied?: boolean;
}

export interface SubjectTopper {
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  toppers: TopperEntry[];
}

export interface ClassTopper {
  studentId: string;
  rollNo: string;
  name: string;
  totalMarks: number;
  totalMaxMarks: number;
  percentage: number;
  rank: number;
  isTied?: boolean;
}

export interface SubjectTopperFilters {
  branchId?: string;
  schemeId?: string;
  semester?: number;
}

export interface ClassTopperFilters extends SubjectTopperFilters {
  rankingRule?: 'TOTAL_MARKS' | 'PERCENTAGE' | 'CREDITS';
}

export const toppersService = {
  subjectToppers: async (filters: SubjectTopperFilters): Promise<{ data: SubjectTopper[] }> => {
    const params: Record<string, string> = {};
    if (filters.branchId) params.branchId = filters.branchId;
    if (filters.schemeId) params.schemeId = filters.schemeId;
    if (filters.semester) params.semester = String(filters.semester);
    const res = await apiClient.get(ENDPOINTS.TOPPERS.SUBJECT_WISE(params));
    return res.data.data;
  },
  classToppers: async (filters: ClassTopperFilters): Promise<{ data: ClassTopper[] }> => {
    const params: Record<string, string> = {};
    if (filters.branchId) params.branchId = filters.branchId;
    if (filters.schemeId) params.schemeId = filters.schemeId;
    if (filters.semester) params.semester = String(filters.semester);
    if (filters.rankingRule) params.rankingRule = filters.rankingRule;
    const res = await apiClient.get(ENDPOINTS.TOPPERS.CLASS(params));
    return res.data.data;
  },
};