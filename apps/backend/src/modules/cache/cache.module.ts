import { Global, Module } from '@nestjs/common';
import { CACHE_SERVICE } from '@/common/constants/injection-tokens';
import { RedisCacheService } from './cache.service';

/**
 * Global cache module.
 *
 * `@Global()` because the cache is cross-cutting infrastructure: the permissions
 * guard, the auth service and the RBAC services all need it, and threading an
 * import through every feature module would be noise.
 */
@Global()
@Module({
  providers: [{ provide: CACHE_SERVICE, useClass: RedisCacheService }],
  exports: [CACHE_SERVICE],
})
export class CacheModule {}
