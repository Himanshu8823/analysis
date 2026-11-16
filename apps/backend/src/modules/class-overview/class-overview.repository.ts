import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * The class a member teaches as class teacher.
 *
 * A class is branch + semester + scheme + academic year, and it has exactly
 * one class teacher. This is the row that identifies it.
 */
export interface MyClassAssignment {
  id: string;
  branchId: string;
  branchCode: string;
  branchName: string;
  semester: number;
  schemeId: string;
  schemeName: string;
  academicYearId: string;
  academicYearLabel: string;
}

/**
 * One student's standing in the class.
 *
 * The totals are the sum of the marks recorded for the class's subjects.
 * A student with no marks at all still appears, with zeroes — the roster is
 * the class, not the mark sheet.
 */
export interface ClassStudentRow {
  id: string;
  rollNo: string;
  name: string;
  semester: number;
  /** The sum of the marks obtained across the class's subjects. */
  totalMarks: number;
  /** The sum of the maximum marks across the class's subjects. */
  maxTotalMarks: number;
  percentage: number;
  /** How many of the class's subjects carry a recorded mark. */
  subjectsWithMarks: number;
  /** The subjects this student has no mark for. */
  missingSubjects: string[];
  /**
   * The subjects this student scored below the passing mark in.
   *
   * The list is per student rather than per subject so the class's pass and
   * fail counts can be computed per student: a student who failed two
   * subjects is one failing student, not two.
   */
  failedSubjects: string[];
}

/**
 * The per-subject standing of the class.
 */
export interface ClassSubjectSummary {
  subjectOfferingId: string;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  /** How many students have a recorded mark for this subject. */
  studentsWithMarks: number;
  /** The class average, as a percentage of the subject's maximum. */
  averagePercentage: number;
  /** The highest mark obtained, and the student who holds it. */
  highestMarks: number;
  highestScorerName: string | null;
  highestScorerRollNo: string | null;
  /** How many students passed this subject under the scheme's rules. */
  passCount: number;
}

@Injectable()
export class ClassOverviewRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * The classes a member is the class teacher of.
   *
   * A member may hold the class-teacher post for more than one class — a
   * senior member often teaches two divisions — so the list is not
   * narrowed to one.
   */
  async findClassesTaughtBy(userId: string): Promise<MyClassAssignment[]> {
    const rows = await this.prisma.classTeacherAssignment.findMany({
      where: { teacherId: userId },
      include: {
        branch: { select: { code: true, name: true } },
        scheme: { select: { name: true } },
        academicYear: { select: { year: true } },
      },
      orderBy: [{ semester: 'asc' }, { branchId: 'asc' }],
    });

    return rows.map((r) => ({
      id: r.id,
      branchId: r.branchId,
      branchCode: r.branch.code,
      branchName: r.branch.name,
      semester: r.semester,
      schemeId: r.schemeId,
      schemeName: r.scheme.name,
      academicYearId: r.academicYearId,
      academicYearLabel: r.academicYear.year,
    }));
  }

  /**
   * The subject offerings running for a class.
   *
   * The offering is the unit marks belong to, so the class's subjects are
   * the offerings that match its branch, semester and scheme.
   *
   * The academic year is not part of the filter: an offering is the standing
   * "this subject is taught in this class context", and the year only
   * decides which marks inside it belong to the class being read.
   */
  async findClassSubjectOfferings(params: {
    branchId: string;
    semester: number;
    schemeId: string;
  }): Promise<
    Array<{
      id: string;
      subjectId: string;
      subjectCode: string;
      subjectName: string;
      credits: number;
      maxMarks: number;
      passingMarks: number;
    }>
  > {
    const rows = await this.prisma.subjectOffering.findMany({
      where: {
        branchId: params.branchId,
        semester: params.semester,
        schemeId: params.schemeId,
        isActive: true,
        subject: { isActive: true },
      },
      include: { subject: true },
      orderBy: { subject: { code: 'asc' } },
    });

    return rows.map((r) => ({
      id: r.id,
      subjectId: r.subject.id,
      subjectCode: r.subject.code,
      subjectName: r.subject.name,
      credits: r.subject.credits,
      maxMarks: r.subject.maxMarks,
      passingMarks: r.subject.passingMarks,
    }));
  }

  /**
   * The students of a class, with their marks rolled up.
   *
   * The marks are fetched for the class's offerings in one query and
   * aggregated in memory: the class is bounded by its offerings, so the
   * result set is small and a second round trip would only cost latency.
   */
  async findClassStudentsWithMarks(params: {
    branchId: string;
    semester: number;
    schemeId: string;
    academicYearId: string;
    /** The class's subject offerings, each with the code shown to the user. */
    offerings: Array<{ id: string; subjectCode: string; passingMarks: number }>;
  }): Promise<ClassStudentRow[]> {
    const students = await this.prisma.student.findMany({
      where: {
        isActive: true,
        branchId: params.branchId,
        semester: params.semester,
        schemeId: params.schemeId,
        academicYearId: params.academicYearId,
      },
      select: {
        id: true,
        rollNo: true,
        name: true,
        semester: true,
      },
      orderBy: { rollNo: 'asc' },
    });

    if (!students.length) return [];

    const subjectOfferingIds = params.offerings.map((o) => o.id);
    const codeByOffering = new Map(params.offerings.map((o) => [o.id, o.subjectCode]));
    const passingMarksByOffering = new Map(params.offerings.map((o) => [o.id, o.passingMarks]));

    const marks = subjectOfferingIds.length
      ? await this.prisma.mark.findMany({
          where: {
            studentId: { in: students.map((s) => s.id) },
            subjectOfferingId: { in: subjectOfferingIds },
            academicYearId: params.academicYearId,
          },
          select: {
            studentId: true,
            subjectOfferingId: true,
            marksObtained: true,
            maxMarks: true,
            isAbsent: true,
          },
        })
      : [];

    /**
     * The marks are grouped by student, so the totals and the
     * missing-subject list are both read off one pass.
     */
    const marksByStudent = new Map<string, typeof marks>();
    for (const mark of marks) {
      const list = marksByStudent.get(mark.studentId) ?? [];
      list.push(mark);
      marksByStudent.set(mark.studentId, list);
    }

    return students.map((student) => {
      const studentMarks = marksByStudent.get(student.id) ?? [];

      let totalMarks = 0;
      let maxTotalMarks = 0;
      const scoredOfferings = new Set<string>();
      const failedSubjects: string[] = [];

      for (const mark of studentMarks) {
        scoredOfferings.add(mark.subjectOfferingId);
        if (mark.isAbsent) continue;
        totalMarks += mark.marksObtained;
        maxTotalMarks += mark.maxMarks;

        /**
         * A student fails a subject by scoring below its passing mark.
         * The subject's own configured passing marks decide it, so the
         * verdict matches the subject as it was set up.
         */
        const passingMarks = passingMarksByOffering.get(mark.subjectOfferingId) ?? 0;
        if (mark.marksObtained < passingMarks) {
          failedSubjects.push(codeByOffering.get(mark.subjectOfferingId) ?? mark.subjectOfferingId);
        }
      }

      const missingSubjects = subjectOfferingIds
        .filter((id) => !scoredOfferings.has(id))
        .map((id) => codeByOffering.get(id) ?? id);

      const percentage = maxTotalMarks > 0 ? (totalMarks / maxTotalMarks) * 100 : 0;

      return {
        id: student.id,
        rollNo: student.rollNo,
        name: student.name,
        semester: student.semester,
        totalMarks: round(totalMarks),
        maxTotalMarks: round(maxTotalMarks),
        percentage: round(percentage),
        subjectsWithMarks: scoredOfferings.size,
        missingSubjects,
        failedSubjects,
      };
    });
  }

  /**
   * The per-subject standing of a class.
   *
   * The pass count uses the subject's own configured passing marks, so the
   * summary matches what the subject was set up with rather than a rule
   * invented here.
   */
  async findClassSubjectSummaries(params: {
    subjectOfferingIds: string[];
    academicYearId: string;
    studentIds: string[];
    offerings: Array<{
      id: string;
      subjectCode: string;
      subjectName: string;
      passingMarks: number;
    }>;
  }): Promise<ClassSubjectSummary[]> {
    if (!params.subjectOfferingIds.length || !params.studentIds.length) {
      return params.offerings.map((o) => ({
        subjectOfferingId: o.id,
        subjectId: o.id,
        subjectCode: o.subjectCode,
        subjectName: o.subjectName,
        studentsWithMarks: 0,
        averagePercentage: 0,
        highestMarks: 0,
        highestScorerName: null,
        highestScorerRollNo: null,
        passCount: 0,
      }));
    }

    const marks = await this.prisma.mark.findMany({
      where: {
        studentId: { in: params.studentIds },
        subjectOfferingId: { in: params.subjectOfferingIds },
        academicYearId: params.academicYearId,
      },
      select: {
        studentId: true,
        subjectOfferingId: true,
        marksObtained: true,
        maxMarks: true,
        isAbsent: true,
      },
    });

    const students = await this.prisma.student.findMany({
      where: { id: { in: params.studentIds } },
      select: { id: true, name: true, rollNo: true },
    });
    const studentById = new Map(students.map((s) => [s.id, s]));

    return params.offerings.map((offering) => {
      const subjectMarks = marks.filter((m) => m.subjectOfferingId === offering.id);

      let totalObtained = 0;
      let totalMax = 0;
      let counted = 0;
      let highestMarks = 0;
      let highestScorerName: string | null = null;
      let highestScorerRollNo: string | null = null;
      let passCount = 0;

      for (const mark of subjectMarks) {
        if (mark.isAbsent) continue;
        counted += 1;
        totalObtained += mark.marksObtained;
        totalMax += mark.maxMarks;

        if (mark.marksObtained > highestMarks) {
          highestMarks = mark.marksObtained;
          const student = studentById.get(mark.studentId);
          highestScorerName = student?.name ?? null;
          highestScorerRollNo = student?.rollNo ?? null;
        }

        if (mark.marksObtained >= offering.passingMarks) passCount += 1;
      }

      return {
        subjectOfferingId: offering.id,
        subjectId: offering.id,
        subjectCode: offering.subjectCode,
        subjectName: offering.subjectName,
        studentsWithMarks: counted,
        averagePercentage: totalMax > 0 ? round((totalObtained / totalMax) * 100) : 0,
        highestMarks: round(highestMarks),
        highestScorerName,
        highestScorerRollNo,
        passCount,
      };
    });
  }
}

/** Rounds to two decimals, so a percentage never shows a repeating tail. */
function round(value: number): number {
  return Math.round(value * 100) / 100;
}
