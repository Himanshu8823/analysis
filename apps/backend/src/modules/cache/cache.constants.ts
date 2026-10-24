/**
 * Cache key builders.
 *
 * The RBAC permission cache is keyed by user *and* a global version counter.
 * Any RBAC mutation bumps the counter, which orphans every previously cached
 * permission set in O(1) instead of walking every affected user.
 */
export const CacheKeys = {
  /** Global RBAC version. Bumped on any role/permission change. */
  rbacVersion: 'cache:rbac:version',

  /** Effective permissions for a user, scoped to the current RBAC version. */
  userPermissions: (userId: string, version: number): string =>
    `cache:user:permissions:${userId}:v${version}`,

  /** Glob matching every cached permission set, regardless of version. */
  userPermissionsPattern: 'cache:user:permissions:*',

  /**
   * Whether a user still has to change their password.
   *
   * Deliberately *not* versioned by the RBAC counter — that counter tracks
   * permission changes, and password state has its own lifecycle.
   */
  userMustChangePassword: (userId: string): string =>
    `cache:user:must-change-password:${userId}`,
} as const;

/** Default TTL for cached values, in seconds. */
export const CACHE_TTL_SECONDS = 300;
