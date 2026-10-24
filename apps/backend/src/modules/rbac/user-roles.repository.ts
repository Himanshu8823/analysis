import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import type { UserRole } from '@prisma/client';
import { AssignRoleDto } from './dto';

@Injectable()
export class UserRolesRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Grants a role to a user, optionally scoped to a branch.
   *
   * Idempotent: re-assigning an existing role updates `grantedBy`/`grantedAt`
   * instead of creating a duplicate row.
   *
   * This is a find-then-write rather than an `upsert` because the compound
   * unique `(userId, roleId, branchId)` contains a nullable column, and
   * Prisma cannot address a NULL inside a compound unique selector.
   */
  async assign(dto: AssignRoleDto, grantedBy: string): Promise<UserRole> {
    const role = await this.prisma.role.findUnique({ where: { name: dto.roleName } });
    if (!role) {
      throw new Error(`Role ${dto.roleName} not found`);
    }

    const existing = await this.prisma.userRole.findFirst({
      where: {
        userId: dto.userId,
        roleId: role.id,
        branchId: dto.branchId ?? null,
      },
    });

    if (existing) {
      return this.prisma.userRole.update({
        where: { id: existing.id },
        data: { grantedBy, grantedAt: new Date() },
      });
    }

    return this.prisma.userRole.create({
      data: {
        userId: dto.userId,
        roleId: role.id,
        branchId: dto.branchId ?? null,
        grantedBy,
      },
    });
  }

  async revoke(userId: string, roleName: string, branchId?: string): Promise<void> {
    const role = await this.prisma.role.findUnique({ where: { name: roleName } });
    if (!role) return;
    await this.prisma.userRole.deleteMany({
      where: {
        userId,
        roleId: role.id,
        ...(branchId ? { branchId } : {}),
      },
    });
  }

  async findByUser(userId: string) {
    return this.prisma.userRole.findMany({
      where: { userId },
      include: {
        role: { select: { id: true, name: true, description: true } },
        branch: { select: { id: true, code: true, name: true } },
      },
      orderBy: { grantedAt: 'desc' },
    });
  }
}