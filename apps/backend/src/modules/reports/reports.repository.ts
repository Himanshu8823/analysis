import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import type { Prisma, Report } from '@prisma/client';
import { CreateReportDto } from './dto';

@Injectable()
export class ReportsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: CreateReportDto, generatedBy: string): Promise<Report> {
    return this.prisma.report.create({
      data: {
        generatedBy,
        type: data.type,
        filters: data.filters as Prisma.InputJsonValue,
        status: 'PENDING',
      },
    });
  }

  async findAll(params: {
    page?: number;
    pageSize?: number;
    status?: string;
    generatedBy?: string;
    type?: string;
  }) {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));
    const skip = (page - 1) * pageSize;

    const where: Prisma.ReportWhereInput = {};
    if (params.status) where.status = params.status;
    if (params.generatedBy) where.generatedBy = params.generatedBy;
    if (params.type) where.type = params.type;

    const [items, total] = await Promise.all([
      this.prisma.report.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        include: {
          generatedByUser: { select: { id: true, email: true, name: true } },
        },
      }),
      this.prisma.report.count({ where }),
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

  async findById(id: string): Promise<Report | null> {
    return this.prisma.report.findUnique({ where: { id } });
  }

  async updateStatus(
    id: string,
    update: { status?: string; fileUrl?: string; errorMessage?: string; completedAt?: Date },
  ): Promise<Report> {
    return this.prisma.report.update({
      where: { id },
      data: {
        ...(update.status !== undefined ? { status: update.status } : {}),
        ...(update.fileUrl !== undefined ? { fileUrl: update.fileUrl } : {}),
        ...(update.errorMessage !== undefined ? { errorMessage: update.errorMessage } : {}),
        ...(update.completedAt !== undefined ? { completedAt: update.completedAt } : {}),
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.report.delete({ where: { id } });
  }
}