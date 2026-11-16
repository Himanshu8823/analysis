import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import type { Mark, Subject } from '@prisma/client';
import { MarksRepository } from './marks.repository';
import { MarksAuthorisationService } from './marks.authorisation.service';
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

/**
 * The marks service.
 *
 * Every authorisation decision lives here, in the service layer — not only in
 * the controller's `@Permissions()` decorator. A decorator alone is bypassable
 * by any code path that calls the service directly, and the rule being
 * enforced here ("only for the subjects you were allocated") is one a
 * decorator cannot express at all.
 *
 * The single write gate is {@link MarksAuthorisationService.assertMayWrite}.
 * Every write path — single create, bulk create, update, delete — goes
 * through it, so no path can drift from the others.
 */
@Injectable()
export class MarksService {
  constructor(
    private readonly repository: MarksRepository,
    private readonly factory: CalculatorFactory,
    private readonly prisma: PrismaClient,
    private readonly authorisation: MarksAuthorisationService
  ) {}

  // ---------------------------------------------------------------------
  // Writes
  // ---------------------------------------------------------------------

  /**
   * Writes one mark.
   *
   * The caller must be allocated to the offering, unless they are the exam
   * cell acting on an offering no teacher holds. A write over a teacher's
   * subject is a *correction*: it needs the `marks:write` permission, a
   * reason, and it is recorded differently in the audit trail.
   */
  async create(
    dto: CreateMarkDto,
    createdBy: string,
    options: { isCorrection?: boolean; reason?: string } = {}
  ): Promise<Mark> {
    const { overriddenTeacher } = await this.authorisation.assertMayWrite(
      createdBy,
      dto.subjectOfferingId,
      dto.academicYearId,
      options
    );
    await this.assertStudentInOfferingBranch(dto.studentId, dto.subjectOfferingId);

    /**
     * A correction is a different operation from an ordinary entry, so it is
     * written differently: the value it replaces is kept, the teacher whose
     * work it replaces is named, and the reason is stored with it.
     */
    if (options.isCorrection) {
      const reason = this.requireReason(options.reason);
      return this.repository.createAsCorrection(dto, createdBy, {
        reason,
        overriddenTeacherId: overriddenTeacher?.id ?? null,
        overriddenTeacherName: overriddenTeacher?.name ?? null,
      });
    }

    return this.repository.create(dto, createdBy);
  }

  /**
   * A correction without a reason is not a correction — it is an ordinary
   * write that happens to have found a way around the rule. The reason is
   * what makes the change explainable to whoever looks at it later.
   */
  private requireReason(reason: string | undefined): string {
    const trimmed = reason?.trim();
    if (!trimmed) {
      throw new BadRequestException(
        'Give a reason for the correction. It is recorded against your name and shown to the teacher whose mark was changed.'
      );
    }
    return trimmed;
  }

  /**
   * Writes many marks.
   *
   * The batch is refused as a whole if any row fails the check. A partial
   * write would leave the member unable to tell which rows were saved.
   */
  async createBulk(
    dto: BulkCreateMarksDto,
    createdBy: string,
    options: { isCorrection?: boolean; reason?: string } = {}
  ): Promise<Mark[]> {
    await this.authorisation.assertMayWriteBulk(
      createdBy,
      dto.marks.map((mark) => ({
        subjectOfferingId: mark.subjectOfferingId,
        academicYearId: mark.academicYearId,
      })),
      options
    );

    // Every row must also belong to the offering's branch — otherwise a
    // teacher allocated to Computer Networks could write a mark for a
    // student in Mechanical Engineering.
    for (const mark of dto.marks) {
      await this.assertStudentInOfferingBranch(mark.studentId, mark.subjectOfferingId);
    }

    return this.repository.createBulk(dto, createdBy);
  }

  /**
   * Changes an existing mark.
   *
   * The mark is resolved first — it carries the offering and the academic
   * year — and the caller is checked against *those*, not against a
   * parameter they supplied. Before this, any member holding the mark-entry
   * permission could overwrite any student's mark in the college by id.
   */
  async update(
    id: string,
    dto: UpdateMarkDto,
    updatedBy: string,
    options: { isCorrection?: boolean; reason?: string } = {}
  ): Promise<Mark> {
    const mark = await this.repository.findById(id);
    if (!mark) throw new NotFoundException('This mark entry no longer exists.');

    await this.authorisation.assertMayWrite(
      updatedBy,
      mark.subjectOfferingId,
      mark.academicYearId,
      options
    );

    return this.repository.update(id, dto, updatedBy);
  }

  /**
   * Removes an existing mark.
   *
   * Deleting a mark is a write to the offering it belongs to, so it is
   * checked the same way — otherwise a teacher could delete another
   * teacher's work by id.
   */
  async delete(
    id: string,
    deletedBy: string,
    options: { isCorrection?: boolean; reason?: string } = {}
  ): Promise<void> {
    const mark = await this.repository.findById(id);
    if (!mark) throw new NotFoundException('This mark entry no longer exists.');

    await this.authorisation.assertMayWrite(
      deletedBy,
      mark.subjectOfferingId,
      mark.academicYearId,
      options
    );

    await this.repository.delete(id);
  }

  /**
   * Refuses a write whose student is not in the offering's branch.
   *
   * The offering belongs to one branch and the mark must belong to the same
   * class. Without this, an allocated teacher could reach a student in
   * another branch by naming them in the request body.
   */
  private async assertStudentInOfferingBranch(
    studentId: string,
    subjectOfferingId: string
  ): Promise<void> {
    const offering = await this.prisma.subjectOffering.findUnique({
      where: { id: subjectOfferingId },
      select: { branchId: true },
    });
    if (!offering) {
      throw new NotFoundException('That subject offering no longer exists.');
    }

    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      select: { branchId: true },
    });
    if (!student) {
      throw new NotFoundException('That student no longer exists.');
    }

    if (student.branchId !== offering.branchId) {
      throw new ForbiddenException(
        'That student is not in the class this subject is taught to, so their mark cannot be entered here.'
      );
    }
  }

  // ---------------------------------------------------------------------
  // Reads
  // ---------------------------------------------------------------------

  /**
   * Lists marks.
   *
   * The scope filter is applied by the caller — see
   * {@link resolveReadScope} — and passed in already narrowed. This method
   * does not re-derive it, so the same filtered set cannot be widened by a
   * second code path.
   */
  async findAll(params: {
    studentId?: string;
    subjectOfferingId?: string | string[];
    subjectId?: string;
    examType?: string;
    academicYearId?: string;
    branchId?: string | string[];
  }) {
    return this.repository.findAll(params);
  }

  async findById(id: string): Promise<Mark> {
    const mark = await this.repository.findById(id);
    if (!mark) throw new NotFoundException('This mark entry no longer exists.');
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
      throw new BadRequestException('Choose the academic year to calculate.');
    }
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      include: { scheme: true },
    });
    if (!student) throw new NotFoundException('That student no longer exists.');

    const scheme = student.scheme;
    if (!scheme) {
      throw new NotFoundException('The scheme for this student could not be resolved.');
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
      throw new BadRequestException('Choose the academic year to calculate.');
    }
    const scheme = await this.prisma.scheme.findUnique({
      where: { id: filters.schemeId },
    });
    if (!scheme) {
      throw new NotFoundException('That scheme no longer exists.');
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

  /**
   * The subject offering a mark belongs to, with the fields a write check
   * needs.
   */
  async findOfferingOfMark(
    id: string
  ): Promise<{ subjectOfferingId: string; academicYearId: string; branchId: string } | null> {
    const mark = await this.prisma.mark.findUnique({
      where: { id },
      select: {
        subjectOfferingId: true,
        academicYearId: true,
        subjectOffering: { select: { branchId: true } },
      },
    });
    if (!mark) return null;
    return {
      subjectOfferingId: mark.subjectOfferingId,
      academicYearId: mark.academicYearId,
      branchId: mark.subjectOffering.branchId,
    };
  }

  /** Expose the calculator factory for cross-module reuse (reports, etc). */
  getFactory(): CalculatorFactory {
    return this.factory;
  }
}
