import type { UserRole } from '@result-analysis/shared-types';

/**
 * Runtime role constants for the backend.
 *
 * These mirror the shared-types package so the backend never has to import a
 * runtime value from outside its own source root. Importing a value from
 * `packages/shared-types/src` would make TypeScript infer the monorepo root as
 * the common root directory, which changes the build output layout from
 * `dist/main.js` to `dist/apps/backend/src/main.js` and breaks `start:prod`.
 *
 * Type-only imports (`import type { UserRole }`) are erased at compile time
 * and therefore never reach the emitted output.
 */

/** Every role the system knows about, in privilege order. */
export const USER_ROLES: readonly UserRole[] = [
  'SUPER_ADMIN',
  'ADMIN',
  'HOD',
  'PRINCIPAL',
  'TEACHER',
  'STUDENT',
] as const;

/**
 * Roles that may be granted through an invitation.
 *
 * `SUPER_ADMIN` is excluded on purpose: the Super Admin must not be able to
 * mint a second Super Admin through the invite flow.
 */
export const INVITABLE_ROLES: readonly UserRole[] = [
  'ADMIN',
  'HOD',
  'PRINCIPAL',
  'TEACHER',
  'STUDENT',
] as const;

/** Roles whose authority is scoped to a single branch. */
export const BRANCH_SCOPED_ROLES: readonly UserRole[] = [
  'HOD',
  'PRINCIPAL',
  'TEACHER',
] as const;

/** Narrows an arbitrary string from the database to a known role name. */
export function isUserRole(value: string): value is UserRole {
  return (USER_ROLES as readonly string[]).includes(value);
}
