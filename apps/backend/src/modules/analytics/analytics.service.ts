import { Injectable, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import type { Prisma } from '@prisma/client';

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

  async getOverview(params: {
    academicYearId: string;
    branchId?: string;
    schemeId?: string;
    semester?: number;
  }): Promise<OverviewStats> {
    const students = await this.prisma.student.findMany({
      where: {
        ...(params.branchId ? { branchId: params.branchId } : {}),
        ...(params.schemeId ? { schemeId: params.schemeId } : {}),
        ...(params.semester !== undefined ? { semester: params.semester } : {}),
        academicYearId: params.academicYearId,
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
      where: this.buildWhere(params, 'student'),
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

  async passFail(params: {
    academicYearId: string;
    branchId?: string;
    schemeId?: string;
    semester?: number;
  }): Promise<PassFailStats> {
    const marks = await this.prisma.mark.findMany({
      where: this.buildWhere(params, 'student'),
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

    let passCount = 0;
    let distinction = 0;
    let firstClass = 0;
    let secondClass = 0;
    let atktCount = 0;
    for (const m of marks) {
      if (m.maxMarks <= 0) continue;
      const pct = (m.marksObtained / m.maxMarks) * 100;
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

    return {
      totalStudents: marks.length,
      passCount,
      failCount: marks.length - passCount,
      passPercentage: (passCount / marks.length) * 100,
      failPercentage: ((marks.length - passCount) / marks.length) * 100,
      distinction,
      firstClass,
      secondClass,
      atktCount,
    };
  }

  async subjectStats(params: {
    academicYearId: string;
    branchId?: string;
    schemeId?: string;
    semester?: number;
  }): Promise<SubjectStats[]> {
    const marks = await this.prisma.mark.findMany({
      where: this.buildWhere(params, 'subject'),
      include: { subject: { select: { id: true, code: true, name: true } } },
    });

    const buckets = new Map<
      string,
      {
        subject: SubjectStats;
        sums: number;
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
        total: 0,
        max: 0,
        min: Number.POSITIVE_INFINITY,
        pass: 0,
        fail: 0,
      };
      cur.sums += m.marksObtained;
      cur.total += 1;
      cur.max = Math.max(cur.max, m.marksObtained);
      cur.min = Math.min(cur.min, m.marksObtained);
      if (m.maxMarks > 0 && (m.marksObtained / m.maxMarks) * 100 >= 40) cur.pass += 1;
      else cur.fail += 1;
      buckets.set(m.subjectId, cur);
    }

    return [...buckets.values()].map((b) => {
      const avg = b.total > 0 ? b.sums / b.total : 0;
      const pct = b.total > 0 ? (b.pass / b.total) * 100 : 0;
      return {
        subjectId: b.subject.subjectId,
        subjectCode: b.subject.subjectCode,
        subjectName: b.subject.subjectName,
        totalStudents: b.total,
        averageMarks: avg,
        averagePercentage: pct,
        maxMarks: b.max,
        minMarks: b.total > 0 ? b.min : 0,
        passCount: b.pass,
        failCount: b.fail,
        passPercentage: pct,
        difficulty: pct >= 70 ? 'Easy' : pct >= 50 ? 'Moderate' : 'Hard',
      };
    });
  }

  async subjectDifficulty(params: {
    academicYearId: string;
    branchId?: string;
    schemeId?: string;
    semester?: number;
  }): Promise<SubjectStats[]> {
    return this.subjectStats(params);
  }

  async performanceTrends(params: {
    branchId?: string;
    schemeId?: string;
    semester?: number;
  }): Promise<PerformanceTrend[]> {
    const years = await this.prisma.academicYear.findMany({
      where: { isActive: true },
      orderBy: { startDate: 'asc' },
    });

    const trends: PerformanceTrend[] = [];
    for (const year of years) {
      const stats = await this.passFail({
        academicYearId: year.id,
        branchId: params.branchId,
        schemeId: params.schemeId,
        semester: params.semester,
      });
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
        averagePercentage: stats.passPercentage,
        passPercentage: stats.passPercentage,
        studentCount,
      });
    }

    return trends;
  }
}
