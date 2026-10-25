import { Injectable, Inject } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { CACHE_SERVICE } from '@/common/constants/injection-tokens';
import type { CacheService } from '@/common/interfaces/cache.service';

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaClient,
    @Inject(CACHE_SERVICE) private readonly cache: CacheService
  ) {}

  async check() {
    let dbOk = false;
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      dbOk = true;
    } catch {
      dbOk = false;
    }

    // The cache is an accelerator, not a dependency — the API stays correct
    // without it. It is reported so an operator can see the degradation.
    const redisOk = this.cache.isHealthy();

    return {
      status: dbOk ? 'ok' : 'degraded',
      services: { database: dbOk, redis: redisOk },
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }

  async readiness() {
    const dbOk = await this.check();
    return {
      ready: dbOk.services.database,
      timestamp: new Date().toISOString(),
    };
  }
}
