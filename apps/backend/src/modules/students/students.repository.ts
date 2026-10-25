import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import type { Student } from '@prisma/client';
import { CreateStudentDto, UpdateStudentDto } from './dto';
import type { ParsedStudentRow } from './student-import.parser';

@Injectable()
export class StudentsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: CreateStudentDto, _createdBy: string): Promise<Student> {
    try {
      return await this.prisma.student.create({
        data: {
          rollNo: data.rollNo,
          name: data.name,
          branchId: data.branchId,
          currentYear: data.currentYear,
          semester: data.semester,
          schemeId: data.schemeId,
          batchId: data.batchId,
          academicYearId: data.academicYearId,
          isActive: data.isActive ?? true,
        },
      });
    } catch (err) {
      /**
       * A roll number is unique per academic year. Without this the caller
       * gets a raw Prisma error (HTTP 500) instead of a conflict (HTTP 409).
       */
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException(
          `Roll No "${data.rollNo}" already exists for this academic year`,
        );
      }
      throw err;
    }
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
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));
    const skip = (page - 1) * pageSize;

    const where: Prisma.StudentWhereInput = {
      // Soft-deleted students stay in the table for the audit trail, but they
      // must not appear in the roster.
      isActive: true,
    };
    if (params.branchId) where.branchId = params.branchId;
    if (params.schemeId) where.schemeId = params.schemeId;
    if (params.currentYear !== undefined) where.currentYear = params.currentYear;
    if (params.semester !== undefined) where.semester = params.semester;
    if (params.academicYearId) where.academicYearId = params.academicYearId;
    if (params.search) {
      where.OR = [
        { rollNo: { contains: params.search, mode: 'insensitive' } },
        { name: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.student.findMany({
        where,
        orderBy: { rollNo: 'asc' },
        skip,
        take: pageSize,
        include: {
          branch: { select: { id: true, code: true, name: true } },
          scheme: { select: { id: true, name: true } },
          academicYear: { select: { id: true, year: true } },
        },
      }),
      this.prisma.student.count({ where }),
    ]);

    return {
      items,
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async findById(id: string): Promise<Student | null> {
    return this.prisma.student.findUnique({ where: { id } });
  }

  async update(id: string, data: UpdateStudentDto, updatedBy: string): Promise<Student> {
    return this.prisma.student.update({
      where: { id },
      data: {
        ...(data.rollNo !== undefined ? { rollNo: data.rollNo } : {}),
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.branchId !== undefined ? { branchId: data.branchId } : {}),
        ...(data.currentYear !== undefined ? { currentYear: data.currentYear } : {}),
        ...(data.semester !== undefined ? { semester: data.semester } : {}),
        ...(data.schemeId !== undefined ? { schemeId: data.schemeId } : {}),
        ...(data.batchId !== undefined ? { batchId: data.batchId } : {}),
        ...(data.academicYearId !== undefined ? { academicYearId: data.academicYearId } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
        updatedBy,
      },
    });
  }

  async softDelete(id: string, _deletedBy: string): Promise<void> {
    await this.prisma.student.update({
      where: { id },
      data: { isActive: false },
    });
  }

  /**
   * Inserts many students in one transaction. The unique constraint on
   * `(rollNo, academicYearId)` is the source of truth for duplicates — the
   * pre-check below only exists so the caller gets a per-row message instead
   * of a single rolled-back transaction.
   */
  async bulkCreate(
    rows: CreateStudentDto[],
  ): Promise<{ inserted: number; errors: Array<{ row: number; error: string }> }> {
    if (!rows.length) return { inserted: 0, errors: [] };

    const academicYearIds = [...new Set(rows.map((row) => row.academicYearId))];
    const rollNos = [...new Set(rows.map((row) => row.rollNo))];

    const existing = await this.prisma.student.findMany({
      where: {
        rollNo: { in: rollNos },
        academicYearId: { in: academicYearIds },
      },
      select: { rollNo: true, academicYearId: true },
    });
    const existingKeys = new Set(existing.map((e) => `${e.rollNo}::${e.academicYearId}`));

    const errors: Array<{ row: number; error: string }> = [];
    const accepted: CreateStudentDto[] = [];
    const seenInFile = new Set<string>();

    rows.forEach((row, index) => {
      const key = `${row.rollNo}::${row.academicYearId}`;
      if (existingKeys.has(key)) {
        errors.push({ row: index + 1, error: `Roll No "${row.rollNo}" already exists` });
        return;
      }
      if (seenInFile.has(key)) {
        errors.push({ row: index + 1, error: `Roll No "${row.rollNo}" is duplicated in the file` });
        return;
      }
      seenInFile.add(key);
      accepted.push(row);
    });

    if (!accepted.length) return { inserted: 0, errors };

    const result = await this.prisma.student.createMany({
      data: accepted.map((row) => ({
        rollNo: row.rollNo,
        name: row.name,
        branchId: row.branchId,
        currentYear: row.currentYear,
        semester: row.semester,
        schemeId: row.schemeId,
        batchId: row.batchId,
        academicYearId: row.academicYearId,
        isActive: row.isActive ?? true,
      })),
      skipDuplicates: true,
    });

    return { inserted: result.count, errors };
  }
}