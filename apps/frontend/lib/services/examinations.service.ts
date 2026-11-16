import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';

/**
 * Where a class's result stands.
 *
 * The lifecycle: `PENDING` (marks still coming in) → `PROCESSING` (the
 * result is being worked on) → `PUBLISHED` (the result is the college's
 * answer).
 */
export type ExaminationStatus = 'PENDING' | 'PROCESSING' | 'PUBLISHED' | 'FAILED';

export interface Examination {
  id: string;
  name: string;
  branchId: string;
  branchName: string;
  semester: number;
  schemeId: string;
  schemeName: string;
  academicYearId: string;
  academicYear: string;
  examDate: string;
  status: ExaminationStatus;
  resultPublishedAt: string | null;
  /** How many students are in the class. */
  studentCount: number;
  /** How many of them have a complete result. */
  completeCount: number;
  /** Whether every student's result is in — the condition for publishing. */
  isReady: boolean;
}

export interface ExaminationFilters {
  branchId?: string;
  semester?: number;
  academicYearId?: string;
}

/** The body `POST /examinations` accepts. */
export interface CreateExaminationPayload {
  name: string;
  branchId: string;
  semester: number;
  schemeId: string;
  academicYearId: string;
  examDate: string;
}

export const examinationsService = {
  list: async (filters?: ExaminationFilters): Promise<Examination[]> => {
    const res = await apiClient.get(ENDPOINTS.EXAMINATIONS.LIST, { params: filters });
    return res.data.data;
  },

  get: async (id: string): Promise<Examination> => {
    const res = await apiClient.get(ENDPOINTS.EXAMINATIONS.GET(id));
    return res.data.data;
  },

  create: async (payload: CreateExaminationPayload): Promise<Examination> => {
    const res = await apiClient.post(ENDPOINTS.EXAMINATIONS.CREATE, payload);
    return res.data.data;
  },

  /**
   * Publishes a class's result.
   *
   * The server refuses it unless every student's result is in — so this
   * call can fail with a message naming how many students are missing.
   */
  publish: async (id: string): Promise<Examination> => {
    const res = await apiClient.post(ENDPOINTS.EXAMINATIONS.PUBLISH(id));
    return res.data.data;
  },

  /**
   * Returns a published result to being worked on.
   *
   * For the case where a mark was found to be wrong after the result went
   * out. The marks are not changed by this — a correction is a separate
   * act — but the result stops being the college's answer while it is
   * fixed.
   */
  unpublish: async (id: string): Promise<Examination> => {
    const res = await apiClient.delete(ENDPOINTS.EXAMINATIONS.UNPUBLISH(id));
    return res.data.data;
  },
};
