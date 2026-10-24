import type { Student, Mark, Subject } from '@prisma/client';

/**
 * Pre-aggregated per-student evaluation summary that ranking strategies
 * operate on. The MarksService fills these in once per request; algorithms
 * stay pure and testable.
 */
export interface StudentSummary {
  studentId: string;
  rollNo: string;
  name: string;
  totalObtained: number;
  totalMax: number;
  percentage: number;
  earnedCredits: number;
  totalCredits: number;
  isOverallPass: boolean;
  passCount: number;
  subjectCount: number;
}

/**
 * Final ranked row returned by an algorithm.
 */
export interface RankedStudent {
  rank: number;
  studentId: string;
  rollNo: string;
  name: string;
  score: number;
  percentage: number;
  isTie: boolean;
}

/**
 * Inputs to a ranking operation. Algorithms are free to use as much or
 * as little of this as required; they MUST return rows in the order they
 * would appear on the leaderboard (best first).
 */
export interface RankerInput {
  students: Student[];
  marks: Mark[];
  subjects: Subject[];
  summaries: Map<string, StudentSummary>;
}

export interface TopperAlgorithm {
  readonly name: string;
  rank(input: RankerInput): RankedStudent[];
}
