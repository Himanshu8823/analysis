import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { StudentsRepository } from './students.repository';
import { AuthorisationService } from '@/common/services/authorisation.service';
import { CreateStudentDto, UpdateStudentDto, BulkImportStudentsDto } from './dto';
import type { ParsedStudentRow } from './student-import.parser';
import type { Prisma, Student } from '@prisma/client';
import { NO_LINKED_STUDENT_MESSAGE } from './student-self.service';

export interface BulkImportResult {
  inserted: number;
  failed: number;
  errors: Array<{ row: number; error: string }>;
}

/**
 * A student record with the relations the roster listing shows.
 *
 * The owner-scoped reads return the same shape as the general listing, so a
 * client can reuse the same table without special-casing the student view.
 */
export type OwnStudent = Prisma.StudentGetPayload<{
  include: {
    branch: { select: { id: true; code: true; name: true } };
    scheme: { select: { id: true; name: true } };
    academicYear: { select: { id: true; year: true } };
  };
}>;

/**
 * The permission that guards writing a student's **sensitive identity**
 * data — the national identity reference, the blood group and the photo.
 *
 * It is separate from `students:write` because recording an identity
 * number is a different act from recording a phone number: it is the one
 * field a teacher has no reason to write, and one that should reach the
 * desk of the exam cell.
 */
export const STUDENT_SENSITIVE_WRITE_PERMISSION = 'students:read_sensitive';

/**
 * The permission that guards writing a student's **guardian** details.
 */
export const STUDENT_GUARDIAN_WRITE_PERMISSION = 'students:read_guardian';

@Injectable()
export class StudentsService {
  constructor(
    private readonly repository: StudentsRepository,
    private readonly prisma: PrismaClient,
    private readonly authorisation: AuthorisationService
  ) {}

  /**
   * Creates a student.
   *
   * The branch is checked against the caller's scope before the write. A
   * branch-scoped member cannot file a student into another branch — not even
   * by naming the branch in the request body.
   */
  async create(dto: CreateStudentDto, createdBy: string): Promise<Student> {
    await this.authorisation.assertBranchWritable(createdBy, dto.branchId, 'student');
    await this.assertMayWriteDetails(createdBy, dto);

    const student = await this.repository.create(dto, createdBy);

    /**
     * The enrolment history starts with the semester the student joins in.
     *
     * Without this the student would have no enrolment row, and their
     * marks would have no semester to be attributed to (§2.8.3).
     */
    await this.recordEnrolment(student, true);

    return student;
  }

  async findAll(params: {
    page?: number;
    pageSize?: number;
    branchId?: string | string[];
    schemeId?: string;
    semester?: number;
    academicYearId?: string;
    search?: string;
  }) {
    return this.repository.findAll(params);
  }

  async findById(id: string): Promise<Student> {
    const student = await this.repository.findById(id);
    if (!student) throw new NotFoundException('Student not found');
    return student;
  }

  /**
   * The owner-scoped list: the single student record that belongs to the
   * logged-in user.
   *
   * A student account may only ever see itself, so this returns one row (or
   * none) — never a page of the roster. The shape mirrors `findAll` so a
   * client can reuse the same list component.
   */
  async findOwn(userId: string): Promise<{
    items: OwnStudent[];
    meta: { page: number; pageSize: number; total: number; totalPages: number };
  }> {
    const student = await this.resolveOwnStudent(userId);
    return {
      items: student ? [student] : [],
      meta: {
        page: 1,
        pageSize: 1,
        total: student ? 1 : 0,
        totalPages: student ? 1 : 0,
      },
    };
  }

  /**
   * The owner-scoped read of a single student record.
   *
   * The requested id has to belong to the caller. A mismatch is a
   * `ForbiddenException` rather than a `NotFoundException` — the record
   * exists, the caller simply may not see it.
   */
  async findOneOwn(userId: string, studentId: string): Promise<OwnStudent> {
    const own = await this.resolveOwnStudent(userId);
    if (!own) throw new NotFoundException(NO_LINKED_STUDENT_MESSAGE);
    if (own.id !== studentId) {
      throw new ForbiddenException('You can only access your own student record');
    }
    return own;
  }

  /**
   * Resolves the student record linked to a user account.
   *
   * `Student.userId` is the link the examination cell provisions. A user
   * with no linked record simply has no academic identity.
   *
   * The branch, scheme and academic year come along because the owner-scoped
   * reads present the same columns as the roster listing.
   */
  private async resolveOwnStudent(userId: string): Promise<OwnStudent | null> {
    if (!userId) return null;
    return this.prisma.student.findFirst({
      where: { userId, isActive: true },
      include: {
        branch: { select: { id: true, code: true, name: true } },
        scheme: { select: { id: true, name: true } },
        academicYear: { select: { id: true, year: true } },
      },
    });
  }

  /**
   * Changes a student.
   *
   * The record's own branch is checked, and so is any branch the caller is
   * trying to move the student into. A member may edit a student in their
   * own branch; they may not use the edit form to move a student into — or
   * out of — another branch.
   *
   * The sensitive fields are gated separately, because the caller may well
   * be allowed to correct a phone number and not allowed to write an
   * identity number.
   */
  async update(id: string, dto: UpdateStudentDto, updatedBy: string): Promise<Student> {
    const existing = await this.repository.findById(id);
    if (!existing) throw new NotFoundException('That student no longer exists.');

    await this.authorisation.assertBranchWritable(updatedBy, existing.branchId, 'student');

    if (dto.branchId !== undefined && dto.branchId !== existing.branchId) {
      await this.authorisation.assertBranchWritable(updatedBy, dto.branchId, 'student');
    }

    await this.assertMayWriteDetails(updatedBy, dto);

    const student = await this.repository.update(id, dto, updatedBy);

    /**
     * The enrolment history follows the student.
     *
     * When the student advances to a new semester, the old enrolment row
     * stops being "current" and a new one is written. The old row is kept —
     * that is the whole point of it (§2.8.3).
     */
    await this.recordEnrolment(student, true);

    return student;
  }

  /**
   * Archives a student.
   *
   * The write is scoped the same way an edit is: the record's branch must be
   * within the caller's reach.
   */
  async delete(id: string, deletedBy: string): Promise<void> {
    const existing = await this.repository.findById(id);
    if (!existing) throw new NotFoundException('That student no longer exists.');

    await this.authorisation.assertBranchWritable(deletedBy, existing.branchId, 'student');

    await this.repository.softDelete(id, deletedBy);
  }

  /**
   * Refuses a write that carries fields the caller may not write.
   *
   * The check is on the *fields present in the request*, not on the whole
   * record: a member who may not write an identity number can still edit a
   * phone number, as long as they do not name the identity number.
   */
  private async assertMayWriteDetails(
    userId: string,
    dto: CreateStudentDto | UpdateStudentDto
  ): Promise<void> {
    const permissions = await this.authorisation.permissionsOf(userId);

    const writesSensitive =
      dto.nationalId !== undefined || dto.bloodGroup !== undefined || dto.photoUrl !== undefined;

    if (writesSensitive && !permissions.includes(STUDENT_SENSITIVE_WRITE_PERMISSION)) {
      throw new ForbiddenException(
        'You are not allowed to record the student’s identity document details.'
      );
    }

    const writesGuardian =
      dto.guardianName !== undefined ||
      dto.guardianRelation !== undefined ||
      dto.guardianPhone !== undefined ||
      dto.guardianEmail !== undefined ||
      dto.guardianOccupation !== undefined ||
      dto.guardian2Name !== undefined ||
      dto.guardian2Relation !== undefined ||
      dto.guardian2Phone !== undefined ||
      dto.guardian2Email !== undefined ||
      dto.guardian2Occupation !== undefined;

    if (writesGuardian && !permissions.includes(STUDENT_GUARDIAN_WRITE_PERMISSION)) {
      throw new ForbiddenException('You are not allowed to record the student’s guardian details.');
    }
  }

  /**
   * Keeps the enrolment history in step with the student's current
   * semester.
   *
   * One row per semester the student has been in. The row for the semester
   * they are in now is flagged as current, and the earlier rows are kept —
   * they are what makes the multi-semester history queryable (§2.8.3).
   */
  private async recordEnrolment(
    student: Pick<
      Student,
      'id' | 'branchId' | 'schemeId' | 'semester' | 'academicYearId' | 'section'
    >,
    isCurrent: boolean
  ): Promise<void> {
    /**
     * The earlier rows stop being current. Only one semester is current at
     * a time — a student is in one semester, not two.
     */
    await this.prisma.studentEnrollment.updateMany({
      where: { studentId: student.id, isCurrent: true },
      data: { isCurrent: false },
    });

    await this.prisma.studentEnrollment.upsert({
      where: {
        studentId_semester_academicYearId: {
          studentId: student.id,
          semester: student.semester,
          academicYearId: student.academicYearId,
        },
      },
      create: {
        studentId: student.id,
        branchId: student.branchId,
        schemeId: student.schemeId,
        semester: student.semester,
        academicYearId: student.academicYearId,
        section: student.section,
        isCurrent,
      },
      update: {
        branchId: student.branchId,
        schemeId: student.schemeId,
        section: student.section,
        isCurrent,
      },
    });
  }

  /**
   * Imports students from parsed rows. The scope (branch, scheme, batch,
   * academic year, year, semester) can come from the file, from the request
   * body, or from both — the file wins, the body fills the gaps.
   */
  async bulkImport(dto: BulkImportStudentsDto, importedBy: string): Promise<BulkImportResult> {
    if (!dto.rows.length) {
      throw new BadRequestException('No rows to import');
    }

    const scope = await this.resolveScope(dto);
    const merged = dto.rows.map((row) => ({
      rollNo: row.rollNo.trim(),
      name: row.name.trim(),
      branchId: row.branchId ?? scope.branchId,
      semester: row.semester ?? scope.semester,
      schemeId: row.schemeId ?? scope.schemeId,
      batchId: row.batchId ?? scope.batchId,
      academicYearId: row.academicYearId ?? scope.academicYearId,
    }));

    /**
     * Every row must land in a branch the importer may write to.
     *
     * A row that names its own branch — which the JSON import allows — is
     * checked the same way as one that inherits the file's scope. Without
     * this, a branch-scoped member could import a file full of students
     * belonging to another branch.
     */
    const branchIds = [...new Set(merged.map((row) => row.branchId).filter(Boolean))];
    for (const branchId of branchIds) {
      await this.authorisation.assertBranchWritable(importedBy, branchId, 'student');
    }

    const invalid = merged.findIndex(
      (row) =>
        !row.branchId || !row.semester || !row.schemeId || !row.batchId || !row.academicYearId
    );
    if (invalid !== -1) {
      const row = merged[invalid];
      const missing = [
        !row.branchId && 'branch',
        !row.schemeId && 'scheme',
        !row.batchId && 'batch',
        !row.academicYearId && 'academic year',
        !row.semester && 'semester',
      ].filter(Boolean);
      throw new BadRequestException(
        `Row ${invalid + 1} is missing: ${missing.join(', ')}. ` +
          'Supply the scope for the whole file or on each row.'
      );
    }

    const result = await this.repository.bulkCreate(merged as CreateStudentDto[]);
    return {
      inserted: result.inserted,
      failed: result.errors.length,
      errors: result.errors,
    };
  }

  /**
   * Imports students from an uploaded spreadsheet.
   *
   * The sheet carries only the roll number and the name. The class details
   * are supplied once as query parameters — a multipart body cannot carry
   * the nested JSON the DTO describes — and they apply to every row.
   */
  async bulkImportFile(
    rows: ParsedStudentRow[],
    scope: {
      branchId?: string;
      schemeId?: string;
      batchId?: string;
      academicYearId?: string;
      semester?: number;
    },
    parseErrors: Array<{ row: number; error: string }>,
    importedBy: string
  ): Promise<BulkImportResult> {
    if (!rows.length) {
      if (parseErrors.length) {
        return { inserted: 0, failed: parseErrors.length, errors: parseErrors };
      }
      throw new BadRequestException('No rows to import');
    }

    /**
     * The scope is chosen by the operator on the import page, so it is
     * required. Falling back to a default would file students under a class
     * nobody picked.
     */
    if (!scope.branchId || !scope.schemeId || !scope.batchId || !scope.academicYearId) {
      throw new BadRequestException(
        'Select the branch, scheme, academic year and batch before importing'
      );
    }

    const dto: BulkImportStudentsDto = {
      rows: rows.map((row) => ({
        rollNo: row.rollNo,
        name: row.name,
      })),
      ...scope,
    };

    const result = await this.bulkImport(dto, importedBy);
    return {
      inserted: result.inserted,
      failed: result.failed + parseErrors.length,
      errors: [...parseErrors, ...result.errors].sort((a, b) => a.row - b.row),
    };
  }

  /**
   * Validates the file-level scope and fills in the missing pieces from the
   * active academic year and the branch's default scheme.
   */
  private async resolveScope(dto: BulkImportStudentsDto): Promise<{
    branchId?: string;
    schemeId?: string;
    batchId?: string;
    academicYearId?: string;
    semester?: number;
  }> {
    const scope = {
      branchId: dto.branchId,
      schemeId: dto.schemeId,
      batchId: dto.batchId,
      academicYearId: dto.academicYearId,
      semester: dto.semester,
    };

    if (scope.branchId) {
      const branch = await this.prisma.branch.findUnique({
        where: { id: scope.branchId },
        select: { id: true },
      });
      if (!branch) throw new BadRequestException('The selected branch does not exist');
    }

    if (scope.schemeId) {
      const scheme = await this.prisma.scheme.findUnique({
        where: { id: scope.schemeId },
        select: { id: true },
      });
      if (!scheme) throw new BadRequestException('The selected scheme does not exist');
    }

    if (scope.batchId) {
      const batch = await this.prisma.batch.findUnique({
        where: { id: scope.batchId },
        select: { id: true },
      });
      if (!batch) throw new BadRequestException('The selected batch does not exist');
    }

    if (scope.academicYearId) {
      const year = await this.prisma.academicYear.findUnique({
        where: { id: scope.academicYearId },
        select: { id: true },
      });
      if (!year) throw new BadRequestException('The selected academic year does not exist');
    }

    return scope;
  }
}
