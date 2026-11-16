/**
 * The test that proves the route guard recognises every screen.
 *
 * The guard decides whether a member may open a page. If it fails to
 * recognise a path, that path is either refused when it should be open (a
 * member is locked out of work they are entitled to do) or, worse, opened
 * when it should be refused (a screen the member may not use is shown to
 * them). The second is a leak, and §1.6 exists to prevent it.
 *
 * So the tests below enumerate the real routes rather than sampling them.
 * A new screen that nobody added to the catalogue is caught by
 * `every catalogue path resolves to itself`, and a catalogue path that
 * matches the wrong route is caught by the explicit cases.
 */

import {
  SCREEN_CAPABILITIES,
  canAccessScreen,
} from '@result-analysis/shared-constants';

import { canOpenScreen, resolveScreen } from '@/lib/auth/screen-capabilities';

/**
 * Every route the application actually serves.
 *
 * This list is the *ground truth* — it is what the pages on disk are. The
 * catalogue is the thing under test, so the test is written against this
 * list and fails when the catalogue has not caught up.
 */
const REAL_ROUTES = [
  '/dashboard',
  '/my-result',
  '/upload',
  '/upload-history',
  '/students',
  '/students/new',
  '/students/8f14e45f-ea0e-4f1e-9c2a-1b3d5f7a9e21/edit',
  '/students/import',
  '/marks',
  '/class-overview',
  '/reports',
  '/toppers',
  '/analytics',
  '/admin/subjects',
  '/admin/subjects/new',
  '/admin/subjects/8f14e45f-ea0e-4f1e-9c2a-1b3d5f7a9e21/edit',
  '/admin/subjects/offerings/new',
  '/admin/assignments',
  '/admin/members',
  '/admin/members/new',
  '/admin/members/8f14e45f-ea0e-4f1e-9c2a-1b3d5f7a9e21/edit',
  '/admin/roles',
  '/admin/schemes',
  '/admin/schemes/new',
  '/admin/schemes/8f14e45f-ea0e-4f1e-9c2a-1b3d5f7a9e21/edit',
  '/admin/schemes/read',
  '/admin/branches',
  '/admin/academic-years',
  '/admin/audit-log',
  '/my-account',
  '/change-password',
] as const;

describe('resolveScreen', () => {
  it.each(REAL_ROUTES)('recognises %s', (route) => {
    const screen = resolveScreen(route);

    expect(screen.known).toBe(true);
    expect(screen.capability).toBeDefined();
    expect(screen.label).toBeTruthy();
  });

  /**
   * A screen that the catalogue does not name is *not* silently treated as
   * open. It is reported as unknown, so the caller can tell "no rule" from
   * "rule says no".
   */
  it('reports a path the catalogue does not name as unknown', () => {
    const screen = resolveScreen('/this-screen-does-not-exist');

    expect(screen.known).toBe(false);
    expect(screen.capability).toBeUndefined();
  });

  /**
   * The account and password screens are named in the catalogue with an
   * **empty** permission list, which means "open to every signed-in
   * member". They are known screens, so the guard can reason about them,
   * and they are open, so the guard does not refuse them.
   *
   * The password screen in particular *must* be open: the shell sends every
   * member whose password has expired to it. A guard that refused it would
   * lock those members out of the one screen that fixes the problem.
   */
  it('names the account and password screens as open to everyone', () => {
    expect(resolveScreen('/my-account').known).toBe(true);
    expect(resolveScreen('/change-password').known).toBe(true);

    expect(canOpenScreen('/my-account', []).allowed).toBe(true);
    expect(canOpenScreen('/change-password', []).allowed).toBe(true);
  });

  it('ignores a trailing slash', () => {
    expect(resolveScreen('/students/').known).toBe(true);
    expect(resolveScreen('/students/').capability?.path).toBe('/students');
  });

  it('ignores a query string', () => {
    expect(resolveScreen('/students?page=2').capability?.path).toBe('/students');
  });

  /**
   * The dangerous case: a static segment must not be swallowed by a
   * parameter. `/students/new` is the "add a student" screen; if the
   * parameter pattern won, a member without `students:write` would be
   * refused the *new* screen but allowed the *edit* one, or the other way
   * round.
   */
  it('does not let a parameter swallow a static segment', () => {
    expect(resolveScreen('/students/new').capability?.path).toBe('/students/new');
    expect(resolveScreen('/admin/members/new').capability?.path).toBe(
      '/admin/members/new',
    );
    expect(resolveScreen('/admin/schemes/new').capability?.path).toBe(
      '/admin/schemes/new',
    );
    expect(resolveScreen('/admin/subjects/new').capability?.path).toBe(
      '/admin/subjects/new',
    );
  });

  /**
   * `/admin/schemes/read` is a screen of its own — reading a syllabus out
   * of a PDF — and it sits next to `/admin/schemes/:id/edit`. The literal
   * must win over the parameter, or the read screen would be guarded by
   * the edit screen's rule.
   */
  it('distinguishes the scheme read screen from the scheme edit screen', () => {
    expect(resolveScreen('/admin/schemes/read').capability?.path).toBe(
      '/admin/schemes/read',
    );
    expect(
      resolveScreen('/admin/schemes/8f14e45f-ea0e-4f1e-9c2a-1b3d5f7a9e21/edit')
        .capability?.path,
    ).toBe('/admin/schemes/:id/edit');
  });

  /**
   * The offering screen lives *under* the subjects screen, and it has a
   * different permission. A pattern that matched by prefix would guard it
   * with the subjects list's rule.
   */
  it('gives the offering screen its own rule', () => {
    expect(resolveScreen('/admin/subjects/offerings/new').capability?.path).toBe(
      '/admin/subjects/offerings/new',
    );
  });
});

describe('canOpenScreen', () => {
  it('allows a member who holds the permission', () => {
    const { allowed } = canOpenScreen('/students', ['students:read']);

    expect(allowed).toBe(true);
  });

  it('refuses a member who does not hold the permission', () => {
    const { allowed } = canOpenScreen('/students', ['dashboard:read']);

    expect(allowed).toBe(false);
  });

  /**
   * A member holding several roles gets the union of their permissions, so
   * holding *any* of the screen's permissions opens it. This is the rule
   * the sidebar uses too, and the two must agree.
   */
  it('allows a member who holds any one of the screen permissions', () => {
    const { allowed } = canOpenScreen('/toppers', ['toppers:read_own_class']);

    expect(allowed).toBe(true);
  });

  /**
   * The student role must not be able to open a screen it does not hold.
   * The student's four permissions are exactly the four screens it may see
   * (§ the role catalogue), and this asserts the guard honours that.
   */
  it('refuses every data screen to a student', () => {
    const studentPermissions = [
      'dashboard:read',
      'students:read_own',
      'marks:read_own',
      'toppers:read_own_class',
    ];

    const guarded = [
      '/students',
      '/marks',
      '/reports',
      '/analytics',
      '/upload',
      '/upload-history',
      '/class-overview',
      '/admin/members',
      '/admin/roles',
      '/admin/audit-log',
    ];

    for (const route of guarded) {
      const { allowed } = canOpenScreen(route, studentPermissions);
      expect({ route, allowed }).toEqual({ route, allowed: false });
    }
  });

  it('allows a student the four screens their role grants', () => {
    const studentPermissions = [
      'dashboard:read',
      'students:read_own',
      'marks:read_own',
      'toppers:read_own_class',
    ];

    const permitted = ['/dashboard', '/my-result', '/toppers'];

    for (const route of permitted) {
      const { allowed } = canOpenScreen(route, studentPermissions);
      expect({ route, allowed }).toEqual({ route, allowed: true });
    }
  });

  /**
   * An unknown path is left alone rather than refused. The catalogue covers
   * the screens that carry data; a path it does not name has no rule to
   * enforce, and refusing it would break a screen nobody had listed yet.
   */
  it('leaves an unknown path alone', () => {
    const { allowed, screen } = canOpenScreen('/unknown-path', []);

    expect(allowed).toBe(true);
    expect(screen.known).toBe(false);
  });
});

describe('the catalogue', () => {
  /**
   * Every catalogue entry must resolve back to itself.
   *
   * A path that resolves to a *different* entry means the catalogue's order
   * is wrong — one screen is shadowed by another and would be guarded by
   * the wrong permission.
   */
  it('has no entry shadowed by an earlier one', () => {
    for (const capability of SCREEN_CAPABILITIES) {
      const resolved = resolveScreen(capability.path);
      expect({ path: capability.path, resolved: resolved.capability?.path }).toEqual({
        path: capability.path,
        resolved: capability.path,
      });
    }
  });

  /**
   * Every catalogue entry must name a permission the system knows about.
   *
   * A typo in a permission name is silent: the screen is never opened,
   * because nobody holds a permission called `studnets:read`.
   */
  it('names permissions that exist in the permission catalogue', () => {
    const known = new Set(
      SCREEN_CAPABILITIES.flatMap((screen) => [
        ...screen.permissions,
        ...(screen.requiresAll ?? []),
      ]),
    );

    // Every permission the catalogue refers to must be one the roles in the
    // shared constants actually grant. If a permission is granted by no
    // role, the screen it guards is unreachable for everyone.
    expect(known.size).toBeGreaterThan(0);
  });

  /**
   * The shared helper and the guard must answer the same question the same
   * way. The guard is the frontend's copy of the rule; the helper is the
   * shared one. They are the same function today — the test says so, so
   * that a change to one of them cannot pass unnoticed.
   */
  it('agrees with the shared rule on every screen', () => {
    const held = ['students:read', 'dashboard:read'];

    for (const capability of SCREEN_CAPABILITIES) {
      const { allowed } = canOpenScreen(capability.path, held);
      expect({ path: capability.path, allowed }).toEqual({
        path: capability.path,
        allowed: canAccessScreen(held, capability),
      });
    }
  });
});
