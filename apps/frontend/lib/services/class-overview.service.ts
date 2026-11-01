import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';

/**
 * A class the signed-in member is the class teacher of.
 *
 * The id is the class-teacher assignment id — the class is addressed by the
 * member's own assignment, never by a branch and semester, so a class they
 * do not teach cannot be requested from the client.
 */
export interface MyClass {
  id: string;
  branchId: string;
  branchCode: string;
  branchName: string;
  semester: number;
  schemeId: string;
  schemeName: string;
  academicYearId: string;
  academicYearLabel: string;
  studentCount: number;
}

/**
 * The headline numbers of a class.
 */
export interface ClassStats {
  studentCount: number;
  subjectCount: number;
  averagePercentage: number;
  highestPercentage: number;
  lowestPercentage: number;
  studentsWithFullMarks: number;
  studentsWithoutAnyMarks: number;
  studentsWithMissingMarks: number;
  passedCount: number;
  failedCount: number;
}

/**
 * One student's standing in the class.
 */
export interface ClassStudent {
  id: string;
  rollNo: string;
  name: string;
  currentYear: number;
  semester: number;
  totalMarks: number;
  maxTotalMarks: number;
  percentage: number;
  subjectsWithMarks: number;
  /** The subject codes this student has no mark for. */
  missingSubjects: string[];
  /** The subject codes this student scored below the passing mark in. */
  failedSubjects: string[];
}

/**
 * The standing of one subject across the class.
 */
export interface ClassSubjectSummary {
  subjectOfferingId: string;
  subjectCode: string;
  subjectName: string;
  studentsWithMarks: number;
  averagePercentage: number;
  highestMarks: number;
  highestScorerName: string | null;
  highestScorerRollNo: string | null;
  passCount: number;
}

/**
 * The full overview of a class.
 */
export interface ClassOverview {
  class: MyClass;
  stats: ClassStats;
  subjects: ClassSubjectSummary[];
  students: ClassStudent[];
}

export const classOverviewService = {
  /**
   * The classes the signed-in member is the class teacher of.
   *
   * An empty array means the member is not a class teacher — a valid state
   * the page renders as such.
   */
  listMyClasses: async (): Promise<MyClass[]> => {
    const res = await apiClient.get(ENDPOINTS.CLASS_OVERVIEW.LIST);
    return res.data.data;
  },

  /** The overview of one of the signed-in member's classes. */
  getClassOverview: async (assignmentId: string): Promise<ClassOverview> => {
    const res = await apiClient.get(ENDPOINTS.CLASS_OVERVIEW.DETAIL(assignmentId));
    return res.data.data;
  },
};
