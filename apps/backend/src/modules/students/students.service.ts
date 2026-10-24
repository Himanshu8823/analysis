import {
  Injectable, NotFoundException, BadRequestException,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { StudentsRepository } from './students.repository';
import {
  CreateStudentDto, UpdateStudentDto, BulkImportStudentsDto,
} from './dto';
import type { ParsedStudentRow } from './student-import.parser';
import type { Student } from '@prisma/client';

export interface BulkImportResult {
  inserted: number;
  failed: number;
  errors: Array<{ row: number; error: string }>;
}

@Injectable()
export class StudentsService {
  constructor(
    private readonly repository: StudentsRepository,
    private readonly prisma: PrismaClient,
  ) {}

  async create(dto: CreateStudentDto, createdBy: string): Promise<Student> {
    return this.repository.create(dto, createdBy);
  }

  async findAll(params: {
    page?: number;
    pageSize?: number;
    branchId?: string;
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
      (row) => !row.branchId || !row.currentYear || !row.semester
        || !row.schemeId || !row.batchId || !row.academicYearId,
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
        `Row ${invalid + 1} is missing: ${missing.join(', ')}. `
        + 'Supply the scope for the whole file or on each row.',
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
    parseErrors: Array<{ row: number; error: string }>,
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
