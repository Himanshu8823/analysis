import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';

export type ReportStatus = 'PENDING' | 'GENERATING' | 'READY' | 'FAILED';

export interface Report {
  id: string;
  name: string;
  status: ReportStatus;
  generatedAt?: string;
  downloadUrl?: string;
  fileSize?: number;
  filters?: Record<string, unknown>;
}

export interface GenerateReportPayload {
  branchId: string;
  schemeId: string;
  semester: number;
  reportType: 'STUDENT_WISE' | 'SCHEME_WISE' | 'SUBJECT_ANALYSIS' | 'CLASS_TOPPERS' | 'PASS_FAIL';
  name?: string;
}

export const reportsService = {
  generate: async (payload: GenerateReportPayload): Promise<Report> => {
    const res = await apiClient.post(ENDPOINTS.REPORTS.GENERATE, payload);
    return res.data.data;
  },
  list: async (): Promise<{ data: Report[] }> => {
    const res = await apiClient.get(ENDPOINTS.REPORTS.LIST);
    return res.data.data;
  },
  get: async (id: string): Promise<Report> => {
    const res = await apiClient.get(`/reports/${id}`);
    return res.data.data;
  },
  download: async (id: string): Promise<Blob> => {
    const res = await apiClient.get(ENDPOINTS.REPORTS.DOWNLOAD(id), {
      responseType: 'blob',
    });
    return res.data;
  },
};