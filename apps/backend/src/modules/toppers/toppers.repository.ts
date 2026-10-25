import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import type { Mark, Student, Subject } from '@prisma/client';
import type { ClassTopper, SubjectTopper } from './toppers.service';
import type { StudentSummary } from './algorithms';

@Injectable()
export class ToppersRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Load the active students + their marks + the subject offerings for the
   * given filters. Used by both subject-level and class-level topper rankings.
   *
   * A "class" here is a branch + semester + scheme, so the subjects that
   * count towards its ranking are the offerings for that class — not every
   * subject in the college catalogue.
   */
  async loadClassContext(params: {
    branchId?: string | string[];
    schemeId?: string;
    semester?: number;
    academicYearId?: string;
  }): Promise<{
    students: Student[];
    marks: Mark[];
    subjects: Subject[];
    /** Offering id → subject id, so marks can be grouped by subject. */
    offeringToSubject: Map<string, string>;
  }> {
    // The scope may name one branch or a set of them (a user can hold a role
    // in more than one branch), so the filter accepts either.
    const branchFilter = params.branchId
      ? Array.isArray(params.branchId)
        ? { in: params.branchId }
        : params.branchId
      : undefined;

    const studentWhere: {
      isActive: boolean;
      academicYearId?: string;
      branchId?: string | { in: string[] };
      schemeId?: string;
      semester?: number;
    } = { isActive: true };
    if (params.academicYearId) studentWhere.academicYearId = params.academicYearId;
    if (branchFilter) studentWhere.branchId = branchFilter;
    if (params.schemeId) studentWhere.schemeId = params.schemeId;
    if (params.semester !== undefined) studentWhere.semester = params.semester;

    const students = await this.prisma.student.findMany({
      where: studentWhere,
      orderBy: { rollNo: 'asc' },
    });

    const offeringWhere: {
      isActive: boolean;
      branchId?: string | { in: string[] };
      schemeId?: string;
      semester?: number;
      academicYearId?: string;
    } = { isActive: true };
    if (branchFilter) offeringWhere.branchId = branchFilter;
    if (params.schemeId) offeringWhere.schemeId = params.schemeId;
    if (params.semester !== undefined) offeringWhere.semester = params.semester;
    if (params.academicYearId) offeringWhere.academicYearId = params.academicYearId;

    const offerings = await this.prisma.subjectOffering.findMany({
      where: offeringWhere,
      include: { subject: true },
    });

    const offeringToSubject = new Map<string, string>(offerings.map((o) => [o.id, o.subjectId]));
    const subjects = offerings.map((o) => o.subject);

    const markWhere: {
      academicYearId?: string;
      isAbsent: boolean;
      isWithheld: boolean;
      student?: typeof studentWhere;
      subjectOfferingId?: { in: string[] };
    } = {
      isAbsent: false,
      isWithheld: false,
    };
    if (params.academicYearId) markWhere.academicYearId = params.academicYearId;
    if (params.branchId || params.schemeId || params.semester !== undefined) {
      markWhere.student = { ...studentWhere };
    }
    if (offerings.length > 0) {
      markWhere.subjectOfferingId = { in: offerings.map((o) => o.id) };
    } else {
      // No offerings for this class means there is nothing to rank.
      return { students: [], marks: [], subjects: [], offeringToSubject };
    }

    const marks = await this.prisma.mark.findMany({
      where: markWhere,
      include: { subjectOffering: { include: { subject: true } }, student: true },
    });

    return { students, marks, subjects, offeringToSubject };
  }

  /**
   * Aggregate per-student + per-student+subject totals. Returns the
   * structure that the algorithms consume directly.
   */
  buildStudentSummaries(
    students: Student[],
    marks: Mark[],
    subjects: Subject[],
    offeringToSubject: Map<string, string>
  ): Map<string, StudentSummary> {
    const perStudentSubject = new Map<string, Map<string, { total: number; max: number }>>();

    for (const m of marks) {
      const subjectId = offeringToSubject.get(m.subjectOfferingId) ?? m.subjectOfferingId;
      const subjMap =
        perStudentSubject.get(m.studentId) ?? new Map<string, { total: number; max: number }>();
      const cur = subjMap.get(subjectId) ?? { total: 0, max: 0 };
      cur.total += m.marksObtained;
      cur.max += m.maxMarks;
      subjMap.set(subjectId, cur);
      perStudentSubject.set(m.studentId, subjMap);
    }

    const summaries = new Map<string, StudentSummary>();
    const creditsBySubjectId = new Map<string, number>(subjects.map((s) => [s.id, s.credits]));

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
    branchId?: string | string[];
    schemeId?: string;
    semester?: number;
    academicYearId?: string;
  }): Promise<SubjectTopper[]> {
    const offeringWhere: {
      isActive: boolean;
      branchId?: string | { in: string[] };
      schemeId?: string;
      semester?: number;
      academicYearId?: string;
    } = { isActive: true };
    if (params.branchId) {
      offeringWhere.branchId = Array.isArray(params.branchId)
        ? { in: params.branchId }
        : params.branchId;
    }
    if (params.schemeId) offeringWhere.schemeId = params.schemeId;
    if (params.semester !== undefined) offeringWhere.semester = params.semester;
    if (params.academicYearId) offeringWhere.academicYearId = params.academicYearId;

    const offerings = await this.prisma.subjectOffering.findMany({
      where: offeringWhere,
      include: { subject: true },
    });
    if (offerings.length === 0) return [];

    const offeringToSubject = new Map<string, string>(offerings.map((o) => [o.id, o.subjectId]));

    const markWhere: {
      academicYearId?: string;
      isAbsent: boolean;
      isWithheld: boolean;
      subjectOfferingId: { in: string[] };
    } = {
      isAbsent: false,
      isWithheld: false,
      subjectOfferingId: { in: offerings.map((o) => o.id) },
    };
    if (params.academicYearId) markWhere.academicYearId = params.academicYearId;

    const marks = await this.prisma.mark.findMany({
      where: markWhere,
      include: {
        student: { select: { id: true, rollNo: true, name: true } },
        subjectOffering: {
          select: {
            id: true,
            subject: { select: { id: true, code: true, name: true, maxMarks: true } },
          },
        },
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
      const subjectId = offeringToSubject.get(m.subjectOfferingId) ?? m.subjectOfferingId;
      const bucket =
        buckets.get(subjectId) ??
        ({
          subjectId: m.subjectOffering.subject.id,
          subjectCode: m.subjectOffering.subject.code,
          subjectName: m.subjectOffering.subject.name,
          maxMarks: m.subjectOffering.subject.maxMarks,
          perStudent: new Map<string, { rollNo: string; name: string; total: number }>(),
        } as SubjectBucket);
      const cur = bucket.perStudent.get(m.studentId) ?? {
        rollNo: m.student.rollNo,
        name: m.student.name,
        total: 0,
      };
      cur.total += m.marksObtained;
      bucket.perStudent.set(m.studentId, cur);
      buckets.set(subjectId, bucket);
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
    branchId?: string | string[];
    schemeId?: string;
    semester?: number;
    academicYearId?: string;
    limit?: number;
  }): Promise<ClassTopper> {
    const where: {
      academicYearId?: string;
      isAbsent: boolean;
      isWithheld: boolean;
      student?: {
        isActive: boolean;
        academicYearId?: string;
        branchId?: string | { in: string[] };
        schemeId?: string;
        semester?: number;
      };
    } = {
      isAbsent: false,
      isWithheld: false,
      student: { isActive: true },
    };
    if (params.academicYearId) where.academicYearId = params.academicYearId;
    if (params.branchId) {
      where.student!.branchId = Array.isArray(params.branchId)
        ? { in: params.branchId }
        : params.branchId;
    }
    if (params.schemeId) where.student!.schemeId = params.schemeId;
    if (params.semester !== undefined) where.student!.semester = params.semester;

    const offeringWhere: {
      isActive: boolean;
      branchId?: string | { in: string[] };
      schemeId?: string;
      semester?: number;
      academicYearId?: string;
    } = { isActive: true };
    if (params.branchId) {
      offeringWhere.branchId = Array.isArray(params.branchId)
        ? { in: params.branchId }
        : params.branchId;
    }
    if (params.schemeId) offeringWhere.schemeId = params.schemeId;
    if (params.semester !== undefined) offeringWhere.semester = params.semester;
    if (params.academicYearId) offeringWhere.academicYearId = params.academicYearId;

    const offerings = await this.prisma.subjectOffering.findMany({
      where: offeringWhere,
      include: { subject: true },
    });
    if (offerings.length === 0) return { ranking: [] };

    const offeringToSubject = new Map<string, string>(offerings.map((o) => [o.id, o.subjectId]));
    const creditsBySubjectId = new Map<string, number>(
      offerings.map((o) => [o.subjectId, o.subject.credits])
    );

    const marks = await this.prisma.mark.findMany({
      where: {
        ...where,
        subjectOfferingId: { in: offerings.map((o) => o.id) },
      },
      include: {
        student: { select: { id: true, rollNo: true, name: true, semester: true } },
        subjectOffering: {
          select: { id: true, subject: { select: { id: true, credits: true } } },
        },
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
      const subjectId = offeringToSubject.get(m.subjectOfferingId) ?? m.subjectOfferingId;
      if (pct >= 40) {
        cur.creditsEarned += creditsBySubjectId.get(subjectId) ?? 0;
      }
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
