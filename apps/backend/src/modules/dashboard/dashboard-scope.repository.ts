import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ScopeService } from '@/common/services/scope.service';
import { PermissionsCacheRepository } from '@/modules/rbac/permissions-cache.repository';
import type { DashboardViewer } from './dashboard.types';

/**
 * Resolves *who is asking* and *what they may see*.
 *
 * The dashboard is permission-driven (§3.1): the caller's roles are only
 * labels for bundles of permissions, and a member may hold several at once.
 * So the decision is made from the effective permission set, never from the
 * primary role on the JWT.
 *
 * The effective set is the union of the permissions of every role the member
 * holds. It comes from `PermissionsCacheRepository` — the same source the
 * permissions guard reads — so the dashboard and the guard can never
 * disagree about what the caller may do.
 *
 * The branch scope comes from `ScopeService`, the single place where "which
 * branches may this member see?" is answered for the whole application.
 */
@Injectable()
export class DashboardScopeRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly scopeService: ScopeService,
    private readonly permissionsRepository: PermissionsCacheRepository
  ) {}

  /**
   * Loads the caller's roles, effective permissions, branch scopes and (for a
   * student) their own student record.
   *
   * Never throws for an unknown user: an empty viewer is returned instead, and
   * the caller treats that as "no data".
   */
  async loadViewer(userId: string): Promise<DashboardViewer> {
    const [userRoles, permissions, branchIds, student] = await Promise.all([
      this.prisma.userRole.findMany({
        where: { userId },
        select: {
          role: { select: { name: true } },
        },
      }),
      this.permissionsRepository.getPermissionsForUser(userId),
      this.scopeService.branchScope(userId),
      this.prisma.student.findFirst({
        where: { userId },
        select: { id: true },
      }),
    ]);

    const roles = [...new Set(userRoles.map((ur) => ur.role.name))];

    return {
      userId,
      roles,
      permissions,
      branchIds,
      studentId: student?.id,
    };
  }

  /**
   * The branch names behind a branch scope, for the scope label.
   */
  async branchLabels(branchIds: string[] | undefined): Promise<string[]> {
    if (!branchIds || branchIds.length === 0) return [];

    const branches = await this.prisma.branch.findMany({
      where: { id: { in: branchIds } },
      select: { code: true, name: true },
    });

    return branches.map((b) => b.name || b.code);
  }
}
