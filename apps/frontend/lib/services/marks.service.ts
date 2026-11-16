import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';

/** The exam types the backend accepts (see `CreateMarkDto.EXAM_TYPES`). */
export type ExamType = 'CA1' | 'CA2' | 'MID_SEM' | 'WRITTEN' | 'PRACTICAL' | 'ORAL';

export interface Mark {
  id: string;
  studentId: string;
  /**
   * The subject *offering* the mark belongs to — the subject as it runs in
   * one branch, semester and scheme.
   */
  subjectOfferingId: string;
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
  subjectOfferingId?: string;
  examType?: string;
  academicYearId?: string;
}

export interface BulkMarkInput {
  studentId: string;
  /**
   * The subject offering id — the backend validates `subjectOfferingId`, not
   * `subjectId`. The same subject is offered in several semesters, and each
   * offering has its own class of students, so the offering is the unit a
   * mark belongs to.
   */
  subjectOfferingId: string;
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
  /**
   * Writes a batch of marks.
   *
   * A whole class is one request — a teacher's sheet for forty students
   * across eight subjects is three hundred and twenty rows, and each one is
   * an upsert. The client waits longer than it does for an ordinary call,
   * because a timeout half-way through would leave the member unable to
   * tell which rows were saved.
   *
   * The server refuses the batch **whole** if any row is not allowed, so a
   * long wait never ends with a partly-written class.
   */
  createBulk: async (marks: BulkMarkInput[]) => {
    const res = await apiClient.post(
      ENDPOINTS.MARKS.CREATE_BULK,
      { marks },
      { timeout: 120_000 }
    );
    return res.data.data;
  },
  /** The backend exposes `PUT /marks/:id`, not `PATCH`. */
  update: async (
    id: string,
    payload: Partial<
      Omit<
        BulkMarkInput,
        'studentId' | 'subjectOfferingId' | 'examType' | 'academicYearId'
      >
    >,
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
  /**
   * The examination cell's correction of a mark a teacher holds.
   *
   * The reason is not optional: the backend refuses a correction without
   * one, and the reason is what makes the change explainable later.
   */
  correct: async (payload: BulkMarkInput & { reason: string }) => {
    const res = await apiClient.post(ENDPOINTS.MARKS.CORRECT, payload);
    return res.data.data;
  },
};
