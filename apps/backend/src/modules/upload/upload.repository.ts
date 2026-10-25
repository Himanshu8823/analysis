import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { Prisma } from '@prisma/client';
import type { UploadJob } from '@prisma/client';
import type { CreateUploadJobInput } from './upload.service';

@Injectable()
export class UploadRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: CreateUploadJobInput): Promise<UploadJob> {
    return this.prisma.uploadJob.create({
      data: {
        uploadedBy: input.uploadedBy,
        fileName: input.fileName,
        fileType: input.fileType,
        fileUrl: input.fileUrl,
        fileSize: input.fileSize,
        metadata: input.metadata ? (input.metadata as Prisma.InputJsonValue) : Prisma.JsonNull,
      },
    });
  }

  async findAll(params: {
    page?: number;
    pageSize?: number;
    status?: string;
    uploadedBy?: string;
  }) {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));
    const skip = (page - 1) * pageSize;

    const where: Prisma.UploadJobWhereInput = {};
    if (params.status) where.status = params.status;
    if (params.uploadedBy) where.uploadedBy = params.uploadedBy;

    const [items, total] = await Promise.all([
      this.prisma.uploadJob.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        include: {
          uploadedByUser: { select: { id: true, email: true, name: true } },
        },
      }),
      this.prisma.uploadJob.count({ where }),
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

  async findById(id: string): Promise<UploadJob | null> {
    return this.prisma.uploadJob.findUnique({ where: { id } });
  }

  async updateStatus(
    id: string,
    update: {
      status?: string;
      progress?: number;
      errorMessage?: string;
      extractedData?: Record<string, unknown>;
      startedAt?: Date;
      completedAt?: Date;
      fileType?: string;
    }
  ): Promise<UploadJob> {
    return this.prisma.uploadJob.update({
      where: { id },
      data: {
        ...(update.status !== undefined ? { status: update.status } : {}),
        ...(update.progress !== undefined ? { progress: update.progress } : {}),
        ...(update.errorMessage !== undefined ? { errorMessage: update.errorMessage } : {}),
        ...(update.extractedData !== undefined
          ? { extractedData: update.extractedData as Prisma.InputJsonValue }
          : {}),
        ...(update.startedAt !== undefined ? { startedAt: update.startedAt } : {}),
        ...(update.completedAt !== undefined ? { completedAt: update.completedAt } : {}),
        ...(update.fileType !== undefined ? { fileType: update.fileType } : {}),
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.uploadJob.delete({ where: { id } });
  }
}
