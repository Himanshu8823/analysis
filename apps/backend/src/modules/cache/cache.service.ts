import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import type { CacheService } from '@/common/interfaces/cache.service';
import { CACHE_TTL_SECONDS } from './cache.constants';

/**
 * Redis-backed cache.
 *
 * The cache is an accelerator, never a source of truth. If Redis is unreachable
 * every operation degrades to a no-op (`get` returns `null`, writes are
 * dropped) so the API keeps serving correct results straight from Postgres —
 * slower, but never broken.
 */
@Injectable()
export class RedisCacheService implements CacheService, OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisCacheService.name);

  private client: Redis | null = null;
  private healthy = false;
  private warnedUnavailable = false;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    this.client = new Redis({
      host: this.config.get<string>('redis.host'),
      port: this.config.get<number>('redis.port'),
      password: this.config.get<string>('redis.password') || undefined,
      db: this.config.get<number>('redis.db'),
      lazyConnect: true,
      // Fail fast rather than queue commands forever when Redis is down.
      enableOfflineQueue: false,
      maxRetriesPerRequest: 2,
      retryStrategy: (times) => (times > 5 ? null : Math.min(times * 200, 2000)),
    });

    this.client.on('ready', () => {
      this.healthy = true;
      this.warnedUnavailable = false;
      this.logger.log('Redis cache connected');
    });

    this.client.on('error', (err: Error) => {
      this.healthy = false;
      if (!this.warnedUnavailable) {
        this.warnedUnavailable = true;
        this.logger.warn(
          `Redis cache unavailable (${err.message}). Continuing without cache — ` +
            'requests will be served directly from the database.',
        );
      }
    });

    this.client.on('end', () => {
      this.healthy = false;
    });
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.quit();
    } catch {
      this.client.disconnect();
    }
  }

  isHealthy(): boolean {
    return this.healthy;
  }

  async get(key: string): Promise<string | null> {
    if (!this.healthy || !this.client) return null;
    try {
      return await this.client.get(key);
    } catch (err) {
      this.logger.warn(`Cache GET failed for ${key}: ${(err as Error).message}`);
      return null;
    }
  }

  async set(key: string, value: string, ttlSeconds: number = CACHE_TTL_SECONDS): Promise<void> {
    if (!this.healthy || !this.client) return;
    try {
      await this.client.set(key, value, 'EX', ttlSeconds);
    } catch (err) {
      this.logger.warn(`Cache SET failed for ${key}: ${(err as Error).message}`);
    }
  }

  async del(key: string): Promise<void> {
    if (!this.healthy || !this.client) return;
    try {
      await this.client.del(key);
    } catch (err) {
      this.logger.warn(`Cache DEL failed for ${key}: ${(err as Error).message}`);
    }
  }

  async delMany(keys: string[]): Promise<void> {
    if (!this.healthy || !this.client || keys.length === 0) return;
    try {
      await this.client.del(...keys);
    } catch (err) {
      this.logger.warn(`Cache DELMANY failed: ${(err as Error).message}`);
    }
  }

  /**
   * Deletes every key matching a glob pattern.
   *
   * Uses SCAN rather than KEYS: KEYS blocks the Redis event loop for the
   * duration of the scan, which is unacceptable on a busy instance.
   */
  async invalidatePattern(pattern: string): Promise<void> {
    if (!this.healthy || !this.client) return;
    try {
      const found: string[] = [];
      let cursor = '0';
      do {
        const [next, keys] = await this.client.scan(cursor, 'MATCH', pattern, 'COUNT', 200);
        cursor = next;
        found.push(...keys);
      } while (cursor !== '0');

      if (found.length > 0) {
        await this.client.del(...found);
      }
    } catch (err) {
      this.logger.warn(`Cache invalidation failed for ${pattern}: ${(err as Error).message}`);
    }
  }

  async incr(key: string): Promise<number> {
    if (!this.healthy || !this.client) return 0;
    try {
      return await this.client.incr(key);
    } catch (err) {
      this.logger.warn(`Cache INCR failed for ${key}: ${(err as Error).message}`);
      return 0;
    }
  }

  async getJson<T>(key: string): Promise<T | null> {
    const raw = await this.get(key);
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async setJson<T>(key: string, value: T, ttlSeconds: number = CACHE_TTL_SECONDS): Promise<void> {
    await this.set(key, JSON.stringify(value), ttlSeconds);
  }
}
