import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { RolesRepository } from './roles.repository';
import { CreateRoleDto, UpdateRoleDto, AssignPermissionDto } from './dto';
import type { Role, Permission } from '@prisma/client';
import { CACHE_SERVICE } from '@/common/constants/injection-tokens';
import type { CacheService } from '@/common/interfaces/cache.service';
import { CacheKeys } from '../cache/cache.constants';

@Injectable()
export class RolesService {
  constructor(
    private readonly repository: RolesRepository,
    @Inject(CACHE_SERVICE) private readonly cache: CacheService,
  ) {}

  async create(dto: CreateRoleDto): Promise<Role> {
    const role = await this.repository.create(dto);
    await this.invalidatePermissionCache();
    return role;
  }

  async findAll(): Promise<Role[]> {
    return this.repository.findAll();
  }

  async findById(id: string): Promise<Role> {
    const role = await this.repository.findById(id);
    if (!role) throw new NotFoundException('Role not found');
    return role;
  }

  async update(id: string, dto: UpdateRoleDto): Promise<Role> {
    const role = await this.repository.update(id, dto);
    await this.invalidatePermissionCache();
    return role;
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
    await this.invalidatePermissionCache();
  }

  async getPermissions(roleId: string): Promise<Permission[]> {
    return this.repository.getPermissions(roleId);
  }

  async assignPermissions(roleId: string, dto: AssignPermissionDto): Promise<void> {
    await this.repository.assignPermissions(roleId, dto.permissionIds);
    await this.invalidatePermissionCache();
  }

  /**
   * A role's permission set changed, so every user holding that role has a
   * different effective permission set. Bumping the global RBAC version
   * orphans all cached permission sets at once.
   */
  private async invalidatePermissionCache(): Promise<void> {
    await this.cache.incr(CacheKeys.rbacVersion);
  }
}
