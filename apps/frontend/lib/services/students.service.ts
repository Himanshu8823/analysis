import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';

export interface Student {
  id: string;
  rollNo: string;
  name: string;
  branchId: string;
  schemeId: string;
  year: number;
  semester: number;
  batchId?: string;
}

interface ListResponse<T> {
  data: T[];
  meta?: { total: number; page: number; pageSize: number };
}

export interface StudentListFilters {
  branchId?: string;
  schemeId?: string;
  semester?: number;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface BulkImportResult {
  inserted: number;
  failed: number;
  errors?: Array<{ row: number; error: string }>;
}

export const studentsService = {
  list: async (filters?: StudentListFilters): Promise<ListResponse<Student>> => {
    const res = await apiClient.get(ENDPOINTS.STUDENTS.LIST, { params: filters });
    return res.data.data;
  },
  get: async (id: string): Promise<Student> => {
    const res = await apiClient.get(ENDPOINTS.STUDENTS.GET(id));
    return res.data.data;
  },
  create: async (payload: Omit<Student, 'id'>) => {
    const res = await apiClient.post(ENDPOINTS.STUDENTS.CREATE, payload);
    return res.data.data;
  },
  update: async (id: string, payload: Partial<Omit<Student, 'id'>>) => {
    const res = await apiClient.patch(ENDPOINTS.STUDENTS.UPDATE(id), payload);
    return res.data.data;
  },
  delete: async (id: string) => {
    await apiClient.delete(ENDPOINTS.STUDENTS.DELETE(id));
  },
  bulkImport: async (file: File): Promise<BulkImportResult> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await apiClient.post(ENDPOINTS.STUDENTS.BULK_IMPORT, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.data;
  },
};