import type { TopperAlgorithm, RankedStudent } from './base.algorithm';
import type { RankerInput } from './base.algorithm';

/**
 * Rank students by earned credits first (a proxy for "passed more subjects"),
 * then break ties by overall percentage.
 */
export class CreditsAlgorithm implements TopperAlgorithm {
  readonly name = 'credits';

  rank(input: RankerInput): RankedStudent[] {
    const ordered = [...input.summaries.values()].sort((a, b) => {
      if (b.earnedCredits !== a.earnedCredits) {
        return b.earnedCredits - a.earnedCredits;
      }
      if (b.percentage !== a.percentage) return b.percentage - a.percentage;
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
      score: s.earnedCredits,
      percentage: Number(s.percentage.toFixed(2)),
      isTie: idx > 0 && s.earnedCredits === ordered[idx - 1]!.earnedCredits,
    }));
  }
}
