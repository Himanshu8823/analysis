import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import type { Mark, Subject } from '@prisma/client';
import { MarksRepository } from './marks.repository';
import { MarksCalculatorService } from './calculator.service';
import { CalculatorFactory } from './calculator';
import { CreateMarkDto, BulkCreateMarksDto, UpdateMarkDto } from './dto';
import type { StudentCalculationResult } from './calculator';

export interface ClassCalculationFilter {
  branchId: string;
  schemeId: string;
  semester: number;
  academicYearId: string;
}

export interface ClassStudentResult {
  studentId: string;
  rollNo: string;
  name: string;
  result: StudentCalculationResult;
}

@Injectable()
export class MarksService {
  constructor(
    private readonly repository: MarksRepository,
    private readonly calculator: MarksCalculatorService,
    private readonly factory: CalculatorFactory,
    private readonly prisma: PrismaClient,
  ) {}

  async create(dto: CreateMarkDto, createdBy: string): Promise<Mark> {
    return this.repository.create(dto, createdBy);
  }

  async createBulk(dto: BulkCreateMarksDto, createdBy: string): Promise<Mark[]> {
    return this.repository.createBulk(dto, createdBy);
  }

  async findAll(params: {
    studentId?: string;
    subjectId?: string;
    examType?: string;
    academicYearId?: string;
  }) {
    return this.repository.findAll(params);
  }

  async findById(id: string): Promise<Mark> {
    const mark = await this.repository.findById(id);
    if (!mark) throw new NotFoundException('Mark not found');
    return mark;
  }

  async update(id: string, dto: UpdateMarkDto, updatedBy: string): Promise<Mark> {
    return this.repository.update(id, dto, updatedBy);
  }

  async delete(id: string): Promise<void> {
    return this.repository.delete(id);
  }

  /**
   * Calculate a single student's result using scheme-aware calculator.
   * Returns aggregated totals + per-subject breakdown.
   */
  async calculateStudentResult(
    studentId: string,
    academicYearId: string,
  ): Promise<StudentCalculationResult> {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      include: { scheme: true },
    });
    if (!student) throw new NotFoundException(`Student ${studentId} not found`);

    const scheme = student.scheme;
    if (!scheme) {
      throw new NotFoundException(
        `Scheme for student ${studentId} could not be resolved`,
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

    const calc = this.factory.fromScheme(scheme);
    return calc.calculateStudentResult(studentId, marks, subjects as Subject[]);
  }

  /**
   * Bulk-evaluate every student in the supplied class. Subjects are resolved per
   * student based on branch/scheme/semester.
   */
  async calculateClassResult(
    filters: ClassCalculationFilter,
  ): Promise<{ schemeName: string; results: ClassStudentResult[] }> {
    const scheme = await this.prisma.scheme.findUnique({
      where: { id: filters.schemeId },
    });
    if (!scheme) {
      throw new NotFoundException(`Scheme ${filters.schemeId} not found`);
    }
    const calc = this.factory.fromScheme(scheme);

    const students = await this.prisma.student.findMany({
      where: {
        branchId: filters.branchId,
        schemeId: filters.schemeId,
        semester: filters.semester,
        academicYearId: filters.academicYearId,
        isActive: true,
      },
      orderBy: { rollNo: 'asc' },
    });

    const subjects = await this.prisma.subject.findMany({
      where: {
        branchId: filters.branchId,
        schemeId: filters.schemeId,
        semester: filters.semester,
        isActive: true,
      },
    });

    const marks = await this.prisma.mark.findMany({
      where: {
        academicYearId: filters.academicYearId,
        student: {
          branchId: filters.branchId,
          schemeId: filters.schemeId,
          semester: filters.semester,
        },
        isAbsent: false,
        isWithheld: false,
      },
      include: { subject: true },
    });

    const marksByStudent = new Map<string, Mark[]>();
    for (const m of marks) {
      const list = marksByStudent.get(m.studentId) ?? [];
      list.push(m as Mark);
      marksByStudent.set(m.studentId, list);
    }

    const results: ClassStudentResult[] = students.map((student) => {
      const studentMarks = marksByStudent.get(student.id) ?? [];
      const result = calc.calculateStudentResult(
        student.id,
        studentMarks,
        subjects as Subject[],
      );
      return {
        studentId: student.id,
        rollNo: student.rollNo,
        name: student.name,
        result,
      };
    });

    return { schemeName: scheme.name, results };
  }

  /** Expose the calculator factory for cross-module reuse (reports, etc). */
  getFactory(): CalculatorFactory {
    return this.factory;
  }
}
