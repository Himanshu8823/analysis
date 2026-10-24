import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import type { Mark, Student, Subject } from '@prisma/client';
import type { ClassTopper, SubjectTopper } from './toppers.service';
import type { StudentSummary } from './algorithms';

@Injectable()
export class ToppersRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Load the active students + their marks + subjects for the given filters.
   * Used by both subject-level and class-level topper rankings.
   */
  async loadClassContext(params: {
    branchId?: string;
    schemeId?: string;
    semester?: number;
    academicYearId: string;
  }): Promise<{
    students: Student[];
    marks: Mark[];
    subjects: Subject[];
  }> {
    const studentWhere: {
      isActive: boolean;
      academicYearId: string;
      branchId?: string;
      schemeId?: string;
      semester?: number;
    } = { isActive: true, academicYearId: params.academicYearId };
    if (params.branchId) studentWhere.branchId = params.branchId;
    if (params.schemeId) studentWhere.schemeId = params.schemeId;
    if (params.semester !== undefined) studentWhere.semester = params.semester;

    const students = await this.prisma.student.findMany({
      where: studentWhere,
      orderBy: { rollNo: 'asc' },
    });

    const markWhere: {
      academicYearId: string;
      isAbsent: boolean;
      isWithheld: boolean;
      student?: typeof studentWhere;
      subject?: {
        isActive: boolean;
        branchId?: string;
        schemeId?: string;
        semester?: number;
      };
    } = {
      academicYearId: params.academicYearId,
      isAbsent: false,
      isWithheld: false,
    };
    if (params.branchId || params.schemeId || params.semester !== undefined) {
      markWhere.subject = { isActive: true };
      if (params.branchId) markWhere.subject.branchId = params.branchId;
      if (params.schemeId) markWhere.subject.schemeId = params.schemeId;
      if (params.semester !== undefined) {
        markWhere.subject.semester = params.semester;
      }
    }

    const marks = await this.prisma.mark.findMany({
      where: markWhere,
      include: { subject: true, student: true },
    });

    const subjectWhere: { isActive: boolean } = { isActive: true };
    if (params.branchId) {
      (subjectWhere as Record<string, unknown>).branchId = params.branchId;
    }
    if (params.schemeId) {
      (subjectWhere as Record<string, unknown>).schemeId = params.schemeId;
    }
    if (params.semester !== undefined) {
      (subjectWhere as Record<string, unknown>).semester = params.semester;
    }

    const subjects = await this.prisma.subject.findMany({
      where: subjectWhere,
    });

    return { students, marks, subjects };
  }

  /**
   * Aggregate per-student + per-student+subject totals. Returns the
   * structure that the algorithms consume directly.
   */
  buildStudentSummaries(
    students: Student[],
    marks: Mark[],
    subjects: Subject[],
  ): Map<string, StudentSummary> {
    const perStudentSubject = new Map<
      string,
      Map<string, { total: number; max: number }>
    >();

    for (const m of marks) {
      const subjMap =
        perStudentSubject.get(m.studentId) ?? new Map<string, { total: number; max: number }>();
      const cur = subjMap.get(m.subjectId) ?? { total: 0, max: 0 };
      cur.total += m.marksObtained;
      cur.max += m.maxMarks;
      subjMap.set(m.subjectId, cur);
      perStudentSubject.set(m.studentId, subjMap);
    }

    const summaries = new Map<string, StudentSummary>();
    const creditsBySubjectId = new Map<string, number>(
      subjects.map((s) => [s.id, s.credits]),
    );

    for (const student of students) {
      const subjMap = perStudentSubject.get(student.id) ?? new Map();
      let totalObtained = 0;
      let totalMax = 0;
      let earnedCredits = 0;
      let totalCredits = 0;
      let passCount = 0;
      for (const [subjectId, agg] of subjMap) {
        totalObtained += agg.total;
        totalMax += agg.max;
        const credits = creditsBySubjectId.get(subjectId) ?? 0;
        totalCredits += credits;
        const pct = agg.max > 0 ? (agg.total / agg.max) * 100 : 0;
        if (pct >= 40) {
          earnedCredits += credits;
          passCount++;
        }
      }
      const percentage = totalMax > 0 ? (totalObtained / totalMax) * 100 : 0;
      summaries.set(student.id, {
        studentId: student.id,
        rollNo: student.rollNo,
        name: student.name,
        totalObtained,
        totalMax,
        percentage,
        earnedCredits,
        totalCredits,
        isOverallPass: passCount === subjMap.size && subjMap.size > 0,
        passCount,
        subjectCount: subjMap.size,
      });
    }

    return summaries;
  }

  async findSubjectToppers(params: {
    branchId?: string;
    schemeId?: string;
    semester?: number;
    academicYearId: string;
  }): Promise<SubjectTopper[]> {
    const markWhere: {
      academicYearId: string;
      isAbsent: boolean;
      isWithheld: boolean;
      subject?: {
        isActive: boolean;
        branchId?: string;
        schemeId?: string;
        semester?: number;
      };
    } = {
      academicYearId: params.academicYearId,
      isAbsent: false,
      isWithheld: false,
      subject: { isActive: true },
    };
    if (params.branchId) markWhere.subject!.branchId = params.branchId;
    if (params.schemeId) markWhere.subject!.schemeId = params.schemeId;
    if (params.semester !== undefined) {
      markWhere.subject!.semester = params.semester;
    }

    const marks = await this.prisma.mark.findMany({
      where: markWhere,
      include: {
        student: { select: { id: true, rollNo: true, name: true } },
        subject: { select: { id: true, code: true, name: true, maxMarks: true } },
      },
    });

    type SubjectBucket = {
      subjectId: string;
      subjectCode: string;
      subjectName: string;
      maxMarks: number;
      perStudent: Map<string, { rollNo: string; name: string; total: number }>;
    };
    const buckets = new Map<string, SubjectBucket>();
    for (const m of marks) {
      const bucket =
        buckets.get(m.subjectId) ??
        ({
          subjectId: m.subject.id,
          subjectCode: m.subject.code,
          subjectName: m.subject.name,
          maxMarks: m.subject.maxMarks,
          perStudent: new Map<
            string,
            { rollNo: string; name: string; total: number }
          >(),
        } as SubjectBucket);
      const cur = bucket.perStudent.get(m.studentId) ?? {
        rollNo: m.student.rollNo,
        name: m.student.name,
        total: 0,
      };
      cur.total += m.marksObtained;
      bucket.perStudent.set(m.studentId, cur);
      buckets.set(m.subjectId, bucket);
    }

    const result: SubjectTopper[] = [];
    for (const bucket of buckets.values()) {
      const sorted = [...bucket.perStudent.entries()]
        .map(([studentId, agg]) => ({
          studentId,
          rollNo: agg.rollNo,
          name: agg.name,
          total: agg.total,
        }))
        .sort((a, b) => b.total - a.total);
      const topMark = sorted[0]?.total ?? 0;
      result.push({
        subjectId: bucket.subjectId,
        subjectCode: bucket.subjectCode,
        subjectName: bucket.subjectName,
        marksObtained: topMark,
        maxMarks: bucket.maxMarks,
        toppers: sorted
          .filter((s) => s.total === topMark)
          .map((s) => ({
            studentId: s.studentId,
            rollNo: s.rollNo,
            name: s.name,
            marks: s.total,
          })),
      });
    }
    return result;
  }

  async findClassToppers(params: {
    branchId?: string;
    schemeId?: string;
    semester?: number;
    academicYearId: string;
    limit?: number;
  }): Promise<ClassTopper> {
    const where: {
      academicYearId: string;
      isAbsent: boolean;
      isWithheld: boolean;
      student?: {
        isActive: boolean;
        branchId?: string;
        schemeId?: string;
        semester?: number;
      };
    } = {
      academicYearId: params.academicYearId,
      isAbsent: false,
      isWithheld: false,
      student: { isActive: true },
    };
    if (params.branchId) where.student!.branchId = params.branchId;
    if (params.schemeId) where.student!.schemeId = params.schemeId;
    if (params.semester !== undefined) where.student!.semester = params.semester;

    const marks = await this.prisma.mark.findMany({
      where,
      include: {
        student: { select: { id: true, rollNo: true, name: true, semester: true } },
        subject: { select: { id: true, credits: true, passingMarks: true, maxMarks: true } },
      },
    });

    type StudentAgg = {
      studentId: string;
      rollNo: string;
      name: string;
      totalMarks: number;
      maxTotalMarks: number;
      creditsEarned: number;
    };
    const perStudent = new Map<string, StudentAgg>();
    for (const m of marks) {
      const cur = perStudent.get(m.studentId) ?? {
        studentId: m.studentId,
        rollNo: m.student.rollNo,
        name: m.student.name,
        totalMarks: 0,
        maxTotalMarks: 0,
        creditsEarned: 0,
      };
      cur.totalMarks += m.marksObtained;
      cur.maxTotalMarks += m.maxMarks;
      const pct = m.maxMarks > 0 ? (m.marksObtained / m.maxMarks) * 100 : 0;
      if (pct >= 40) cur.creditsEarned += m.subject.credits;
      perStudent.set(m.studentId, cur);
    }

    const limit = Math.max(1, params.limit ?? 10);
    const ranked = [...perStudent.values()]
      .map((s) => ({
        ...s,
        percentage: s.maxTotalMarks > 0 ? (s.totalMarks / s.maxTotalMarks) * 100 : 0,
      }))
      .sort((a, b) => b.totalMarks - a.totalMarks)
      .slice(0, limit);

    return {
      ranking: ranked.map((s, idx) => ({ rank: idx + 1, ...s })),
    };
  }
}
