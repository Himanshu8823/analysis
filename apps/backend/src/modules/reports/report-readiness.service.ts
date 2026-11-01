import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * The scope a readiness check runs against.
 */
export interface ReadinessScope {
  branchId: string;
  schemeId: string;
  semester: number;
  academicYearId: string;
}

/**
 * What is still missing before the class's result can be reported on.
 */
export interface ReadinessReport {
  /** Whether every student's result is complete. */
  isReady: boolean;
  /** How many students the class has. */
  studentCount: number;
  /** How many students have a complete result. */
  completeCount: number;
  /** How many students are still missing marks. */
  pendingCount: number;
  /**
   * The subjects still missing marks, with how many students are missing
   * each one. The operator needs this to know what to enter next.
   */
  pendingSubjects: Array<{
    subjectCode: string;
    subjectName: string;
    /** How many students have no mark for this subject. */
    missingCount: number;
  }>;
  /**
   * The students whose result is still incomplete, with the subjects that
   * are missing for each. Capped at a readable number — the list is for
   * orientation, not for a spreadsheet.
   */
  pendingStudents: Array<{
    rollNo: string;
    name: string;
    missingSubjects: string[];
  }>;
  /**
   * The message shown to the operator. It says what is missing, so the
   * operator knows what to do rather than just that something is wrong.
   */
  message: string;
}

/**
 * How many pending students the readiness report names.
 *
 * A class can have hundreds of students waiting on one subject, and a list
 * of all of them helps nobody. The first few point at the problem; the
 * count beside them says how big it is.
 */
const MAX_NAMED_STUDENTS = 20;

@Injectable()
export class ReportReadinessService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Checks whether a class's result is complete enough to report on.
   *
   * The rule is deliberately strict: a report is a published statement about
   * the class, so it may only be produced when every student has a verdict
   * in every subject. A class with marks still missing is reported as not
   * ready, with the missing subjects named.
   */
  async check(scope: ReadinessScope): Promise<ReadinessReport> {
    const offerings = await this.prisma.subjectOffering.findMany({
      where: {
        branchId: scope.branchId,
        schemeId: scope.schemeId,
        semester: scope.semester,
        academicYearId: scope.academicYearId,
        isActive: true,
      },
      include: { subject: { select: { code: true, name: true } } },
      orderBy: { subject: { code: 'asc' } },
    });

    const students = await this.prisma.student.findMany({
      where: {
        branchId: scope.branchId,
        schemeId: scope.schemeId,
        semester: scope.semester,
        academicYearId: scope.academicYearId,
        isActive: true,
      },
      select: { id: true, rollNo: true, name: true },
      orderBy: { rollNo: 'asc' },
    });

    if (!offerings.length) {
      return {
        isReady: false,
        studentCount: students.length,
        completeCount: 0,
        pendingCount: students.length,
        pendingSubjects: [],
        pendingStudents: [],
        message:
          'This class has no subject offerings yet, so there is nothing to report. Map the subjects to the class first.',
      };
    }

    if (!students.length) {
      return {
        isReady: false,
        studentCount: 0,
        completeCount: 0,
        pendingCount: 0,
        pendingSubjects: [],
        pendingStudents: [],
        message: 'This class has no students, so there is nothing to report.',
      };
    }

    const marks = await this.prisma.mark.findMany({
      where: {
        academicYearId: scope.academicYearId,
        subjectOfferingId: { in: offerings.map((o) => o.id) },
        student: {
          branchId: scope.branchId,
          schemeId: scope.schemeId,
          semester: scope.semester,
        },
      },
      select: { studentId: true, subjectOfferingId: true },
    });

    /**
     * The subjects each student has a mark for. A subject with a mark in any
     * exam type counts as entered — a student who has sat CA1 but not the
     * end-semester paper has *a* mark for that subject, and the missing
     * part of the subject is a separate concern from the subject being
     * absent altogether.
     */
    const enteredByStudent = new Map<string, Set<string>>();
    for (const mark of marks) {
      const set = enteredByStudent.get(mark.studentId) ?? new Set<string>();
      set.add(mark.subjectOfferingId);
      enteredByStudent.set(mark.studentId, set);
    }

    const pendingStudents: ReadinessReport['pendingStudents'] = [];
    const missingCountByOffering = new Map<string, number>();
    let completeCount = 0;

    for (const student of students) {
      const entered = enteredByStudent.get(student.id) ?? new Set<string>();
      const missing = offerings.filter((o) => !entered.has(o.id));

      if (missing.length === 0) {
        completeCount += 1;
        continue;
      }

      for (const offering of missing) {
        missingCountByOffering.set(offering.id, (missingCountByOffering.get(offering.id) ?? 0) + 1);
      }

      if (pendingStudents.length < MAX_NAMED_STUDENTS) {
        pendingStudents.push({
          rollNo: student.rollNo,
          name: student.name,
          missingSubjects: missing.map((o) => o.subject.code),
        });
      }
    }

    const pendingSubjects = offerings
      .filter((o) => missingCountByOffering.has(o.id))
      .map((o) => ({
        subjectCode: o.subject.code,
        subjectName: o.subject.name,
        missingCount: missingCountByOffering.get(o.id) ?? 0,
      }));

    const pendingCount = students.length - completeCount;
    const isReady = pendingCount === 0;

    return {
      isReady,
      studentCount: students.length,
      completeCount,
      pendingCount,
      pendingSubjects,
      pendingStudents,
      message: isReady
        ? 'Every student has a result in every subject. The report can be generated.'
        : `Result not available yet — ${pendingCount} of ${students.length} students still have marks missing in ${
            pendingSubjects.length
          } subject${pendingSubjects.length === 1 ? '' : 's'}.`,
    };
  }
}
