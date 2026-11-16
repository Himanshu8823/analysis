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

  /**
   * The active branches a member may see.
   *
   * `branchIds` of `undefined` returns every active branch — the
   * college-wide view. A list narrows the result to those branches, so a
   * member who works in one branch never sees the others in the picker.
   */
  async findAll(branchIds?: string[]): Promise<Branch[]> {
    return this.prisma.branch.findMany({
      where: {
        isActive: true,
        ...(branchIds && branchIds.length > 0 ? { id: { in: branchIds } } : {}),
      },
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
