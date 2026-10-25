import { Injectable } from '@nestjs/common';
import type { Mark, Subject } from '@prisma/client';
import type {
  ComponentValidation,
  ISchemeCalculator,
  SubjectBreakdown,
  SubjectCalculationResult,
  SubjectOfferingContext,
  StudentCalculationResult,
} from './scheme-calculator.interface';

/** DBATU 2024 scheme thresholds */
const INTERNAL_2024_MAX = 40; // CT1 15 + Mid 15 + Quiz 10
const EXTERNAL_2024_MAX = 60;
const PRACTICAL_2024_MAX = 25;
const INTERNAL_MIN_2024 = 20; // 50% of 40
const EXTERNAL_MIN_2024 = 30; // 50% of 60
const PRACTICAL_MIN_2024 = 13; // ~50% of 25
const AGGREGATE_MIN_2024 = 50;

const INTERNAL_COMPONENT_TYPES = ['CT1', 'CT2', 'MID_SEM', 'QUIZ'] as const;

/**
 * DBATU SCHEME_2024 marks calculator.
 *
 * Subject structure (typical theory subject):
 *  - Theory 100:
 *      Internal (40) = CT1 (15) + Mid-Sem (15) + Quiz (10)
 *      External (60) = Written examination
 *  - Practical: 25 marks, evaluated separately.
 *
 * Pass criteria:
 *  - Aggregate >=50%
 *  - Internal >=20/40
 *  - External >=30/60
 *  - Practical (if applicable) >=13/25
 */
@Injectable()
export class Scheme2024Calculator implements ISchemeCalculator {
  readonly schemeName = 'SCHEME_2024';

  validateComponents(
    components: Array<{ type: string; marksObtained: number; maxMarks: number }>,
    subject: Subject
  ): ComponentValidation {
    const issues: string[] = [];
    const config = subject.components as { hasTheory?: boolean; hasPractical?: boolean } | null;
    const hasTheory = config?.hasTheory ?? true;
    const hasPractical = config?.hasPractical ?? false;

    if (
      hasTheory &&
      !components.find((c) => (INTERNAL_COMPONENT_TYPES as readonly string[]).includes(c.type))
    ) {
      issues.push('Missing internal components (CT/Mid/Quiz)');
    }
    if (hasTheory && !components.find((c) => c.type === 'WRITTEN' || c.type === 'EXTERNAL')) {
      issues.push('Missing external (theory) component');
    }
    if (hasPractical && !components.find((c) => c.type === 'PRACTICAL')) {
      issues.push('Missing practical component');
    }

    return {
      isValid: issues.length === 0,
      details: { issues },
    };
  }

  calculateSubjectResult(marks: Mark[], _subject: Subject): SubjectCalculationResult {
    const breakdown: SubjectBreakdown[] = marks.map((m) => ({
      type: m.examType,
      obtained: m.isAbsent ? 0 : m.marksObtained,
      max: m.maxMarks,
      isAbsent: m.isAbsent,
    }));

    const totalObtained = marks.reduce((sum, m) => sum + (m.isAbsent ? 0 : m.marksObtained), 0);
    const totalMax = marks.reduce((sum, m) => sum + m.maxMarks, 0);
    const percentage = totalMax > 0 ? (totalObtained / totalMax) * 100 : 0;

    const internalMarks = marks
      .filter((m) => (INTERNAL_COMPONENT_TYPES as readonly string[]).includes(m.examType))
      .reduce((sum, m) => sum + (m.isAbsent ? 0 : m.marksObtained), 0);

    const written = marks.find((m) => m.examType === 'WRITTEN' || m.examType === 'EXTERNAL');
    const practical = marks.find((m) => m.examType === 'PRACTICAL');

    const reasons: string[] = [];

    if (written && !written.isAbsent && written.marksObtained < EXTERNAL_MIN_2024) {
      reasons.push(`External below ${EXTERNAL_MIN_2024}/${EXTERNAL_2024_MAX}`);
    }
    if (practical && !practical.isAbsent && practical.marksObtained < PRACTICAL_MIN_2024) {
      reasons.push(`Practical below ${PRACTICAL_MIN_2024}/${PRACTICAL_2024_MAX}`);
    }
    if (internalMarks < INTERNAL_MIN_2024) {
      reasons.push(`Internal below ${INTERNAL_MIN_2024}/${INTERNAL_2024_MAX}`);
    }

    const aggregatePass = percentage >= AGGREGATE_MIN_2024;
    const isPass = reasons.length === 0 && aggregatePass;

    return {
      breakdown,
      totalObtained,
      totalMax,
      percentage,
      isPass,
      reason: isPass ? 'Pass' : reasons.join('; ') || 'Fail',
    };
  }

  calculateStudentResult(
    _studentId: string,
    marks: Mark[],
    offerings: SubjectOfferingContext[]
  ): StudentCalculationResult {
    const subjectResults = offerings.map((offering) => {
      const subjectMarks = marks.filter((m) => m.subjectOfferingId === offering.id);
      return {
        subjectOfferingId: offering.id,
        subjectId: offering.subject.id,
        subjectCode: offering.subject.code,
        subjectName: offering.subject.name,
        ...this.calculateSubjectResult(subjectMarks, offering.subject),
      };
    });

    const totalObtained = subjectResults.reduce((s, r) => s + r.totalObtained, 0);
    const totalMax = subjectResults.reduce((s, r) => s + r.totalMax, 0);
    const overallPercentage = totalMax > 0 ? (totalObtained / totalMax) * 100 : 0;

    const earnedCredits = offerings.reduce((sum, offering) => {
      const r = subjectResults.find((x) => x.subjectOfferingId === offering.id);
      return sum + (r?.isPass ? offering.subject.credits : 0);
    }, 0);
    const totalCredits = offerings.reduce((sum, offering) => sum + offering.subject.credits, 0);

    const passCount = subjectResults.filter((r) => r.isPass).length;
    const isOverallPass = passCount === offerings.length && offerings.length > 0;

    return {
      subjectResults,
      totalObtained,
      totalMax,
      overallPercentage,
      totalCredits,
      earnedCredits,
      isOverallPass,
      subjectCount: offerings.length,
      passCount,
    };
  }
}
