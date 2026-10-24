import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { UserRolesRepository } from './user-roles.repository';
import { AssignRoleDto, RevokeRoleDto } from './dto';
import type { UserRole } from '@prisma/client';
import { CACHE_SERVICE } from '@/common/constants/injection-tokens';
import type { CacheService } from '@/common/interfaces/cache.service';
import { CacheKeys } from '../cache/cache.constants';

@Injectable()
export class UserRolesService {
  constructor(
    private readonly repository: UserRolesRepository,
    @Inject(CACHE_SERVICE) private readonly cache: CacheService,
  ) {}

  async assign(dto: AssignRoleDto, grantedBy: string): Promise<UserRole> {
    const userRole = await this.repository.assign(dto, grantedBy);
    await this.invalidatePermissionCache();
    return userRole;
  }

  async revoke(dto: RevokeRoleDto): Promise<void> {
    // The DTO carries `roleName`, not `roleId` — passing `dto.roleId` here
    // silently revoked nothing.
    await this.repository.revoke(dto.userId, dto.roleName, dto.branchId);
    await this.invalidatePermissionCache();
  }

  async findByUser(userId: string) {
    const userRoles = await this.repository.findByUser(userId);
    if (!userRoles || userRoles.length === 0) {
      throw new NotFoundException('No roles found for user');
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
