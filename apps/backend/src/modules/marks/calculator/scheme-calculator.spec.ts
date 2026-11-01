import type { Mark, Subject } from '@prisma/client';
import { Scheme2019Calculator } from './scheme-2019.calculator';
import { Scheme2022Calculator } from './scheme-2022.calculator';
import { Scheme2024Calculator } from './scheme-2024.calculator';

/**
 * A subject as the calculators see it.
 *
 * The calculators read the subject's `components` to decide whether it has a
 * practical, and its marks to decide the thresholds.
 */
const subject = {
  id: 'subject-1',
  code: 'DSA301',
  name: 'Data Structures and Algorithms',
  credits: 4,
  maxMarks: 100,
  passingMarks: 40,
  components: { hasTheory: true, hasPractical: false },
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
} as Subject;

/** A mark row, as the calculators receive them. */
function mark(examType: string, marksObtained: number, maxMarks: number): Mark {
  return {
    id: `mark-${examType}-${marksObtained}`,
    studentId: 'student-1',
    subjectOfferingId: 'offering-1',
    examType,
    marksObtained,
    maxMarks,
    isAbsent: false,
    isWithheld: false,
    academicYearId: 'year-1',
    remarks: null,
    createdBy: null,
    updatedBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as Mark;
}

/** The offering context the calculators map over. */
const offering = {
  id: 'offering-1',
  semester: 3,
  subject,
};

const calculators = [
  {
    name: 'SCHEME_2019',
    calc: new Scheme2019Calculator(),
    /**
     * The 2019 scheme splits the internal into CA1 + CA2 + Mid-Sem out of
     * 60, and the external is a 100-mark written paper.
     */
    passing: [
      mark('CA1', 15, 20),
      mark('CA2', 15, 20),
      mark('MID_SEM', 15, 20),
      mark('WRITTEN', 60, 100),
    ],
    failing: [
      mark('CA1', 2, 20),
      mark('CA2', 2, 20),
      mark('MID_SEM', 2, 20),
      mark('WRITTEN', 5, 100),
    ],
  },
  {
    name: 'SCHEME_2022',
    calc: new Scheme2022Calculator(),
    /**
     * The 2022 scheme's internal components are CT + Mid-Sem out of 40, and
     * the external is a 60-mark written paper.
     */
    passing: [
      mark('CT', 15, 15),
      mark('MID_SEM', 15, 15),
      mark('QUIZ', 10, 10),
      mark('WRITTEN', 40, 60),
    ],
    failing: [
      mark('CT', 2, 15),
      mark('MID_SEM', 1, 15),
      mark('QUIZ', 1, 10),
      mark('WRITTEN', 5, 60),
    ],
  },
  {
    name: 'SCHEME_2024',
    calc: new Scheme2024Calculator(),
    passing: [
      mark('CT1', 15, 15),
      mark('MID_SEM', 15, 15),
      mark('QUIZ', 10, 10),
      mark('WRITTEN', 40, 60),
    ],
    failing: [
      mark('CT1', 2, 15),
      mark('MID_SEM', 1, 15),
      mark('QUIZ', 1, 10),
      mark('WRITTEN', 5, 60),
    ],
  },
];

describe('scheme calculators — a subject with no marks is pending, not failed', () => {
  it.each(calculators)('$name reports an unevaluated subject as not evaluated', ({ calc }) => {
    const result = calc.calculateSubjectResult([], subject);

    expect(result.isEvaluated).toBe(false);
    expect(result.isPass).toBe(false);
    expect(result.reason).toBe('Result not entered yet');
  });

  it.each(calculators)('$name does not fail a student over a missing subject', ({ calc }) => {
    const result = calc.calculateStudentResult('student-1', [], [offering]);

    /**
     * The regression: a student with no marks was scoring 0% against a
     * maximum of 0, which read as a failure. The student has not failed
     * anything — their result is simply not in yet.
     */
    expect(result.isComplete).toBe(false);
    expect(result.pendingSubjectCount).toBe(1);
    expect(result.isOverallPass).toBe(false);
    expect(result.passCount).toBe(0);
  });

  it.each(calculators)('$name counts a subject with marks as evaluated', ({ calc, passing }) => {
    const result = calc.calculateSubjectResult(passing, subject);

    expect(result.isEvaluated).toBe(true);
  });

  it.each(calculators)(
    '$name passes a student whose every subject is entered',
    ({ calc, passing }) => {
      const result = calc.calculateStudentResult('student-1', passing, [offering]);

      expect(result.isComplete).toBe(true);
      expect(result.pendingSubjectCount).toBe(0);
      expect(result.isOverallPass).toBe(true);
      expect(result.passCount).toBe(1);
    }
  );

  it.each(calculators)('$name fails a student who cleared nothing', ({ calc, failing }) => {
    const result = calc.calculateStudentResult('student-1', failing, [offering]);

    expect(result.isComplete).toBe(true);
    expect(result.isOverallPass).toBe(false);
    expect(result.passCount).toBe(0);
  });

  it.each(calculators)(
    '$name treats an absent student as failed, not pending',
    ({ calc, passing }) => {
      const absent = { ...passing[passing.length - 1], isAbsent: true, marksObtained: 0 };
      const result = calc.calculateStudentResult(
        'student-1',
        [...passing.slice(0, -1), absent],
        [offering]
      );

      /**
       * An absent student has a record — the examination happened and they
       * were not there. That is a result, unlike a subject nobody has
       * entered anything for.
       */
      expect(result.isComplete).toBe(true);
      expect(result.pendingSubjectCount).toBe(0);
      expect(result.isOverallPass).toBe(false);
    }
  );
});
