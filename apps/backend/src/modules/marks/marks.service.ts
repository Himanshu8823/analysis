import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import type { Mark, Subject } from '@prisma/client';
import { MarksRepository } from './marks.repository';
import { CalculatorFactory } from './calculator';
import { CreateMarkDto, BulkCreateMarksDto, UpdateMarkDto } from './dto';
import type { StudentCalculationResult, SubjectOfferingContext } from './calculator';

export interface ClassCalculationFilter {
  branchId: string;
  schemeId: string;
  semester?: number;
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
    private readonly factory: CalculatorFactory,
    private readonly prisma: PrismaClient
  ) {}

  async create(dto: CreateMarkDto, createdBy: string): Promise<Mark> {
    return this.repository.create(dto, createdBy);
  }

  async createBulk(dto: BulkCreateMarksDto, createdBy: string): Promise<Mark[]> {
    return this.repository.createBulk(dto, createdBy);
  }

  async findAll(params: {
    studentId?: string;
    subjectOfferingId?: string;
    subjectId?: string;
    examType?: string;
    academicYearId?: string;
    branchId?: string | string[];
  }) {
    return this.repository.findAll(params);
  }

  async findById(id: string): Promise<Mark> {
    const mark = await this.repository.findById(id);
    if (!mark) throw new NotFoundException('Mark not found');
    return mark;
  }

  /**
   * The branch a mark's student belongs to.
   *
   * `null` when the mark does not exist — the caller turns that into a 404.
   */
  async findBranchIdOfMark(id: string): Promise<string | null> {
    return this.repository.findStudentBranchId(id);
  }

  /**
   * The branch a student belongs to.
   *
   * `null` when the student does not exist — the caller turns that into a 404.
   */
  async findBranchIdOfStudent(studentId: string): Promise<string | null> {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      select: { branchId: true },
    });
    return student?.branchId ?? null;
  }

  async update(id: string, dto: UpdateMarkDto, updatedBy: string): Promise<Mark> {
    return this.repository.update(id, dto, updatedBy);
  }

  async delete(id: string): Promise<void> {
    return this.repository.delete(id);
  }

  /**
   * The subject offerings that make up one class.
   *
   * A class is a branch + semester + scheme, so the offerings are the subjects
   * actually taught to that class — not every subject in the catalogue.
   */
  private async offeringsForClass(params: {
    branchId: string;
    schemeId: string;
    semester?: number;
    academicYearId?: string;
  }): Promise<SubjectOfferingContext[]> {
    const rows = await this.prisma.subjectOffering.findMany({
      where: {
        branchId: params.branchId,
        schemeId: params.schemeId,
        ...(params.semester !== undefined ? { semester: params.semester } : {}),
        ...(params.academicYearId ? { academicYearId: params.academicYearId } : {}),
        isActive: true,
      },
      include: { subject: true },
      orderBy: { subject: { code: 'asc' } },
    });

    return rows.map((o) => ({
      id: o.id,
      semester: o.semester,
      subject: o.subject as Subject,
    }));
  }

  /**
   * Calculate a single student's result using scheme-aware calculator.
   * Returns aggregated totals + per-subject breakdown.
   */
  async calculateStudentResult(
    studentId: string,
    academicYearId: string
  ): Promise<StudentCalculationResult> {
    if (!academicYearId) {
      throw new BadRequestException('academicYearId is required');
    }
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      include: { scheme: true },
    });
    if (!student) throw new NotFoundException(`Student ${studentId} not found`);

    const scheme = student.scheme;
    if (!scheme) {
      throw new NotFoundException(`Scheme for student ${studentId} could not be resolved`);
    }

    const offerings = await this.offeringsForClass({
      branchId: student.branchId,
      schemeId: student.schemeId,
      semester: student.semester,
      academicYearId,
    });

    const marks = await this.repository.findByStudentAndYear(studentId, academicYearId);

    const calc = this.factory.fromScheme(scheme);
    return calc.calculateStudentResult(studentId, marks, offerings);
  }

  /**
   * Bulk-evaluate every student in the supplied class. Offerings are resolved
   * once for the class and reused for every student.
   */
  async calculateClassResult(
    filters: ClassCalculationFilter
  ): Promise<{ schemeName: string; results: ClassStudentResult[] }> {
    if (!filters.academicYearId) {
      throw new BadRequestException('academicYearId is required');
    }
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

    const offerings = await this.offeringsForClass({
      branchId: filters.branchId,
      schemeId: filters.schemeId,
      semester: filters.semester,
      academicYearId: filters.academicYearId,
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
      include: { subjectOffering: { include: { subject: true } } },
    });

    const marksByStudent = new Map<string, Mark[]>();
    for (const m of marks) {
      const list = marksByStudent.get(m.studentId) ?? [];
      list.push(m as Mark);
      marksByStudent.set(m.studentId, list);
    }

    const results: ClassStudentResult[] = students.map((student) => {
      const studentMarks = marksByStudent.get(student.id) ?? [];
      const result = calc.calculateStudentResult(student.id, studentMarks, offerings);
      return {
        studentId: student.id,
        rollNo: student.rollNo,
        name: student.name,
        result,
      };
    });

    return { schemeName: scheme.name, results };
  }

  // ---------------------------------------------------------------------
  // Teacher allocation scoping
  // ---------------------------------------------------------------------

  /**
   * Checks that the given teacher is allocated to the subject offering.
   *
   * A teacher may only enter marks for subjects the HOD has allocated to
   * them. Being the class teacher of a class does not by itself allow marks
   * entry — that right comes only from a subject allocation.
   */
  async assertTeacherAllocated(
    teacherId: string,
    subjectOfferingId: string,
    academicYearId: string
  ): Promise<void> {
    const allocation = await this.prisma.teacherSubject.findFirst({
      where: {
        teacherId,
        subjectOfferingId,
        academicYearId,
      },
      select: { id: true },
    });
    if (!allocation) {
      throw new ForbiddenException(
        'You are not allocated to this subject, so you cannot enter marks for it.'
      );
    }
  }

  /**
   * Checks every mark in a bulk write against the teacher's allocations.
   *
   * A bulk write is rejected as a whole rather than partially applied, so a
   * teacher never ends up with half a spreadsheet saved.
   */
  async assertTeacherAllocatedBulk(teacherId: string, marks: CreateMarkDto[]): Promise<void> {
    const offeringIds = [...new Set(marks.map((m) => m.subjectOfferingId))];
    if (offeringIds.length === 0) return;

    const yearIds = [...new Set(marks.map((m) => m.academicYearId))];
    const allocations = await this.prisma.teacherSubject.findMany({
      where: {
        teacherId,
        subjectOfferingId: { in: offeringIds },
        academicYearId: { in: yearIds },
      },
      select: { subjectOfferingId: true, academicYearId: true },
    });

    const allowed = new Set(allocations.map((a) => `${a.subjectOfferingId}:${a.academicYearId}`));
    const offending = marks.find((m) => !allowed.has(`${m.subjectOfferingId}:${m.academicYearId}`));
    if (offending) {
      throw new ForbiddenException(
        'One or more subjects in this request are not allocated to you, so nothing was saved.'
      );
    }
  }

  /** Expose the calculator factory for cross-module reuse (reports, etc). */
  getFactory(): CalculatorFactory {
    return this.factory;
  }
}
