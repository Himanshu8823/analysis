import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { isUserRole } from '@result-analysis/shared-types';
import type { UserRole } from '@result-analysis/shared-types';

@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async create(data: { email: string; name: string; passwordHash: string }) {
    return this.prisma.user.create({
      data: {
        email: data.email.toLowerCase().trim(),
        name: data.name,
        passwordHash: data.passwordHash,
      },
    });
  }

  async getUserRoles(userId: string) {
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId },
      include: { role: true, branch: true },
    });
    return userRoles.map((ur) => ({
      name: ur.role.name as UserRole,
      branchId: ur.branchId,
    }));
  }

  async getUserPermissions(userId: string): Promise<string[]> {
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId },
      select: { roleId: true },
    });

    const roleIds = userRoles.map((ur) => ur.roleId);
    if (roleIds.length === 0) return [];

    const permissions = await this.prisma.rolePermission.findMany({
      where: { roleId: { in: roleIds } },
      include: { permission: true },
    });

    return [...new Set(permissions.map((p) => p.permission.name))];
  }

  /**
   * The user's highest-privilege role, used as the JWT `role` claim and as the
   * fallback when a user has no role rows at all.
   */
  async getPrimaryRole(userId: string): Promise<UserRole> {
    const roles = await this.getUserRoles(userId);
    const names = roles.map((r) => r.name).filter(isUserRole);
    return names[0] ?? 'STUDENT';
  }

  async assignRole(userId: string, roleName: string, branchId?: string) {
    const role = await this.prisma.role.findUnique({ where: { name: roleName } });
    if (!role) {
      throw new Error(`Role ${roleName} not found`);
    }

    return this.prisma.userRole.create({
      data: {
        userId,
        roleId: role.id,
        branchId: branchId ?? null,
      },
    });
  }

  async saveRefreshToken(
    userId: string,
    tokenHash: string,
    metadata?: { ip?: string; userAgent?: string },
  ) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    return this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
        ipAddress: metadata?.ip,
        userAgent: metadata?.userAgent,
      },
    });
  }

  async findLatestRefreshToken(userId: string) {
    return this.prisma.refreshToken.findFirst({
      where: { userId, revokedAt: null },
      orderBy: { createdAt: 'desc' },
      include: { user: true },
    });
  }

  async revokeRefreshTokens(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllRefreshTokens(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId },
      data: { revokedAt: new Date() },
    });
  }

  async updateLastLogin(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
    });
  }
}