import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { StudentsRepository } from './students.repository';
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

@Injectable()
export class StudentsService {
  constructor(
    private readonly repository: StudentsRepository,
    private readonly prisma: PrismaClient
  ) {}

  async create(dto: CreateStudentDto, createdBy: string): Promise<Student> {
    return this.repository.create(dto, createdBy);
  }

  async findAll(params: {
    page?: number;
    pageSize?: number;
    branchId?: string | string[];
    schemeId?: string;
    currentYear?: number;
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

  async update(id: string, dto: UpdateStudentDto, updatedBy: string): Promise<Student> {
    return this.repository.update(id, dto, updatedBy);
  }

  async delete(id: string, deletedBy: string): Promise<void> {
    return this.repository.softDelete(id, deletedBy);
  }

  /**
   * Imports students from parsed rows. The scope (branch, scheme, batch,
   * academic year, year, semester) can come from the file, from the request
   * body, or from both — the file wins, the body fills the gaps.
   */
  async bulkImport(dto: BulkImportStudentsDto): Promise<BulkImportResult> {
    if (!dto.rows.length) {
      throw new BadRequestException('No rows to import');
    }

    const scope = await this.resolveScope(dto);
    const merged = dto.rows.map((row) => ({
      rollNo: row.rollNo.trim(),
      name: row.name.trim(),
      branchId: row.branchId ?? scope.branchId,
      currentYear: row.currentYear ?? scope.currentYear,
      semester: row.semester ?? scope.semester,
      schemeId: row.schemeId ?? scope.schemeId,
      batchId: row.batchId ?? scope.batchId,
      academicYearId: row.academicYearId ?? scope.academicYearId,
    }));

    const invalid = merged.findIndex(
      (row) =>
        !row.branchId ||
        !row.currentYear ||
        !row.semester ||
        !row.schemeId ||
        !row.batchId ||
        !row.academicYearId
    );
    if (invalid !== -1) {
      const row = merged[invalid];
      const missing = [
        !row.branchId && 'branch',
        !row.schemeId && 'scheme',
        !row.batchId && 'batch',
        !row.academicYearId && 'academic year',
        !row.currentYear && 'year',
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
   * Imports students from an uploaded spreadsheet. The scope is supplied as
   * query parameters because a multipart body cannot carry the nested JSON
   * the DTO describes.
   */
  async bulkImportFile(
    rows: ParsedStudentRow[],
    scope: {
      branchId?: string;
      schemeId?: string;
      batchId?: string;
      academicYearId?: string;
      currentYear?: number;
      semester?: number;
    },
    parseErrors: Array<{ row: number; error: string }>
  ): Promise<BulkImportResult> {
    if (!rows.length) {
      if (parseErrors.length) {
        return { inserted: 0, failed: parseErrors.length, errors: parseErrors };
      }
      throw new BadRequestException('No rows to import');
    }

    const dto: BulkImportStudentsDto = {
      rows: rows.map((row) => ({
        rollNo: row.rollNo,
        name: row.name,
        ...(row.branchId ? { branchId: row.branchId } : {}),
        ...(row.currentYear !== undefined ? { currentYear: row.currentYear } : {}),
        ...(row.semester !== undefined ? { semester: row.semester } : {}),
        ...(row.schemeId ? { schemeId: row.schemeId } : {}),
        ...(row.batchId ? { batchId: row.batchId } : {}),
        ...(row.academicYearId ? { academicYearId: row.academicYearId } : {}),
      })),
      ...scope,
    };

    const result = await this.bulkImport(dto);
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
    currentYear?: number;
    semester?: number;
  }> {
    const scope = {
      branchId: dto.branchId,
      schemeId: dto.schemeId,
      batchId: dto.batchId,
      academicYearId: dto.academicYearId,
      currentYear: dto.currentYear,
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
