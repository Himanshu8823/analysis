import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { UserRolesRepository } from './user-roles.repository';
import { AssignRoleDto, RevokeRoleDto } from './dto';
import type { UserRole } from '@prisma/client';
import { CACHE_SERVICE } from '@/common/constants/injection-tokens';
import type { CacheService } from '@/common/interfaces/cache.service';
import { CacheKeys } from '../cache/cache.constants';
import { AuditService } from '@/common/services/audit.service';
import { AuditAction, AuditResource } from '@/common/decorators/audited.decorator';

/**
 * Role assignment.
 *
 * Assigning or taking back a role is the most consequential thing this
 * system does — it is how a person gains or loses authority over students,
 * marks and results. So it is:
 *
 *  - validated (see {@link UserRolesRepository.assign}),
 *  - audited (who granted it, to whom, in which branch, when), and
 *  - followed immediately by a permission-cache invalidation, so the change
 *    takes effect on the member's very next request.
 */
@Injectable()
export class UserRolesService {
  constructor(
    private readonly repository: UserRolesRepository,
    private readonly auditService: AuditService,
    @Inject(CACHE_SERVICE) private readonly cache: CacheService
  ) {}

  async assign(dto: AssignRoleDto, grantedBy: string): Promise<UserRole> {
    const userRole = await this.repository.assign(dto, grantedBy);
    await this.invalidatePermissionCache();

    await this.auditService.record({
      userId: grantedBy,
      action: AuditAction.GRANT,
      resource: AuditResource.USER,
      resourceId: dto.userId,
      details: {
        roleName: dto.roleName,
        branchId: dto.branchId ?? null,
      },
      requestContext: {},
    });

    return userRole;
  }

  /**
   * Takes a role back from a member.
   *
   * The DTO carries `roleName`, not `roleId` — passing `dto.roleId` here
   * silently revoked nothing.
   *
   * The person doing the revoking is passed on, so that the repository can
   * check they hold the authority they are about to take away. A member may
   * not strip a role they could not have granted.
   */
  async revoke(dto: RevokeRoleDto, revokedBy: string): Promise<void> {
    const removed = await this.repository.revoke(dto.userId, dto.roleName, dto.branchId, revokedBy);
    await this.invalidatePermissionCache();

    if (removed > 0) {
      await this.auditService.record({
        userId: revokedBy,
        action: AuditAction.REVOKE,
        resource: AuditResource.USER,
        resourceId: dto.userId,
        details: {
          roleName: dto.roleName,
          branchId: dto.branchId ?? null,
        },
        requestContext: {},
      });
    }
  }

  async findByUser(userId: string) {
    const userRoles = await this.repository.findByUser(userId);
    if (!userRoles || userRoles.length === 0) {
      throw new NotFoundException('This member has no roles assigned.');
    }
    return userRoles;
  }

  /**
   * Assigning or revoking a role changes the user's effective permissions.
   * Bumping the global RBAC version orphans every cached permission set,
   * so the next request re-reads from the database.
   */
  private async invalidatePermissionCache(): Promise<void> {
    await this.cache.incr(CacheKeys.rbacVersion);
  }
}
