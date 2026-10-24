import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import type { Branch } from '@prisma/client';
import { CreateBranchDto, UpdateBranchDto } from './dto';

@Injectable()
export class BranchesRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: CreateBranchDto, userId: string): Promise<Branch> {
    return this.prisma.branch.create({
      data: {
        code: data.code,
        name: data.name,
        createdBy: userId,
      },
    });
  }

  async findAll(): Promise<Branch[]> {
    return this.prisma.branch.findMany({
      where: { isActive: true },
      orderBy: { code: 'asc' },
    });
  }

  async findById(id: string): Promise<Branch> {
    const branch = await this.prisma.branch.findUnique({ where: { id } });
    if (!branch) {
      throw new NotFoundException('Branch not found');
    }
    return branch;
  }

  async update(id: string, data: UpdateBranchDto, userId: string): Promise<Branch> {
    return this.prisma.branch.update({
      where: { id },
      data: {
        ...(data.code !== undefined ? { code: data.code } : {}),
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
        updatedBy: userId,
      },
    });
  }

  async delete(id: string, userId: string): Promise<void> {
    await this.prisma.branch.update({
      where: { id },
      data: { isActive: false, updatedBy: userId },
    });
  }
}