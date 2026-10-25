import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { PermissionsRepository } from './permissions.repository';
import { CreatePermissionDto, UpdatePermissionDto } from './dto';
import type { Permission } from '@prisma/client';
import { CACHE_SERVICE } from '@/common/constants/injection-tokens';
import type { CacheService } from '@/common/interfaces/cache.service';
import { CacheKeys } from '../cache/cache.constants';

@Injectable()
export class PermissionsService {
  constructor(
    private readonly repository: PermissionsRepository,
    @Inject(CACHE_SERVICE) private readonly cache: CacheService
  ) {}

  async create(dto: CreatePermissionDto): Promise<Permission> {
    const permission = await this.repository.create(dto);
    await this.invalidatePermissionCache();
    return permission;
  }

  async findAll(): Promise<Permission[]> {
    return this.repository.findAll();
  }

  async findById(id: string): Promise<Permission> {
    const p = await this.repository.findById(id);
    if (!p) throw new NotFoundException('Permission not found');
    return p;
  }

  async update(id: string, dto: UpdatePermissionDto): Promise<Permission> {
    const permission = await this.repository.update(id, dto);
    await this.invalidatePermissionCache();
    return permission;
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
    await this.invalidatePermissionCache();
  }

  /**
   * Renaming or deleting a permission changes the effective permission names
   * held by every user, so the cached permission sets must be invalidated.
   */
  private async invalidatePermissionCache(): Promise<void> {
    await this.cache.incr(CacheKeys.rbacVersion);
  }
}
