import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ToppersRepository } from './toppers.repository';
import { TopperStrategyFactory } from './algorithms';
import type { RankingRule } from './algorithms';

export interface SubjectTopper {
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  marksObtained: number;
  maxMarks: number;
  toppers: Array<{
    studentId: string;
    rollNo: string;
    name: string;
    marks: number;
  }>;
}

export interface ClassTopper {
  ranking: Array<{
    rank: number;
    studentId: string;
    rollNo: string;
    name: string;
    totalMarks: number;
    maxTotalMarks: number;
    percentage: number;
    creditsEarned: number;
  }>;
}

export interface RankedTopper {
  rank: number;
  studentId: string;
  rollNo: string;
  name: string;
  score: number;
  percentage: number;
  isTie: boolean;
}

export interface SubjectTopperResult {
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  topperMarks: number;
  maxMarks: number;
  toppers: RankedTopper[];
}

@Injectable()
export class ToppersService {
  constructor(
    private readonly repository: ToppersRepository,
    private readonly strategyFactory: TopperStrategyFactory,
    private readonly prisma: PrismaClient,
  ) {}

  async findSubjectToppers(params: {
    branchId?: string;
    schemeId?: string;
    semester?: number;
    academicYearId: string;
  }): Promise<SubjectTopper[]> {
    return this.repository.findSubjectToppers(params);
  }

  async findClassToppers(params: {
    branchId?: string;
    schemeId?: string;
    semester?: number;
    academicYearId: string;
    limit?: number;
  }): Promise<ClassTopper> {
    return this.repository.findClassToppers(params);
  }

  /**
   * Toppers for every subject in the supplied filter window, calculated
   * using the rules from the subject's scheme.
   */
  async findSubjectWiseToppers(filters: {
    branchId: string;
    schemeId: string;
    semester: number;
    academicYearId: string;
  }): Promise<SubjectTopperResult[]> {
    const ctx = await this.repository.loadClassContext(filters);
    const subjects = ctx.subjects.filter(
      (s) =>
        s.branchId === filters.branchId &&
        s.schemeId === filters.schemeId &&
        s.semester === filters.semester,
    );
    const summaries = this.repository.buildStudentSummaries(
      ctx.students,
      ctx.marks,
      subjects,
    );

    const results: SubjectTopperResult[] = [];
    for (const subject of subjects) {
      const studentScores = ctx.students
        .map((stu) => {
          const stuMarks = ctx.marks.filter(
            (m) => m.subjectId === subject.id && m.studentId === stu.id,
          );
          const total = stuMarks.reduce(
            (sum, m) => sum + (m.isAbsent ? 0 : m.marksObtained),
            0,
          );
          const max = stuMarks.reduce((sum, m) => sum + m.maxMarks, 0);
          return {
            studentId: stu.id,
            rollNo: stu.rollNo,
            name: stu.name,
            marks: total,
            max: max,
            pct: max > 0 ? (total / max) * 100 : 0,
          };
        })
        .filter((s) => s.max > 0);

      if (studentScores.length === 0) continue;

      const topMark = Math.max(...studentScores.map((s) => s.marks));
      const winners = studentScores
        .filter((s) => s.marks === topMark)
        .map((s, idx) => {
          const tied = studentScores.filter((x) => x.marks === topMark).length > 1;
          return {
            rank: 1,
            studentId: s.studentId,
            rollNo: s.rollNo,
            name: s.name,
            score: s.marks,
            percentage: Number(s.pct.toFixed(2)),
            isTie: tied,
          } as RankedTopper;
        });
      results.push({
        subjectId: subject.id,
        subjectCode: subject.code,
        subjectName: subject.name,
        topperMarks: topMark,
        maxMarks: subject.maxMarks,
        toppers: winners,
      });
    }

    return results;
  }

  /**
   * Class leaderboard computed via the chosen strategy.
   */
  async findClassToppersByRule(
    filters: {
      branchId: string;
      schemeId: string;
      semester: number;
      academicYearId: string;
    },
    rule: RankingRule,
    limit?: number,
  ): Promise<{
    rule: string;
    totalStudents: number;
    ranking: RankedTopper[];
  }> {
    const ctx = await this.repository.loadClassContext(filters);
    const summaries = this.repository.buildStudentSummaries(
      ctx.students,
      ctx.marks,
      ctx.subjects,
    );

    const strategy = this.strategyFactory.get(rule);
    let ranked = strategy.rank({
      students: ctx.students,
      marks: ctx.marks,
      subjects: ctx.subjects,
      summaries,
    });
    if (limit !== undefined && limit > 0) ranked = ranked.slice(0, limit);

    return {
      rule: strategy.name,
      totalStudents: summaries.size,
      ranking: ranked,
    };
  }

  /** Useful helper for admins to see the list of supported ranking rules. */
  listSupportedRules(): string[] {
    return this.strategyFactory.listSupported();
  }
}
