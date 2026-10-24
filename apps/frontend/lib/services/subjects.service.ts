import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';

export interface Subject {
  id: string;
  branchId: string;
  schemeId: string;
  semester: number;
  code: string;
  name: string;
  credits: number;
  maxMarks: number;
}

interface ListResponse<T> {
  data: T[];
  meta?: { total: number; page: number; pageSize: number };
}

export interface SubjectListFilters {
  branchId?: string;
  schemeId?: string;
  semester?: number;
}

export const subjectsService = {
  list: async (filters?: SubjectListFilters): Promise<ListResponse<Subject>> => {
    const res = await apiClient.get(ENDPOINTS.SUBJECTS.LIST, { params: filters });
    return res.data.data;
  },
  create: async (payload: Omit<Subject, 'id'>) => {
    const res = await apiClient.post(ENDPOINTS.SUBJECTS.CREATE, payload);
    return res.data.data;
  },
  update: async (id: string, payload: Partial<Omit<Subject, 'id'>>) => {
    const res = await apiClient.patch(ENDPOINTS.SUBJECTS.UPDATE(id), payload);
    return res.data.data;
  },
  delete: async (id: string) => {
    await apiClient.delete(ENDPOINTS.SUBJECTS.DELETE(id));
  },
};