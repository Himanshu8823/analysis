import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { MarksRepository } from './marks.repository';
import { CalculatorFactory } from './calculator';
import type {
  SubjectCalculationResult,
  StudentCalculationResult,
} from './calculator';
import type { Mark, Subject } from '@prisma/client';

/**
 * Backwards-compatible (legacy) calculator that defers to the new factory
 * when a scheme is supplied. If the student's scheme can't be inferred, falls
 * back to a simple aggregate pass/fail at 40% — same behaviour as the original
 * implementation that this service replaces.
 */
@Injectable()
export class MarksCalculatorService {
  constructor(
    private readonly repository: MarksRepository,
    private readonly factory: CalculatorFactory,
    private readonly prisma: PrismaClient,
  ) {}

  /**
   * Legacy signature returning per-subject CalculatedResult[], preserving the
   * previous behaviour for callers that haven't migrated.
   */
  async calculateStudentResult(
    studentId: string,
    academicYearId: string,
  ): Promise<SubjectCalculationResult[]> {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      include: { scheme: true },
    });
    if (!student) throw new NotFoundException(`Student ${studentId} not found`);

    const marks = await this.repository.findByStudentAndYear(
      studentId,
      academicYearId,
    );

    const subjects = await this.prisma.subject.findMany({
      where: {
        branchId: student.branchId,
        schemeId: student.schemeId,
        semester: student.semester,
        isActive: true,
      },
    });

    if (student.scheme) {
      const calc = this.factory.fromScheme(student.scheme);
      const studentResult = calc.calculateStudentResult(
        studentId,
        marks,
        subjects as Subject[],
      );
      return studentResult.subjectResults;
    }

    // Fallback: aggregate pass/fail at 40% per subject.
    const bySubject = new Map<string, Array<Mark & { subject: Subject }>>();
    for (const m of marks) {
      const list = bySubject.get(m.subjectId) ?? [];
      list.push(m);
      bySubject.set(m.subjectId, list);
    }
    const out: SubjectCalculationResult[] = [];
    for (const [, subjectMarks] of bySubject) {
      const subject = subjectMarks[0]?.subject;
      if (!subject) continue;
      const totalMarks = subjectMarks.reduce(
        (sum, m) => sum + (m.isAbsent || m.isWithheld ? 0 : m.marksObtained),
        0,
      );
      const maxTotalMarks = subjectMarks.reduce(
        (sum, m) => sum + m.maxMarks,
        0,
      );
      const isAbsentAny = subjectMarks.some((m) => m.isAbsent);
      const isWithheldAny = subjectMarks.some((m) => m.isWithheld);
      const isPass =
        !isAbsentAny &&
        !isWithheldAny &&
        maxTotalMarks > 0 &&
        (totalMarks / maxTotalMarks) * 100 >= 40;

      out.push({
        breakdown: subjectMarks.map((m) => ({
          type: m.examType,
          obtained: m.isAbsent ? 0 : m.marksObtained,
          max: m.maxMarks,
          isAbsent: m.isAbsent,
        })),
        totalObtained: totalMarks,
        totalMax: maxTotalMarks,
        percentage:
          maxTotalMarks > 0 ? (totalMarks / maxTotalMarks) * 100 : 0,
        isPass,
        reason: isPass ? 'Pass' : 'Fail',
      });
    }
    return out;
  }

  /** New shape using the factory. */
  async calculateStudentResultV2(
    studentId: string,
    academicYearId: string,
  ): Promise<StudentCalculationResult> {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      include: { scheme: true },
    });
    if (!student || !student.scheme) {
      throw new NotFoundException(
        `Student or scheme for ${studentId} could not be resolved`,
      );
    }
    const subjects = await this.prisma.subject.findMany({
      where: {
        branchId: student.branchId,
        schemeId: student.schemeId,
        semester: student.semester,
        isActive: true,
      },
    });
    const marks = await this.repository.findByStudentAndYear(
      studentId,
      academicYearId,
    );
    const calc = this.factory.fromScheme(student.scheme);
    return calc.calculateStudentResult(
      studentId,
      marks,
      subjects as Subject[],
    );
  }
}
