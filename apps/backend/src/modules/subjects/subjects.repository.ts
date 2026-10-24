import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import type { Prisma, Subject } from '@prisma/client';
import { CreateSubjectDto, UpdateSubjectDto } from './dto';

@Injectable()
export class SubjectsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: CreateSubjectDto): Promise<Subject> {
    return this.prisma.subject.create({
      data: {
        code: data.code,
        name: data.name,
        credits: data.credits,
        branchId: data.branchId,
        semester: data.semester,
        schemeId: data.schemeId,
        year: data.year,
        maxMarks: data.maxMarks,
        passingMarks: data.passingMarks,
        components: (data.components ?? []) as unknown as Prisma.InputJsonValue,
        isActive: data.isActive ?? true,
      },
    });
  }

  async findAll(params: {
    branchId?: string;
    schemeId?: string;
    semester?: number;
    isActive?: boolean;
  }): Promise<Subject[]> {
    const where: Prisma.SubjectWhereInput = {};
    if (params.branchId) where.branchId = params.branchId;
    if (params.schemeId) where.schemeId = params.schemeId;
    if (params.semester !== undefined) where.semester = params.semester;
    if (params.isActive !== undefined) where.isActive = params.isActive;

    return this.prisma.subject.findMany({
      where,
      include: {
        branch: { select: { id: true, code: true, name: true } },
        scheme: { select: { id: true, name: true } },
      },
      orderBy: [{ branchId: 'asc' }, { semester: 'asc' }, { code: 'asc' }],
    });
  }

  async findById(id: string): Promise<Subject | null> {
    return this.prisma.subject.findUnique({ where: { id } });
  }

  async update(id: string, data: UpdateSubjectDto): Promise<Subject> {
    return this.prisma.subject.update({
      where: { id },
      data: {
        ...(data.code !== undefined ? { code: data.code } : {}),
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.credits !== undefined ? { credits: data.credits } : {}),
        ...(data.branchId !== undefined ? { branchId: data.branchId } : {}),
        ...(data.semester !== undefined ? { semester: data.semester } : {}),
        ...(data.schemeId !== undefined ? { schemeId: data.schemeId } : {}),
        ...(data.year !== undefined ? { year: data.year } : {}),
        ...(data.maxMarks !== undefined ? { maxMarks: data.maxMarks } : {}),
        ...(data.passingMarks !== undefined ? { passingMarks: data.passingMarks } : {}),
        ...(data.components !== undefined
          ? { components: data.components as unknown as Prisma.InputJsonValue }
          : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.subject.update({
      where: { id },
      data: { isActive: false },
    });
  }
}