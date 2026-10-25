import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import type { Scheme } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { CreateSchemeDto, UpdateSchemeDto } from './dto';

@Injectable()
export class SchemesRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: CreateSchemeDto): Promise<Scheme> {
    return this.prisma.scheme.create({
      data: {
        name: data.name,
        description: data.description,
        rules: data.rules as Prisma.InputJsonValue,
        effectiveFrom: new Date(data.effectiveFrom),
        isActive: data.isActive ?? true,
      },
    });
  }

  async findAll(): Promise<Scheme[]> {
    return this.prisma.scheme.findMany({
      where: { isActive: true },
      orderBy: { effectiveFrom: 'desc' },
    });
  }

  async findById(id: string): Promise<Scheme | null> {
    return this.prisma.scheme.findUnique({ where: { id } });
  }

  async update(id: string, data: UpdateSchemeDto): Promise<Scheme> {
    return this.prisma.scheme.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.rules !== undefined ? { rules: data.rules as Prisma.InputJsonValue } : {}),
        ...(data.effectiveFrom !== undefined
          ? { effectiveFrom: new Date(data.effectiveFrom) }
          : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.scheme.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
