import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';

export interface Mark {
  id: string;
  studentId: string;
  subjectId: string;
  examType: 'INTERNAL' | 'EXTERNAL' | 'PRACTICAL';
  marksObtained: number;
  maxMarks: number;
  isAbsent: boolean;
}

interface ListResponse<T> {
  data: T[];
  meta?: { total: number; page: number; pageSize: number };
}

export interface MarkListFilters {
  studentId?: string;
  subjectId?: string;
  examType?: string;
}

export interface BulkMarkInput {
  studentId: string;
  subjectId: string;
  examType: 'INTERNAL' | 'EXTERNAL' | 'PRACTICAL';
  marksObtained: number;
  maxMarks: number;
  isAbsent?: boolean;
}

export interface CalculationResult {
  studentId: string;
  totalMarks: number;
  totalMaxMarks: number;
  percentage: number;
  creditsEarned: number;
  status: 'PASS' | 'FAIL' | 'WITHELD';
}

export const marksService = {
  list: async (filters?: MarkListFilters): Promise<ListResponse<Mark>> => {
    const res = await apiClient.get(ENDPOINTS.MARKS.LIST, { params: filters });
    return res.data.data;
  },
  createBulk: async (marks: BulkMarkInput[]) => {
    const res = await apiClient.post(ENDPOINTS.MARKS.CREATE_BULK, { marks });
    return res.data.data;
  },
  update: async (id: string, payload: Partial<BulkMarkInput>) => {
    const res = await apiClient.patch(ENDPOINTS.MARKS.UPDATE(id), payload);
    return res.data.data;
  },
  calculate: async (payload: { studentId: string; schemeId: string }): Promise<CalculationResult> => {
    const res = await apiClient.post(ENDPOINTS.MARKS.CALCULATE, payload);
    return res.data.data;
  },
};