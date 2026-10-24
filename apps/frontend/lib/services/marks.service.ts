import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';

/** The exam types the backend accepts (see `CreateMarkDto.EXAM_TYPES`). */
export type ExamType = 'CA1' | 'CA2' | 'MID_SEM' | 'WRITTEN' | 'PRACTICAL' | 'ORAL';

export interface Mark {
  id: string;
  studentId: string;
  subjectId: string;
  examType: ExamType;
  marksObtained: number;
  maxMarks: number;
  isAbsent: boolean;
  isWithheld: boolean;
  academicYearId: string;
  remarks?: string | null;
}

export interface MarkListFilters {
  studentId?: string;
  subjectId?: string;
  examType?: string;
  academicYearId?: string;
}

export interface BulkMarkInput {
  studentId: string;
  subjectId: string;
  examType: ExamType;
  marksObtained: number;
  maxMarks: number;
  isAbsent?: boolean;
  isWithheld?: boolean;
  academicYearId: string;
  remarks?: string;
}

/**
 * The backend's scheme-aware calculator result.
 *
 * Field names mirror `StudentCalculationResult` in
 * `apps/backend/src/modules/marks/calculator/scheme-calculator.interface.ts`.
 */
export interface SubjectCalculationResult {
  subjectId: string;
  breakdown: Array<{
    type: string;
    obtained: number;
    max: number;
    isAbsent: boolean;
  }>;
  totalObtained: number;
  totalMax: number;
  percentage: number;
  isPass: boolean;
  reason: string;
}

export interface CalculationResult {
  subjectResults: SubjectCalculationResult[];
  totalObtained: number;
  totalMax: number;
  overallPercentage: number;
  totalCredits: number;
  earnedCredits: number;
  isOverallPass: boolean;
  subjectCount: number;
  passCount: number;
}

/** `GET /marks/calculate/class` — the whole class in one response. */
export interface ClassCalculationResult {
  schemeName: string;
  results: Array<{
    studentId: string;
    rollNo: string;
    name: string;
    result: CalculationResult;
  }>;
}

export const marksService = {
  /** The backend returns a plain array for marks (no pagination). */
  list: async (filters?: MarkListFilters): Promise<Mark[]> => {
    const res = await apiClient.get(ENDPOINTS.MARKS.LIST, { params: filters });
    return res.data.data;
  },
  createBulk: async (marks: BulkMarkInput[]) => {
    const res = await apiClient.post(ENDPOINTS.MARKS.CREATE_BULK, { marks });
    return res.data.data;
  },
  /** The backend exposes `PUT /marks/:id`, not `PATCH`. */
  update: async (
    id: string,
    payload: Partial<Omit<BulkMarkInput, 'studentId' | 'subjectId' | 'examType' | 'academicYearId'>>,
  ) => {
    const res = await apiClient.put(ENDPOINTS.MARKS.UPDATE(id), payload);
    return res.data.data;
  },
  /**
   * The backend exposes the calculation as a GET on
   * `/marks/calculate/:studentId` with the academic year as a query param.
   */
  calculate: async (params: {
    studentId: string;
    academicYearId: string;
  }): Promise<CalculationResult> => {
    const res = await apiClient.get(ENDPOINTS.MARKS.CALCULATE(params.studentId), {
      params: { academicYearId: params.academicYearId },
    });
    return res.data.data;
  },
};
