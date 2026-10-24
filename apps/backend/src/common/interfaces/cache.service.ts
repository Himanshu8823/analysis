/**
 * Canonical cache contract for the whole backend.
 *
 * Previously two conflicting `CacheService` interfaces existed (one in
 * `permissions.guard.ts` with only `get`, one in `auth.service.ts` with four
 * methods). This file is the single source of truth — import from here.
 */
export interface CacheService {
  /** Returns the stored string, or `null` on a miss or when the cache is unavailable. */
  get(key: string): Promise<string | null>;

  /** Stores a string. `ttlSeconds` defaults to 300 seconds. */
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;

  /** Deletes a single key. */
  del(key: string): Promise<void>;

  /** Deletes several keys in one round trip. */
  delMany(keys: string[]): Promise<void>;

  /**
   * Deletes every key matching a glob pattern (e.g. `cache:user:permissions:*`).
   * Implemented with SCAN, never KEYS, so it never blocks the Redis event loop.
   */
  invalidatePattern(pattern: string): Promise<void>;

  /** Atomically increments a counter and returns the new value. Used for cache versioning. */
  incr(key: string): Promise<number>;

  /** Reads and parses a JSON value. Returns `null` on a miss or on malformed JSON. */
  getJson<T>(key: string): Promise<T | null>;

  /** Serialises and stores a JSON value. */
  setJson<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;

  /** Whether the cache backend is currently reachable. */
  isHealthy(): boolean;
}
