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

/**
 * The scope a report is generated for.
 */
export interface ReportScope {
  branchId: string;
  schemeId: string;
  semester: number;
  academicYearId: string;
}

/**
 * Whether a class's result is complete enough to report on.
 *
 * The report cannot be generated until every student has a result in every
 * subject — a report states a verdict for the whole class, so it must not
 * be produced while some of it is still pending.
 */
export interface ReportReadiness {
  isReady: boolean;
  studentCount: number;
  completeCount: number;
  pendingCount: number;
  pendingSubjects: Array<{
    subjectCode: string;
    subjectName: string;
    missingCount: number;
  }>;
  pendingStudents: Array<{
    rollNo: string;
    name: string;
    missingSubjects: string[];
  }>;
  message: string;
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
  /**
   * Whether the class's result is complete enough to report on.
   */
  checkReadiness: async (scope: ReportScope): Promise<ReportReadiness> => {
    const res = await apiClient.get(ENDPOINTS.REPORTS.READINESS, { params: scope });
    return res.data.data;
  },
};
