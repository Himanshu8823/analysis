import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  PERMISSIONS_KEY,
  PERMISSIONS_MODE_KEY,
  type PermissionsMode,
} from '../decorators/permissions.decorator';
import { CACHE_SERVICE } from '../constants/injection-tokens';
import type { Request } from 'express';
import type { JwtPayload } from '@/common/types';
import type { CacheService } from '../interfaces/cache.service';
import { PermissionsCacheRepository } from '@/modules/rbac/permissions-cache.repository';
import { CacheKeys, CACHE_TTL_SECONDS } from '@/modules/cache/cache.constants';

/**
 * Enforces `@Permissions()` on a route.
 *
 * The check reads the user's effective permissions from the cache. On a cache
 * miss — or when Redis is unavailable entirely — it falls back to the database,
 * so a Redis outage downgrades performance, never authorisation. The previous
 * implementation returned `true` on a miss, which silently disabled every
 * permission check in the system.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(CACHE_SERVICE) private readonly cache: CacheService,
    private readonly permissionsRepository: PermissionsCacheRepository
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request & { user?: JwtPayload }>();
    const userId = request.user?.sub;
    if (!userId) {
      throw new ForbiddenException('Not authenticated');
    }

    const userPermissions = await this.resolvePermissions(userId);

    /**
     * How the listed permissions are matched.
     *
     * The default is `every` — a route that names several permissions
     * usually means "and". A route marked with `@AnyPermission` means "or":
     * several roles may use it, each through their own right.
     */
    const mode =
      this.reflector.getAllAndOverride<PermissionsMode>(PERMISSIONS_MODE_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? 'every';

    const hasPermission =
      mode === 'some'
        ? requiredPermissions.some((p) => userPermissions.includes(p))
        : requiredPermissions.every((p) => userPermissions.includes(p));

    if (!hasPermission) {
      /**
       * The message is a sentence for the member, not a code. "Insufficient
       * permissions" is a developer's phrase; a college clerk reads
       * "you do not have access to this" and knows to ask the administrator.
       */
      throw new ForbiddenException(
        'You do not have access to this. Ask the college administrator if you need it.'
      );
    }
    return true;
  }

  private async resolvePermissions(userId: string): Promise<string[]> {
    const version = await this.currentRbacVersion();
    const cacheKey = CacheKeys.userPermissions(userId, version);

    const cached = await this.cache.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached) as string[];
      } catch {
        // Malformed cache entry — treat as a miss and re-read from the database.
      }
    }

    const permissions = await this.permissionsRepository.getPermissionsForUser(userId);
    await this.cache.set(cacheKey, JSON.stringify(permissions), CACHE_TTL_SECONDS);
    return permissions;
  }

  /**
   * The global RBAC version. Bumped whenever roles or permissions change, which
   * orphans every previously cached permission set in O(1).
   *
   * `incr` returns 0 when Redis is unavailable, so the version collapses to
   * `v0` — a valid, if unversioned, cache key. The TTL then bounds staleness.
   */
  private async currentRbacVersion(): Promise<number> {
    const version = await this.cache.incr(CacheKeys.rbacVersion);
    return version > 0 ? version : 1;
  }
}
