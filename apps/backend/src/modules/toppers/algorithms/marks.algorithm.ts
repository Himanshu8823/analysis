import type { TopperAlgorithm, RankedStudent } from './base.algorithm';
import type { RankerInput } from './base.algorithm';

/**
 * Rank students by total marks obtained (raw sum, not normalised). Falls back
 * to percentage when two students have the same total.
 */
export class MarksAlgorithm implements TopperAlgorithm {
  readonly name = 'marks';

  rank(input: RankerInput): RankedStudent[] {
    const ordered = [...input.summaries.values()].sort((a, b) => {
      if (b.totalObtained !== a.totalObtained) {
        return b.totalObtained - a.totalObtained;
      }
      if (b.percentage !== a.percentage) return b.percentage - a.percentage;
      return a.rollNo.localeCompare(b.rollNo);
    });

    return ordered.map((s, idx) => ({
      rank: idx + 1,
      studentId: s.studentId,
      rollNo: s.rollNo,
      name: s.name,
      score: s.totalObtained,
      percentage: Number(s.percentage.toFixed(2)),
      isTie: idx > 0 && s.totalObtained === ordered[idx - 1]!.totalObtained,
    }));
  }
}
