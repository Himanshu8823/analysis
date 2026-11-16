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
export const BRANCH_SCOPED_ROLES: readonly UserRole[] = ['HOD', 'PRINCIPAL', 'TEACHER'] as const;

/**
 * How much authority each role carries, from the most to the least.
 *
 * The order matters in one place only: deciding whether a member may grant
 * a role. A member may grant a role that carries **strictly less** authority
 * than the strongest role they hold themselves. Without this rule, anyone
 * who can open the "assign a role" screen could make themselves — or a
 * colleague — a Principal, and from there reach every branch of the college.
 *
 * The order is not a claim about how the college is organised. It is a claim
 * about what each role can do, and the permissions are what carry that.
 */
const ROLE_AUTHORITY: readonly UserRole[] = [
  'SUPER_ADMIN',
  'ADMIN',
  'HOD',
  'PRINCIPAL',
  'TEACHER',
  'STUDENT',
] as const;

/**
 * Whether a member holding `heldRoles` may grant `roleToGrant`.
 *
 * The rules:
 *
 *  - the Super Admin role is never granted through these screens — it is
 *    set by the system administrator alone;
 *  - a member may grant a **staff** role — Admin, HOD, Principal or
 *    Teacher — only if it carries **strictly less** authority than the
 *    strongest role they hold. The authority to grant is the authority you
 *    have, and handing out your own rank would make every office
 *    self-perpetuating: an Admin who could appoint an Admin could appoint
 *    an Admin who appoints Admins, and the exam cell would be beyond
 *    anybody's reach;
 *  - a member may grant the **Student** role only from the Principal level
 *    up. Appointing a student is not a teacher's act — a teacher teaches a
 *    subject — and the permission matrix agrees: the Teacher role carries
 *    no `rbac:write` and no `invites:write` at all.
 *
 * A member who holds several roles is judged by the **strongest** of them.
 * Judging by the weakest would let a Principal who also teaches appoint a
 * Student, which is not what their office means.
 *
 * The comparison is strict, so a member may not appoint a peer: an Admin
 * may not appoint another Admin, and a Principal may not appoint another
 * Principal. Holding a *weaker* role alongside a stronger one does not
 * change that — a Principal who also teaches carries no more authority
 * than a Principal who does not, and is judged the same way.
 */
export function canGrantRole(heldRoles: readonly string[], roleToGrant: string): boolean {
  // The Super Admin role is never granted through these screens.
  if (roleToGrant === 'SUPER_ADMIN') return false;

  // A member with no roles at all may grant nothing.
  const held = heldRoles.filter(isUserRole);
  if (held.length === 0) return false;

  // The role to grant must be one the system knows.
  if (!isUserRole(roleToGrant)) return false;

  // The strongest role the member holds decides.
  const strongest = held.reduce((best, role) => {
    return ROLE_AUTHORITY.indexOf(role) < ROLE_AUTHORITY.indexOf(best) ? role : best;
  }, held[0]);

  /**
   * The Student role is appointed, not granted as staff.
   *
   * It is the one role that is not an office in the college, and the only
   * one that may be handed out from the Principal level up.
   */
  if (roleToGrant === 'STUDENT') {
    return ROLE_AUTHORITY.indexOf(strongest) <= ROLE_AUTHORITY.indexOf('PRINCIPAL');
  }

  // Every other role is a staff role, and it must be strictly below the
  // grantor's own.
  return ROLE_AUTHORITY.indexOf(roleToGrant) > ROLE_AUTHORITY.indexOf(strongest);
}

/** Narrows an arbitrary string from the database to a known role name. */
export function isUserRole(value: string): value is UserRole {
  return (USER_ROLES as readonly string[]).includes(value);
}
