import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import type { Prisma, Student } from '@prisma/client';
import { CreateStudentDto, UpdateStudentDto } from './dto';

@Injectable()
export class StudentsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: CreateStudentDto, _createdBy: string): Promise<Student> {
    return this.prisma.student.create({
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

    const where: Prisma.StudentWhereInput = {};
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
}