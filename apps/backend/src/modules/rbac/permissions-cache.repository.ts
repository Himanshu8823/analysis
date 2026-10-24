import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Single source of truth for "which permissions does this user hold?".
 *
 * The same join was previously duplicated in `AuthRepository.getUserPermissions`
 * and needed a second copy inside `PermissionsGuard`. One implementation here
 * means the cached value and the guard can never disagree.
 */
@Injectable()
export class PermissionsCacheRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Resolves the effective permission names for a user by joining
   * UserRole → RolePermission → Permission.
   *
   * Returns an empty array for a user with no roles — never throws, so callers
   * can treat "no roles" and "no permissions" identically.
   */
  async getPermissionsForUser(userId: string): Promise<string[]> {
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId },
      select: { roleId: true },
    });

    const roleIds = userRoles.map((ur) => ur.roleId);
    if (roleIds.length === 0) return [];

    const rolePermissions = await this.prisma.rolePermission.findMany({
      where: { roleId: { in: roleIds } },
      select: { permission: { select: { name: true } } },
    });

    return [...new Set(rolePermissions.map((rp) => rp.permission.name))];
  }

  /**
   * Resolves the effective permissions for several users in one round trip.
   * Used by the members listing so a page of 20 members is not 40 queries.
   */
  async getPermissionsForUsers(userIds: string[]): Promise<Map<string, string[]>> {
    const result = new Map<string, string[]>();
    if (userIds.length === 0) return result;

    const userRoles = await this.prisma.userRole.findMany({
      where: { userId: { in: userIds } },
      select: { userId: true, roleId: true },
    });

    const roleIds = [...new Set(userRoles.map((ur) => ur.roleId))];
    if (roleIds.length === 0) return result;

    const rolePermissions = await this.prisma.rolePermission.findMany({
      where: { roleId: { in: roleIds } },
      select: { roleId: true, permission: { select: { name: true } } },
    });

    const permissionsByRole = new Map<string, string[]>();
    for (const rp of rolePermissions) {
      const list = permissionsByRole.get(rp.roleId) ?? [];
      list.push(rp.permission.name);
      permissionsByRole.set(rp.roleId, list);
    }

    for (const userId of userIds) result.set(userId, []);

    for (const ur of userRoles) {
      const perms = permissionsByRole.get(ur.roleId) ?? [];
      const existing = result.get(ur.userId) ?? [];
      result.set(ur.userId, [...new Set([...existing, ...perms])]);
    }

    return result;
  }
}
