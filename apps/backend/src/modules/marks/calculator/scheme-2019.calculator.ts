import { Injectable } from '@nestjs/common';
import type { Mark, Subject } from '@prisma/client';
import type {
  ComponentValidation,
  ISchemeCalculator,
  SubjectBreakdown,
  SubjectCalculationResult,
  StudentCalculationResult,
} from './scheme-calculator.interface';

/** DBATU 2019 scheme thresholds */
const INTERNAL_COMPONENTS = ['CA1', 'CA2', 'MID_SEM'] as const;
const INTERNAL_MIN = 30; // 30/60 = 50% of internal total (CA1+CA2+MidSem)
const WRITTEN_MIN = 45; // 45/100 = 45% of external theory
const PRACTICAL_MIN = 10; // 10/25 = 40% of practical
const AGGREGATE_MIN_PERCENT = 50;
const CA_MIN = 6;
const MID_SEM_MIN = 8;

/**
 * DBATU SCHEME_2019 marks calculator.
 *
 * Pass criteria (subject):
 *  - Each CA must be >=6/20
 *  - Mid-Sem must be >=8/20
 *  - Internal total (CA1+CA2+Mid) >=30/60
 *  - External theory >=45/100
 *  - Practical (if applicable) >=10/25
 *  - Aggregate (Internal + External) >=50%
 */
@Injectable()
export class Scheme2019Calculator implements ISchemeCalculator {
  readonly schemeName = 'SCHEME_2019';

  validateComponents(
    components: Array<{ type: string; marksObtained: number; maxMarks: number }>,
    subject: Subject,
  ): ComponentValidation {
    const issues: string[] = [];
    const config = subject.components as { required?: string[] } | null;
    const required: string[] = config?.required ?? [
      'CA1',
      'CA2',
      'MID_SEM',
      'WRITTEN',
    ];

    for (const req of required) {
      if (!components.find((c) => c.type === req)) {
        issues.push(`Missing component: ${req}`);
      }
    }

    return {
      isValid: issues.length === 0,
      details: { issues, required },
    };
  }

  calculateSubjectResult(marks: Mark[], subject: Subject): SubjectCalculationResult {
    const breakdown: SubjectBreakdown[] = marks.map((m) => ({
      type: m.examType,
      obtained: m.isAbsent ? 0 : m.marksObtained,
      max: m.maxMarks,
      isAbsent: m.isAbsent,
    }));

    const totalObtained = marks.reduce(
      (sum, m) => sum + (m.isAbsent ? 0 : m.marksObtained),
      0,
    );
    const totalMax = marks.reduce((sum, m) => sum + m.maxMarks, 0);
    const percentage = totalMax > 0 ? (totalObtained / totalMax) * 100 : 0;

    const internal = marks.filter((m) => INTERNAL_COMPONENTS.includes(m.examType as never));
    const written = marks.find((m) => m.examType === 'WRITTEN');
    const practical = marks.find((m) => m.examType === 'PRACTICAL');

    const internalMarks = internal.reduce(
      (sum, m) => sum + (m.isAbsent ? 0 : m.marksObtained),
      0,
    );

    const ca1 = marks.find((m) => m.examType === 'CA1');
    const ca2 = marks.find((m) => m.examType === 'CA2');
    const midSem = marks.find((m) => m.examType === 'MID_SEM');

    const reasons: string[] = [];
    if (ca1 && !ca1.isAbsent && ca1.marksObtained < CA_MIN) {
      reasons.push(`CA1 below minimum ${CA_MIN}`);
    }
    if (ca2 && !ca2.isAbsent && ca2.marksObtained < CA_MIN) {
      reasons.push(`CA2 below minimum ${CA_MIN}`);
    }
    if (midSem && !midSem.isAbsent && midSem.marksObtained < MID_SEM_MIN) {
      reasons.push(`Mid-Sem below minimum ${MID_SEM_MIN}`);
    }
    if (practical && !practical.isAbsent && practical.marksObtained < PRACTICAL_MIN) {
      reasons.push(`Practical below minimum ${PRACTICAL_MIN}`);
    }

    const internalPass = internalMarks >= INTERNAL_MIN;
    const externalPass = written
      ? !written.isAbsent && written.marksObtained >= WRITTEN_MIN
      : true;
    const aggregatePass = percentage >= AGGREGATE_MIN_PERCENT;

    const isPass =
      internalPass && externalPass && aggregatePass && reasons.length === 0;
    const reason = isPass
      ? 'Pass'
      : reasons.length > 0
        ? reasons.join('; ')
        : 'Fail';

    return {
      breakdown,
      totalObtained,
      totalMax,
      percentage,
      isPass,
      reason,
    };
  }

  calculateStudentResult(
    _studentId: string,
    marks: Mark[],
    subjects: Subject[],
  ): StudentCalculationResult {
    const subjectResults = subjects.map((subject) => {
      const subjectMarks = marks.filter((m) => m.subjectId === subject.id);
      return {
        subjectId: subject.id,
        ...this.calculateSubjectResult(subjectMarks, subject),
      };
    });

    const totalObtained = subjectResults.reduce((s, r) => s + r.totalObtained, 0);
    const totalMax = subjectResults.reduce((s, r) => s + r.totalMax, 0);
    const overallPercentage =
      totalMax > 0 ? (totalObtained / totalMax) * 100 : 0;

    const earnedCredits = subjects.reduce((sum, sub) => {
      const r = subjectResults.find((x) => x.subjectId === sub.id);
      return sum + (r?.isPass ? sub.credits : 0);
    }, 0);
    const totalCredits = subjects.reduce((sum, sub) => sum + sub.credits, 0);

    const passCount = subjectResults.filter((r) => r.isPass).length;
    const isOverallPass = passCount === subjects.length && subjects.length > 0;

    return {
      subjectResults,
      totalObtained,
      totalMax,
      overallPercentage,
      totalCredits,
      earnedCredits,
      isOverallPass,
      subjectCount: subjects.length,
      passCount,
    };
  }
}
