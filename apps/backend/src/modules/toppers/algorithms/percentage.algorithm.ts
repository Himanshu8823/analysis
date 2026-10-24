import type { TopperAlgorithm, RankerInput, RankedStudent } from './base.algorithm';

/**
 * Rank students by overall percentage (ties broken by earned credits first,
 * then total marks obtained, then roll number for stability).
 */
export class PercentageAlgorithm implements TopperAlgorithm {
  readonly name = 'percentage';

  rank(input: RankerInput): RankedStudent[] {
    const ordered = [...input.summaries.values()].sort((a, b) => {
      if (b.percentage !== a.percentage) return b.percentage - a.percentage;
      if (b.earnedCredits !== a.earnedCredits) {
        return b.earnedCredits - a.earnedCredits;
      }
      if (b.totalObtained !== a.totalObtained) {
        return b.totalObtained - a.totalObtained;
      }
      return a.rollNo.localeCompare(b.rollNo);
    });

    return ordered.map((s, idx) => ({
      rank: idx + 1,
      studentId: s.studentId,
      rollNo: s.rollNo,
      name: s.name,
      score: Number(s.percentage.toFixed(2)),
      percentage: Number(s.percentage.toFixed(2)),
      isTie: idx > 0 && s.percentage === ordered[idx - 1]!.percentage,
    }));
  }
}
