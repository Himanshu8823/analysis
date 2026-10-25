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
    /** The subject offering these marks belong to. */
    subjectOfferingId: string;
    /** The subject behind the offering, for display. */
    subjectId: string;
    subjectCode: string;
    subjectName: string;
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
 * One subject as it runs in a particular class context.
 *
 * A subject on its own is just a template — "CS301 is worth 100 marks". The
 * offering is what makes it concrete: "CS301 runs for CSE in semester 5", and
 * that is the unit marks hang off.
 */
export interface SubjectOfferingContext {
  /** The offering id — marks reference this. */
  id: string;
  semester: number;
  /** The subject behind the offering. */
  subject: Subject;
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
    subject: Subject
  ): ComponentValidation;

  /**
   * Calculate the result for a single subject offering for a student.
   */
  calculateSubjectResult(marks: Mark[], subject: Subject): SubjectCalculationResult;

  /**
   * Calculate the aggregate result over the supplied subject offerings.
   */
  calculateStudentResult(
    studentId: string,
    marks: Mark[],
    offerings: SubjectOfferingContext[]
  ): StudentCalculationResult;
}
