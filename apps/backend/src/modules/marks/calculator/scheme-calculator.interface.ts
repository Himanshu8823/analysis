import type { Mark, Subject } from '@prisma/client';

/**
 * Breakdown of an individual subject's component scores.
 */
export interface SubjectBreakdown {
  type: string;
  obtained: number;
  max: number;
  isAbsent: boolean;
}

/**
 * Result of validating that all required components for a subject are present.
 */
export interface ComponentValidation {
  isValid: boolean;
  details: Record<string, unknown>;
}

/**
 * Common shape returned for a single subject's calculation.
 */
export interface SubjectCalculationResult {
  breakdown: SubjectBreakdown[];
  totalObtained: number;
  totalMax: number;
  percentage: number;
  isPass: boolean;
  reason: string;
}

/**
 * Common shape returned for a full student's result over all subjects.
 */
export interface StudentCalculationResult {
  subjectResults: Array<{
    subjectId: string;
    breakdown: SubjectBreakdown[];
    totalObtained: number;
    totalMax: number;
    percentage: number;
    isPass: boolean;
    reason: string;
  }>;
  totalObtained: number;
  totalMax: number;
  overallPercentage: number;
  totalCredits: number;
  earnedCredits: number;
  isOverallPass: boolean;
  subjectCount: number;
  passCount: number;
}

/**
 * Contract every scheme-aware calculator must implement.
 * Concrete strategies live in scheme-{2019,2022,2024}.calculator.ts.
 */
export interface ISchemeCalculator {
  readonly schemeName: string;

  /**
   * Confirm that the supplied components include all those required by the scheme
   * for the given subject.
   */
  validateComponents(
    components: Array<{ type: string; marksObtained: number; maxMarks: number }>,
    subject: Subject,
  ): ComponentValidation;

  /**
   * Calculate the result for a single subject for a student.
   */
  calculateSubjectResult(marks: Mark[], subject: Subject): SubjectCalculationResult;

  /**
   * Calculate the aggregate result over the supplied subjects.
   */
  calculateStudentResult(
    studentId: string,
    marks: Mark[],
    subjects: Subject[],
  ): StudentCalculationResult;
}
