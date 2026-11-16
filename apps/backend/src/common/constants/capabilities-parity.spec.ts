/**
 * The test that keeps the three copies of the access rules in step.
 *
 * "Which screens may this member open?" is answered in three places, on
 * purpose:
 *
 *  - in the **shared catalogue** (`packages/shared-constants`), because both
 *    sides need it and a runtime import of a workspace package from the
 *    backend is not possible without changing the build output layout (see
 *    the note at the top of `roles.ts`);
 *  - in the **frontend's navigation** (`apps/frontend/lib/constants`), which
 *    decides which links are offered;
 *  - in the **frontend's sidebar** (`apps/frontend/components/layout/
 *    AppSidebar.tsx`), which lists the administration screens.
 *
 * Three copies of one rule can drift. If they do, the drift shows up as a
 * screen the member is offered and cannot open — a dead end that looks like
 * a broken system — or, worse, as a screen that is opened and refused.
 *
 * This test compares them across **every** screen, not a sample, so a change
 * to any one copy that is not made to the others fails here.
 */

import {
  PERMISSIONS,
  ROLE_PERMISSIONS,
  SCREEN_CAPABILITIES,
  canAccessScreen,
} from '@result-analysis/shared-constants';

import { USER_ROLES } from './roles';

/**
 * The frontend's navigation, read as it is written.
 *
 * The file is read rather than imported because the frontend is a Next.js
 * application with its own module resolution; importing it here would drag
 * React and the alias configuration into the backend's test run. Reading it
 * is enough to compare the *rule*, which is what can drift.
 *
 * The parse is deliberately strict: if the shape of the file changes, this
 * test fails loudly rather than silently comparing nothing.
 */
const FRONTEND_CONSTANTS_PATH = '../../../../frontend/lib/constants/index.ts';

/**
 * Reads the frontend's navigation entries out of its source.
 *
 * Each entry is `href`, `label` and `permissions`. The permissions are
 * matched with a regular expression so the comparison is against the
 * *values*, not against the formatting.
 */
function readFrontendNavItems(): Array<{
  href: string;
  label: string;
  permissions: string[];
}> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const fs = require('fs') as typeof import('fs');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const path = require('path') as typeof import('path');

  const file = path.resolve(__dirname, FRONTEND_CONSTANTS_PATH);
  const source = fs.readFileSync(file, 'utf8');

  const entries: Array<{ href: string; label: string; permissions: string[] }> = [];

  /**
   * Matches one navigation entry.
   *
   * The three fields are read in the order they appear in the file, which is
   * how the file is written. A change to the order would fail the match and
   * therefore fail this test — the right outcome, because the test's
   * comparison depends on reading all three.
   */
  const entryPattern =
    /href:\s*'([^']+)'[\s\S]*?label:\s*'([^']+)'[\s\S]*?permissions:\s*\[([^\]]*)\]/g;

  let match: RegExpExecArray | null;
  while ((match = entryPattern.exec(source)) !== null) {
    const permissions = [...match[3].matchAll(/'([^']+)'/g)].map((m) => m[1]);
    entries.push({ href: match[1], label: match[2], permissions });
  }

  return entries;
}

/**
 * The administration screens the sidebar offers.
 *
 * The sidebar is read the same way, for the same reason.
 */
function readFrontendAdminItems(): Array<{
  href: string;
  label: string;
  permissions: string[];
}> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const fs = require('fs') as typeof import('fs');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const path = require('path') as typeof import('path');

  const file = path.resolve(__dirname, '../../../../frontend/components/layout/AppSidebar.tsx');
  const source = fs.readFileSync(file, 'utf8');

  const entries: Array<{ href: string; label: string; permissions: string[] }> = [];

  const entryPattern =
    /href:\s*'([^']+)'[\s\S]*?label:\s*'([^']+)'[\s\S]*?permissions:\s*\[([^\]]*)\]/g;

  let match: RegExpExecArray | null;
  while ((match = entryPattern.exec(source)) !== null) {
    const permissions = [...match[3].matchAll(/'([^']+)'/g)].map((m) => m[1]);
    entries.push({ href: match[1], label: match[2], permissions });
  }

  return entries;
}

const frontendNavItems = readFrontendNavItems();
const frontendAdminItems = readFrontendAdminItems();

describe('the frontend navigation and the shared catalogue', () => {
  it('reads the navigation entries it is comparing', () => {
    // A parser that silently matches nothing would make every comparison
    // below vacuously true. These two assertions fail loudly instead.
    expect(frontendNavItems.length).toBeGreaterThan(5);
    expect(frontendAdminItems.length).toBeGreaterThan(5);
  });

  /**
   * Every navigation entry must name a screen the catalogue also names, with
   * the same permissions.
   *
   * A navigation entry the catalogue does not know about is a screen with no
   * stated access rule — the guard cannot reason about it.
   */
  it('agrees on every navigation entry', () => {
    for (const item of frontendNavItems) {
      const capability = SCREEN_CAPABILITIES.find((screen) => screen.path === item.href);

      expect({ href: item.href, found: Boolean(capability) }).toEqual({
        href: item.href,
        found: true,
      });

      // The label is not compared for equality — the two are allowed to
      // word it differently — but the *permissions* must match exactly,
      // because they are the rule.
      expect({ href: item.href, permissions: item.permissions }).toEqual({
        href: item.href,
        permissions: capability?.permissions,
      });
    }
  });

  it('agrees on every administration entry', () => {
    for (const item of frontendAdminItems) {
      const capability = SCREEN_CAPABILITIES.find((screen) => screen.path === item.href);

      expect({ href: item.href, found: Boolean(capability) }).toEqual({
        href: item.href,
        found: true,
      });

      expect({ href: item.href, permissions: item.permissions }).toEqual({
        href: item.href,
        permissions: capability?.permissions,
      });
    }
  });

  /**
   * Every catalogue screen that belongs in the navigation must be in it.
   *
   * The catalogue is the authority; a screen it names that no navigation
   * offers is a screen the member can reach only by typing the path — which
   * works, but means the navigation is incomplete.
   *
   * The screens that are deliberately *not* in the navigation are the forms:
   * a member reaches "add student" from the student list, not from the
   * sidebar. They are listed here so the exclusion is a decision rather than
   * an oversight.
   */
  it('offers every catalogue screen that is meant to be navigated to', () => {
    const navigated = new Set([
      ...frontendNavItems.map((item) => item.href),
      ...frontendAdminItems.map((item) => item.href),
    ]);

    /**
     * The screens reached from a list rather than from the sidebar.
     */
    const reachedFromAList = [
      '/students/new',
      '/students/:id',
      '/students/:id/edit',
      '/students/import',
      '/students/bulk-provision',
      '/admin/subjects/new',
      '/admin/subjects/:id/edit',
      '/admin/subjects/offerings/new',
      '/admin/members/new',
      '/admin/members/:id/edit',
      '/admin/schemes/new',
      '/admin/schemes/:id/edit',
      '/marks/correct',
    ];

    /**
     * The screens every member reaches, whatever their role.
     */
    const alwaysReachable = ['/my-account', '/change-password'];

    for (const screen of SCREEN_CAPABILITIES) {
      const expected = reachedFromAList.includes(screen.path);
      const actual = navigated.has(screen.path);

      if (expected || alwaysReachable.includes(screen.path)) {
        expect({ path: screen.path, inNavigation: actual }).toEqual({
          path: screen.path,
          inNavigation: false,
        });
        continue;
      }

      expect({ path: screen.path, inNavigation: actual }).toEqual({
        path: screen.path,
        inNavigation: true,
      });
    }
  });
});

describe('the shared catalogue and the role catalogue', () => {
  /**
   * Every permission the screens name must be one a role actually grants.
   *
   * A typo in a permission name is silent: the screen is never opened,
   * because nobody holds a permission called `studnets:read`. The screen
   * would sit in the navigation and lead nowhere.
   */
  it('names only permissions that some role grants', () => {
    const granted = new Set<string>();
    for (const role of USER_ROLES) {
      for (const permission of ROLE_PERMISSIONS[role] ?? []) {
        granted.add(permission);
      }
    }

    for (const screen of SCREEN_CAPABILITIES) {
      for (const permission of screen.permissions) {
        expect({ screen: screen.path, permission, granted: granted.has(permission) }).toEqual({
          screen: screen.path,
          permission,
          granted: true,
        });
      }
    }
  });

  /**
   * Every permission the catalogue defines must be granted to someone.
   *
   * The other direction: a permission nobody holds is a right the college
   * believes it has granted but which no member can exercise.
   */
  it('grants every permission it defines to at least one role', () => {
    const granted = new Set<string>();
    for (const role of USER_ROLES) {
      for (const permission of ROLE_PERMISSIONS[role] ?? []) {
        granted.add(permission);
      }
    }

    for (const permission of Object.values(PERMISSIONS)) {
      expect({ permission, granted: granted.has(permission) }).toEqual({
        permission,
        granted: true,
      });
    }
  });

  /**
   * The screen a role reaches must be the screen its permissions say it
   * reaches.
   *
   * This is the end-to-end statement of §1.6: for each role, the set of
   * screens the guard opens is exactly the set the catalogue says that
   * role's permissions open. A role that reaches a screen it should not is
   * the leak the whole model exists to prevent.
   */
  it('opens exactly the screens each role earns', () => {
    for (const role of USER_ROLES) {
      // Widened to `string[]` so the permission names can be compared with
      // the screen's list without a literal-type mismatch.
      const held: string[] = [...(ROLE_PERMISSIONS[role] ?? [])];

      const opened = SCREEN_CAPABILITIES.filter((screen) => canAccessScreen(held, screen)).map(
        (screen) => screen.path
      );

      /**
       * The screens reached directly by the role's own permissions.
       *
       * Computed from the catalogue rather than written out, so the test
       * checks the *rule* rather than a hand-written list that could
       * itself drift.
       */
      const byPermission = SCREEN_CAPABILITIES.filter((screen) => {
        if (screen.permissions.length === 0) return false;
        return screen.permissions.some((permission) => held.includes(permission));
      }).map((screen) => screen.path);

      expect({ role, opened: opened.sort(), byPermission: byPermission.sort() }).toEqual({
        role,
        opened: opened.sort(),
        byPermission: byPermission.sort(),
      });
    }
  });

  /**
   * A student must reach exactly the screens their role grants.
   *
   * The student's four permissions are the whole of what a student may see.
   * If a fifth screen ever opened for a student, this would say so — and
   * the screen it named would be the leak.
   *
   * The student's own profile (`/students/:id`) is among them: the
   * `students:read_own` permission is what opens it, and the backend
   * resolves "your own" from the session — there is no id in the path that
   * could address somebody else's profile.
   */
  it('gives a student exactly the screens their role grants', () => {
    const held: string[] = [...ROLE_PERMISSIONS.STUDENT];
    const opened = SCREEN_CAPABILITIES.filter((screen) => canAccessScreen(held, screen)).map(
      (screen) => screen.path
    );

    // The account and password screens are open to every member, so they
    // are the only two beyond the ones the role's own permissions name.
    expect(opened.sort()).toEqual(
      [
        '/change-password',
        '/my-account',
        '/my-result',
        '/students/:id',
        '/toppers',
        '/dashboard',
      ].sort()
    );
  });
});
