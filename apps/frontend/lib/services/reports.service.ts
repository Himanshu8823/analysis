import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import type { ListResponse } from '@/lib/types/api';

/** Matches the backend Report.status values (see prisma/schema.prisma). */
export type ReportStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export type ReportType =
  | 'STUDENT_WISE'
  | 'SCHEME_WISE'
  | 'SUBJECT_ANALYSIS'
  | 'STUDENT_ANALYSIS'
  | 'CLASS_TOPPERS'
  | 'PASS_FAIL'
  | 'COMPLETE';

export interface Report {
  id: string;
  generatedBy: string;
  type: ReportType;
  filters: Record<string, unknown>;
  fileUrl?: string | null;
  status: ReportStatus;
  errorMessage?: string | null;
  createdAt: string;
  completedAt?: string | null;
}

/**
 * The backend expects `{ type, filters }` — every scope field belongs inside
 * `filters`, and the report kind is `type` (not `reportType`).
 */
export interface GenerateReportPayload {
  type: ReportType;
  filters: {
    branchId?: string;
    schemeId?: string;
    semester?: number;
    academicYearId?: string;
    [key: string]: unknown;
  };
}

export interface ReportListFilters {
  page?: number;
  pageSize?: number;
}

export const reportsService = {
  generate: async (payload: GenerateReportPayload): Promise<Report> => {
    const res = await apiClient.post(ENDPOINTS.REPORTS.GENERATE, payload);
    return res.data.data;
  },
  list: async (filters?: ReportListFilters): Promise<ListResponse<Report>> => {
    const res = await apiClient.get(ENDPOINTS.REPORTS.LIST, { params: filters });
    return res.data.data;
  },
  get: async (id: string): Promise<Report> => {
    const res = await apiClient.get(ENDPOINTS.REPORTS.GET(id));
    return res.data.data;
  },
  download: async (id: string): Promise<Blob> => {
    const res = await apiClient.get(ENDPOINTS.REPORTS.DOWNLOAD(id), {
      responseType: 'blob',
    });
    return res.data;
  },
};
