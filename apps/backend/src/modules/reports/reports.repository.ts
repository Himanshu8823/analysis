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
    branchId?: string | string[];
    /**
     * Whether archived reports are included.
     *
     * The list a member sees is of **live** reports by default. An archived
     * report still exists — it is a statement about a class's results, and
     * the row is kept for the audit trail — but it is not something the
     * member asked to see, and showing it would leave them wondering why a
     * report they generated has vanished.
     */
    includeArchived?: boolean;
  }) {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));
    const skip = (page - 1) * pageSize;

    const where: Prisma.ReportWhereInput = {};
    if (params.status) where.status = params.status;
    if (params.generatedBy) where.generatedBy = params.generatedBy;
    if (params.type) where.type = params.type;
    if (!params.includeArchived) where.isArchived = false;
    // A report carries no branch column of its own — the branch lives inside
    // the `filters` JSON, so the scope filter has to go through that path.
    // A JSON path filter compares one value, so a scope covering several
    // branches becomes an OR of one path clause per branch.
    const branchIds = params.branchId
      ? Array.isArray(params.branchId)
        ? params.branchId
        : [params.branchId]
      : [];
    // The cast is needed because Prisma's generated `JsonFilter` type models
    // the path form as a union that TypeScript cannot narrow from an object
    // literal; the value itself is a plain string.
    const byBranch = (branchId: string): Prisma.ReportWhereInput =>
      ({
        filters: { path: ['branchId'], equals: branchId },
      }) as Prisma.ReportWhereInput;
    if (branchIds.length === 1) {
      Object.assign(where, byBranch(branchIds[0]));
    } else if (branchIds.length > 1) {
      where.OR = branchIds.map(byBranch);
    }

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

  /**
   * The branch a report was generated for.
   *
   * The branch is stored inside the `filters` JSON rather than in a column
   * of its own, so it is read back out of that object. `null` means the
   * report does not exist or carries no branch filter.
   */
  async findBranchIdOfReport(id: string): Promise<string | null> {
    const report = await this.prisma.report.findUnique({
      where: { id },
      select: { filters: true },
    });
    const filters = report?.filters;
    if (!filters || typeof filters !== 'object' || Array.isArray(filters)) return null;
    const branchId = (filters as Record<string, unknown>).branchId;
    return typeof branchId === 'string' && branchId.length > 0 ? branchId : null;
  }

  async updateStatus(
    id: string,
    update: { status?: string; fileUrl?: string; errorMessage?: string; completedAt?: Date }
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

  /**
   * Archives a report.
   *
   * The row is **not** deleted. A report is a statement about a class's
   * results, and a result that existed and then vanished cannot be
   * accounted for. The file is released, the report is marked as archived,
   * and the reason and the person who archived it are kept with it.
   */
  async archive(id: string, archivedBy: string, reason: string): Promise<void> {
    await this.prisma.report.update({
      where: { id },
      data: {
        isArchived: true,
        archivedAt: new Date(),
        archivedBy,
        archiveReason: reason,
        // The generated file is released with the archive — the row is kept,
        // the bytes are not.
        fileUrl: null,
      },
    });
  }
}
