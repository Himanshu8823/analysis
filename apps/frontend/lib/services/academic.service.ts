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
  /**
   * Creates an academic year.
   *
   * The dates matter: the system works out which year is running by
   * comparing today's date against them, so a year with the wrong dates
   * makes every default in the app wrong.
   */
  createYear: async (payload: {
    year: string;
    startDate: string;
    endDate: string;
    isActive?: boolean;
  }): Promise<AcademicYear> => {
    const res = await apiClient.post(ENDPOINTS.ACADEMIC.CREATE_YEAR, payload);
    return res.data.data;
  },
  /**
   * Makes an academic year the running one.
   *
   * Exactly one year runs at a time — making a year the running one
   * retires the previous one.
   */
  activateYear: async (id: string): Promise<AcademicYear> => {
    const res = await apiClient.post(ENDPOINTS.ACADEMIC.ACTIVATE_YEAR(id));
    return res.data.data;
  },
  batches: async (admissionYearId?: string): Promise<Batch[]> => {
    const res = await apiClient.get(ENDPOINTS.ACADEMIC.BATCHES, {
      params: admissionYearId ? { admissionYearId } : undefined,
    });
    return res.data.data;
  },
};
