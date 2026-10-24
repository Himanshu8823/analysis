import { Injectable, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { resolveAcademicYear } from '@/common/utils/academic-year';

export interface AnalyticsParams {
  academicYearId?: string;
  branchId?: string;
  schemeId?: string;
  semester?: number;
}

export interface SubjectStats {
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  totalStudents: number;
  averageMarks: number;
  averagePercentage: number;
  maxMarks: number;
  minMarks: number;
  passCount: number;
  failCount: number;
  passPercentage: number;
  difficulty: 'Easy' | 'Moderate' | 'Hard';
}

export interface PassFailStats {
  totalStudents: number;
  passCount: number;
  failCount: number;
  passPercentage: number;
  failPercentage: number;
  distinction: number;
  firstClass: number;
  secondClass: number;
  atktCount: number;
}

export interface OverviewStats {
  totalStudents: number;
  totalSubjects: number;
  totalMarks: number;
  overallPassPercentage: number;
  averagePercentage: number;
}

export interface PerformanceTrend {
  academicYearId: string;
  year: string;
  averagePercentage: number;
  passPercentage: number;
  studentCount: number;
}

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Resolves the academic year to analyse. An explicit `academicYearId` always
   * wins; otherwise the active year (or the most recent one) is used, so every
   * analytics screen reports on the same year without the client having to
   * pass one.
   */
  private async resolveYearId(params: AnalyticsParams): Promise<string | undefined> {
    if (params.academicYearId) return params.academicYearId;
    const year = await resolveAcademicYear(this.prisma);
    return year?.id;
  }

  private buildWhere(
    params: { academicYearId?: string; branchId?: string; schemeId?: string; semester?: number },
    target: 'student' | 'subject',
  ): Prisma.MarkWhereInput {
    const where: Prisma.MarkWhereInput = {};
    if (params.academicYearId) where.academicYearId = params.academicYearId;
    where.isAbsent = false;
    where.isWithheld = false;

    if (target === 'student') {
      const sw: {
        isActive?: boolean;
        branchId?: string;
        schemeId?: string;
        semester?: number;
      } = { isActive: true };
      if (params.branchId) sw.branchId = params.branchId;
      if (params.schemeId) sw.schemeId = params.schemeId;
      if (params.semester !== undefined) sw.semester = params.semester;
      where.student = sw;
    } else {
      const sub: {
        isActive?: boolean;
        branchId?: string;
        schemeId?: string;
        semester?: number;
      } = { isActive: true };
      if (params.branchId) sub.branchId = params.branchId;
      if (params.schemeId) sub.schemeId = params.schemeId;
      if (params.semester !== undefined) sub.semester = params.semester;
      where.subject = sub;
    }
    return where;
  }

  async getOverview(params: AnalyticsParams): Promise<OverviewStats> {
    const academicYearId = await this.resolveYearId(params);

    const students = await this.prisma.student.findMany({
      where: {
        ...(params.branchId ? { branchId: params.branchId } : {}),
        ...(params.schemeId ? { schemeId: params.schemeId } : {}),
        ...(params.semester !== undefined ? { semester: params.semester } : {}),
        ...(academicYearId ? { academicYearId } : {}),
        isActive: true,
      },
    });
    const subjects = await this.prisma.subject.findMany({
      where: {
        ...(params.branchId ? { branchId: params.branchId } : {}),
        ...(params.schemeId ? { schemeId: params.schemeId } : {}),
        ...(params.semester !== undefined ? { semester: params.semester } : {}),
        isActive: true,
      },
    });
    const marks = await this.prisma.mark.findMany({
      where: this.buildWhere({ ...params, academicYearId }, 'student'),
    });

    if (marks.length === 0) {
      return {
        totalStudents: students.length,
        totalSubjects: subjects.length,
        totalMarks: 0,
        overallPassPercentage: 0,
        averagePercentage: 0,
      };
    }

    const passed = marks.filter(
      (m) => m.maxMarks > 0 && (m.marksObtained / m.maxMarks) * 100 >= 40,
    ).length;
    const average =
      marks.reduce((s, m) => s + (m.maxMarks > 0 ? (m.marksObtained / m.maxMarks) * 100 : 0), 0) /
      marks.length;

    return {
      totalStudents: students.length,
      totalSubjects: subjects.length,
      totalMarks: marks.length,
      overallPassPercentage: (passed / marks.length) * 100,
      averagePercentage: average,
    };
  }

  /**
   * Pass / fail statistics.
   *
   * The classification is per student, not per mark: a student passes when
   * their aggregate percentage clears the pass mark, and their grade band
   * follows from that same aggregate. Counting mark rows would report one
   * "student" per subject and inflate the totals.
   */
  async passFail(params: AnalyticsParams): Promise<PassFailStats> {
    const academicYearId = await this.resolveYearId(params);
    const marks = await this.prisma.mark.findMany({
      where: this.buildWhere({ ...params, academicYearId }, 'student'),
    });

    if (marks.length === 0) {
      return {
        totalStudents: 0,
        passCount: 0,
        failCount: 0,
        passPercentage: 0,
        failPercentage: 0,
        distinction: 0,
        firstClass: 0,
        secondClass: 0,
        atktCount: 0,
      };
    }

    // Aggregate each student's marks into one percentage.
    const perStudent = new Map<
      string,
      { obtained: number; max: number }
    >();
    for (const m of marks) {
      if (m.maxMarks <= 0) continue;
      const cur = perStudent.get(m.studentId) ?? { obtained: 0, max: 0 };
      cur.obtained += m.marksObtained;
      cur.max += m.maxMarks;
      perStudent.set(m.studentId, cur);
    }

    const totalStudents = perStudent.size;
    let passCount = 0;
    let distinction = 0;
    let firstClass = 0;
    let secondClass = 0;
    let atktCount = 0;
    for (const agg of perStudent.values()) {
      if (agg.max <= 0) continue;
      const pct = (agg.obtained / agg.max) * 100;
      if (pct >= 75) {
        passCount++;
        distinction++;
      } else if (pct >= 60) {
        passCount++;
        firstClass++;
      } else if (pct >= 50) {
        passCount++;
        secondClass++;
      } else if (pct >= 40) {
        // ATKT - pass borderline; we still count as pass
        passCount++;
        atktCount++;
      }
    }

    const failCount = totalStudents - passCount;
    return {
      totalStudents,
      passCount,
      failCount,
      passPercentage: totalStudents > 0 ? (passCount / totalStudents) * 100 : 0,
      failPercentage: totalStudents > 0 ? (failCount / totalStudents) * 100 : 0,
      distinction,
      firstClass,
      secondClass,
      atktCount,
    };
  }

  async subjectStats(params: AnalyticsParams): Promise<SubjectStats[]> {
    const academicYearId = await this.resolveYearId(params);
    const marks = await this.prisma.mark.findMany({
      where: this.buildWhere({ ...params, academicYearId }, 'subject'),
      include: { subject: { select: { id: true, code: true, name: true } } },
    });

    const buckets = new Map<
      string,
      {
        subject: SubjectStats;
        sums: number;
        pctSums: number;
        total: number;
        max: number;
        min: number;
        pass: number;
        fail: number;
      }
    >();

    for (const m of marks) {
      const cur = buckets.get(m.subjectId) ?? {
        subject: {
          subjectId: m.subject.id,
          subjectCode: m.subject.code,
          subjectName: m.subject.name,
          totalStudents: 0,
          averageMarks: 0,
          averagePercentage: 0,
          maxMarks: 0,
          minMarks: Number.POSITIVE_INFINITY,
          passCount: 0,
          failCount: 0,
          passPercentage: 0,
          difficulty: 'Moderate' as const,
        },
        sums: 0,
        pctSums: 0,
        total: 0,
        max: 0,
        min: Number.POSITIVE_INFINITY,
        pass: 0,
        fail: 0,
      };
      const pct = m.maxMarks > 0 ? (m.marksObtained / m.maxMarks) * 100 : 0;
      cur.sums += m.marksObtained;
      cur.pctSums += pct;
      cur.total += 1;
      cur.max = Math.max(cur.max, m.marksObtained);
      cur.min = Math.min(cur.min, m.marksObtained);
      if (pct >= 40) cur.pass += 1;
      else cur.fail += 1;
      buckets.set(m.subjectId, cur);
    }

    return [...buckets.values()].map((b) => {
      const avg = b.total > 0 ? b.sums / b.total : 0;
      const avgPct = b.total > 0 ? b.pctSums / b.total : 0;
      const pct = b.total > 0 ? (b.pass / b.total) * 100 : 0;
      return {
        subjectId: b.subject.subjectId,
        subjectCode: b.subject.subjectCode,
        subjectName: b.subject.subjectName,
        totalStudents: b.total,
        averageMarks: avg,
        averagePercentage: avgPct,
        maxMarks: b.max,
        minMarks: b.total > 0 ? b.min : 0,
        passCount: b.pass,
        failCount: b.fail,
        passPercentage: pct,
        difficulty: pct >= 70 ? 'Easy' : pct >= 50 ? 'Moderate' : 'Hard',
      };
    });
  }

  async subjectDifficulty(params: AnalyticsParams): Promise<SubjectStats[]> {
    return this.subjectStats(params);
  }

  async performanceTrends(params: {
    branchId?: string;
    schemeId?: string;
    semester?: number;
  }): Promise<PerformanceTrend[]> {
    // Every academic year is a point on the trend line — not just the active one.
    const years = await this.prisma.academicYear.findMany({
      orderBy: { startDate: 'asc' },
    });

    const trends: PerformanceTrend[] = [];
    for (const year of years) {
      const marks = await this.prisma.mark.findMany({
        where: this.buildWhere({ ...params, academicYearId: year.id }, 'student'),
      });

      const averagePercentage =
        marks.length > 0
          ? marks.reduce(
              (sum, m) =>
                sum + (m.maxMarks > 0 ? (m.marksObtained / m.maxMarks) * 100 : 0),
              0,
            ) / marks.length
          : 0;

      const passed = marks.filter(
        (m) => m.maxMarks > 0 && (m.marksObtained / m.maxMarks) * 100 >= 40,
      ).length;

      const studentCount = await this.prisma.student.count({
        where: {
          academicYearId: year.id,
          ...(params.branchId ? { branchId: params.branchId } : {}),
          ...(params.schemeId ? { schemeId: params.schemeId } : {}),
          ...(params.semester !== undefined ? { semester: params.semester } : {}),
          isActive: true,
        },
      });

      trends.push({
        academicYearId: year.id,
        year: year.year,
        averagePercentage,
        passPercentage: marks.length > 0 ? (passed / marks.length) * 100 : 0,
        studentCount,
      });
    }

    return trends;
  }
}
