import { Injectable, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { resolveAcademicYear } from '@/common/utils/academic-year';

export interface DashboardKpis {
  totalStudents: number;
  passPercentage: number;
  totalSubjects: number;
  averagePercentage: number;
}

export interface DashboardUpload {
  id: string;
  fileName: string;
  status: string;
  createdAt: string;
}

export interface DashboardData {
  kpis: DashboardKpis;
  recentUploads: DashboardUpload[];
  /** The academic year the figures were computed against. */
  academicYear: { id: string; year: string } | null;
}

export interface DashboardScope {
  branchId?: string;
  schemeId?: string;
  semester?: number;
}

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(private readonly prisma: PrismaClient) {}

  async getDashboard(scope: DashboardScope): Promise<DashboardData> {
    const academicYear = await resolveAcademicYear(this.prisma);

    if (!academicYear) {
      this.logger.warn('No academic year exists yet — the dashboard will report zeroes.');
      return {
        kpis: {
          totalStudents: 0,
          passPercentage: 0,
          totalSubjects: 0,
          averagePercentage: 0,
        },
        recentUploads: await this.recentUploads(),
        academicYear: null,
      };
    }

    const studentScope: Prisma.StudentWhereInput = {
      academicYearId: academicYear.id,
      isActive: true,
    };
    const subjectScope: Prisma.SubjectWhereInput = { isActive: true };

    // `semester` is only applied when it is a real number. A NaN would make
    // Prisma reject the whole filter, so it is filtered out here.
    if (scope.branchId) {
      studentScope.branchId = scope.branchId;
      subjectScope.branchId = scope.branchId;
    }
    if (scope.schemeId) {
      studentScope.schemeId = scope.schemeId;
      subjectScope.schemeId = scope.schemeId;
    }
    if (scope.semester !== undefined && Number.isFinite(scope.semester)) {
      studentScope.semester = scope.semester;
      subjectScope.semester = scope.semester;
    }

    const markScope: Prisma.MarkWhereInput = {
      academicYearId: academicYear.id,
      isAbsent: false,
      isWithheld: false,
      student: studentScope,
    };

    const [totalStudents, totalSubjects, marks, recentUploads] = await Promise.all([
      this.prisma.student.count({ where: studentScope }),
      this.prisma.subject.count({ where: subjectScope }),
      this.prisma.mark.findMany({
        where: markScope,
        select: { marksObtained: true, maxMarks: true },
      }),
      this.recentUploads(),
    ]);

    let passPercentage = 0;
    let averagePercentage = 0;

    if (marks.length > 0) {
      let sum = 0;
      let passed = 0;
      let graded = 0;
      for (const mark of marks) {
        if (!Number.isFinite(mark.maxMarks) || mark.maxMarks <= 0) continue;
        const pct = (mark.marksObtained / mark.maxMarks) * 100;
        sum += pct;
        graded += 1;
        if (pct >= 40) passed += 1;
      }
      averagePercentage = graded > 0 ? sum / graded : 0;
      passPercentage = graded > 0 ? (passed / graded) * 100 : 0;
    }

    return {
      kpis: { totalStudents, passPercentage, totalSubjects, averagePercentage },
      recentUploads,
      academicYear,
    };
  }

  /** The five most recent upload jobs, newest first. */
  private async recentUploads(): Promise<DashboardUpload[]> {
    const rows = await this.prisma.uploadJob.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, fileName: true, status: true, createdAt: true },
    });

    return rows.map((row) => ({
      id: row.id,
      fileName: row.fileName,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
    }));
  }
}
