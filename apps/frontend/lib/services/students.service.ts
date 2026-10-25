import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import type { ListResponse } from '@/lib/types/api';

export interface Student {
  id: string;
  rollNo: string;
  name: string;
  branchId: string;
  schemeId: string;
  /** The DTO field is `currentYear` — `year` is rejected by the backend. */
  currentYear: number;
  semester: number;
  batchId: string;
  academicYearId: string;
  isActive?: boolean;
}

export interface StudentListFilters {
  branchId?: string;
  schemeId?: string;
  semester?: number;
  academicYearId?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface BulkImportResult {
  inserted: number;
  failed: number;
  errors?: Array<{ row: number; error: string }>;
}

/** The scope applied to every row of an imported file. */
export interface BulkImportScope {
  branchId?: string;
  schemeId?: string;
  batchId?: string;
  academicYearId?: string;
  currentYear?: number;
  semester?: number;
}

export interface BulkImportRow {
  rollNo: string;
  name: string;
  branchId?: string;
  schemeId?: string;
  batchId?: string;
  academicYearId?: string;
  currentYear?: number;
  semester?: number;
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
  /** The backend exposes `PUT /students/:id`, not `PATCH`. */
  update: async (id: string, payload: Partial<Omit<Student, 'id'>>) => {
    const res = await apiClient.put(ENDPOINTS.STUDENTS.UPDATE(id), payload);
    return res.data.data;
  },
  delete: async (id: string) => {
    await apiClient.delete(ENDPOINTS.STUDENTS.DELETE(id));
  },
  /** Imports students from JSON rows — the scope may be sent per row or once. */
  bulkImport: async (
    rows: BulkImportRow[],
    scope?: BulkImportScope,
  ): Promise<BulkImportResult> => {
    const res = await apiClient.post(ENDPOINTS.STUDENTS.BULK_IMPORT, {
      rows,
      ...scope,
    });
    return res.data.data;
  },
  /**
   * Imports students from an uploaded CSV or Excel sheet. The scope travels as
   * query parameters because a multipart body cannot carry nested JSON.
   */
  bulkImportFile: async (
    file: File,
    scope?: BulkImportScope,
  ): Promise<BulkImportResult> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await apiClient.post(ENDPOINTS.STUDENTS.BULK_IMPORT_FILE, formData, {
      params: scope,
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.data;
  },
};
