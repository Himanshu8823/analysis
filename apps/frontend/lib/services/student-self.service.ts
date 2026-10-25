import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';

/**
 * One mark entry — a subject component, the way a marksheet shows it.
 */
export interface MyResultSubject {
  subjectCode: string;
  subjectName: string;
  credits: number;
  /** The component: `CA1`, `CA2`, `MID_SEM`, `WRITTEN`, `PRACTICAL`, … */
  examType: string;
  marksObtained: number;
  maxMarks: number;
  isAbsent: boolean;
  isWithheld: boolean;
}

export interface MyResultTotals {
  totalMarks: number;
  totalMaxMarks: number;
  percentage: number;
  creditsEarned: number;
  totalCredits: number;
  isPass: boolean;
  failedSubjects: Array<{ subjectCode: string; subjectName: string; reason: string }>;
}

export interface MyResult {
  student: {
    id: string;
    rollNo: string;
    name: string;
    branch: string;
    semester: number;
    /** The year of study (1, 2, 3, 4). */
    year: number;
    scheme: string;
    academicYear: string;
  };
  examination: {
    name: string;
    status: string;
    resultPublishedAt: string | null;
  };
  marks: MyResultSubject[];
  totals: MyResultTotals;
}

export interface MyToppers {
  class: {
    branch: string;
    semester: number;
    scheme: string;
    academicYear: string;
  };
  toppers: Array<{
    rank: number;
    studentId: string;
    rollNo: string;
    name: string;
    totalMarks: number;
    maxTotalMarks: number;
    percentage: number;
    creditsEarned: number;
  }>;
}

export const studentSelfService = {
  /**
   * The signed-in student's own result.
   *
   * The student is resolved from the session on the server, so there is no
   * id to pass and no way to read somebody else's marksheet.
   */
  getMyResult: async (): Promise<MyResult> => {
    const res = await apiClient.get(ENDPOINTS.STUDENTS.MY_RESULT);
    return res.data.data;
  },

  /** The leaderboard of the signed-in student's own class. */
  getMyToppers: async (limit?: number): Promise<MyToppers> => {
    const res = await apiClient.get(ENDPOINTS.STUDENTS.MY_TOPPERS, {
      params: limit ? { limit } : undefined,
    });
    return res.data.data;
  },
};
