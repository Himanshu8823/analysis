/**
 * The test that keeps the two copies of the grant rule in step.
 *
 * The rule that stops authority being escalated exists in two places on
 * purpose:
 *
 *  - in the **backend**, as `common/constants/roles.ts`, because the backend
 *    may not import a runtime value from the shared package without changing
 *    the build output layout (see the note at the top of that file);
 *  - in the **shared package**, because the frontend needs it to *offer* only
 *    the roles a member is allowed to hand out — a screen that offers a grant
 *    the server will refuse is a dead end for the person using it.
 *
 * Two copies of a security rule can drift. If they do, the screen and the
 * server disagree about who may appoint whom, and the disagreement shows up
 * as a refusal at the moment somebody presses the button — which is the
 * worst moment to discover it.
 *
 * This test compares the two copies across **every** combination of a held
 * role and a role to grant. There are only a handful of roles, so the whole
 * space is checked rather than a sample of it. Any future change to either
 * copy that is not made to the other fails here.
 */

import { canGrantRole as backendCanGrantRole } from './roles';
import {
  canGrantRole as sharedCanGrantRole,
  grantableRoles,
  USER_ROLES,
} from '@result-analysis/shared-types';

/**
 * Every way a member's roles can be combined.
 *
 * A member may hold no role, one role, or several at once — and the rule
 * judges them by the strongest. The combinations are enumerated rather than
 * sampled, so a change to either copy cannot slip through a gap.
 */
const HELD_COMBINATIONS: string[][] = [
  [],
  ...USER_ROLES.map((role) => [role]),
  // Every pair.
  ...USER_ROLES.flatMap((first) => USER_ROLES.map((second) => [first, second])),
  // A member who holds every role — the strongest possible case.
  [...USER_ROLES],
];

/**
 * The roles that may be handed out, plus the ones that must never be.
 *
 * `DEAN` is not a role the system has; it is here to prove the comparison
 * rejects a name it does not know rather than treating it as weak.
 */
const CANDIDATE_ROLES = [...USER_ROLES, 'DEAN', ''];

describe('the two copies of the grant rule', () => {
  it.each(
    HELD_COMBINATIONS.flatMap((held) =>
      CANDIDATE_ROLES.map((candidate) => [held, candidate] as const)
    )
  )('agrees that a member holding %j may %s grant %s', (held, candidate) => {
    const backendAnswer = backendCanGrantRole(held, candidate);
    const sharedAnswer = sharedCanGrantRole(held, candidate);

    expect(sharedAnswer).toBe(backendAnswer);
  });

  it('never offers the Super Admin role', () => {
    for (const held of HELD_COMBINATIONS) {
      expect(sharedCanGrantRole(held, 'SUPER_ADMIN')).toBe(false);
      expect(grantableRoles(held)).not.toContain('SUPER_ADMIN');
    }
  });

  it('never offers a role to a member who holds no role at all', () => {
    expect(grantableRoles([])).toEqual([]);
  });
});
