import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';

export interface AcademicYear {
  id: string;
  year: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

export interface Batch {
  id: string;
  name: string;
  admissionYearId: string;
  isActive: boolean;
}

export const academicService = {
  /** The backend returns a plain array for academic years (no pagination). */
  years: async (): Promise<AcademicYear[]> => {
    const res = await apiClient.get(ENDPOINTS.ACADEMIC.YEARS);
    return res.data.data;
  },
  batches: async (admissionYearId?: string): Promise<Batch[]> => {
    const res = await apiClient.get(ENDPOINTS.ACADEMIC.BATCHES, {
      params: admissionYearId ? { admissionYearId } : undefined,
    });
    return res.data.data;
  },
};
