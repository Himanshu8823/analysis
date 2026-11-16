/**
 * The test that every route is reachable by someone.
 *
 * A route guarded by two permissions under the `every` rule needs a member
 * who holds **both**. If no role holds both, the route is unreachable — it
 * appears in the navigation, the member clicks it, and the server refuses.
 * The member experiences that as a broken system.
 *
 * This is not hypothetical. It is how `POST /upload/jobs/:jobId/confirm`
 * came to be guarded on `upload:read` — a *read* permission — because the
 * guard could not express "either the exam cell's right or the teacher's
 * right", and the two are different permissions that no single role holds
 * together with a write right.
 *
 * The test therefore checks two things:
 *
 *  1. **reachability** — for every route, some role can open it;
 *  2. **the mode** — a route whose permissions are held by *different* roles
 *     but by *no single* role together needs `@AnyPermission`, and says so.
 */

import { ROLE_PERMISSIONS } from '@result-analysis/shared-constants';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const fs = require('fs') as typeof import('fs');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require('path') as typeof import('path');

const MODULES_PATH = path.resolve(__dirname, '../../modules');

interface Route {
  controller: string;
  routePath: string;
  method: string;
  permissions: string[];
  mode: 'every' | 'some';
}

function readRoutes(): Route[] {
  const routes: Route[] = [];

  const controllerFiles: string[] = [];
  for (const entry of fs.readdirSync(MODULES_PATH, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const modulePath = path.join(MODULES_PATH, entry.name);
    for (const file of fs.readdirSync(modulePath, { withFileTypes: true })) {
      if (file.isFile() && file.name.endsWith('.controller.ts')) {
        controllerFiles.push(path.join(modulePath, file.name));
      }
    }
  }

  for (const file of controllerFiles) {
    const source = fs.readFileSync(file, 'utf8');

    const prefixEvents: Array<{ index: number; prefix: string }> = [];
    const controllerPattern = /@Controller\(\s*'([^']*)'\s*\)/g;
    let controllerMatch: RegExpExecArray | null;
    while ((controllerMatch = controllerPattern.exec(source)) !== null) {
      prefixEvents.push({ index: controllerMatch.index, prefix: controllerMatch[1] });
    }

    const routePattern = /@(Get|Post|Put|Patch|Delete)\(\s*(?:'([^']*)')?\s*\)/g;
    let match: RegExpExecArray | null;
    while ((match = routePattern.exec(source)) !== null) {
      const prefix = [...prefixEvents].reverse().find((e) => e.index < match!.index)?.prefix ?? '';

      const rest = source.slice(match.index + match[0].length);
      const methodIndex = rest.search(/\basync\b/);
      const block = methodIndex === -1 ? rest : rest.slice(0, methodIndex);

      /**
       * The decorator is matched by **any** name it was imported under — a
       * controller may import it as `Permissions` or alias it (`Permissions as
       * Perms`) to free the word for the domain. Matching only one spelling
       * would silently report an aliased controller's routes as unguarded,
       * which reads as a security hole that does not exist.
       *
       * `AnyPermission` is the same decorator with a different matching rule
       * ("any of these" rather than "all of these"), and it guards a route
       * just as much — so it is read the same way.
       */
      const permissionsMatch = [...block.matchAll(/@(\w+)\(([^)]*)\)/g)]
        .filter((m) => m[1] === 'Permissions' || m[1] === 'Perms' || m[1] === 'AnyPermission')
        .pop();

      /**
       * `matchAll` gives `[whole, name, arguments]` — the permissions are
       * the **third** part.
       */
      const permissions = permissionsMatch
        ? [...permissionsMatch[2].matchAll(/'([^']+)'/g)].map((m) => m[1])
        : [];

      routes.push({
        controller: prefix,
        routePath: match[2] ?? '',
        method: match[1].toUpperCase(),
        permissions,
        mode: block.includes('@AnyPermission(') ? 'some' : 'every',
      });
    }
  }

  return routes;
}

const allRoutes = readRoutes();

/**
 * Every role's permission set.
 */
const roleSets = Object.entries(ROLE_PERMISSIONS).map(([role, permissions]) => ({
  role,
  permissions: new Set<string>(permissions),
}));

describe('every route is reachable by someone', () => {
  it('reads the routes it is checking', () => {
    expect(allRoutes.length).toBeGreaterThan(50);
    expect(allRoutes.filter((r) => r.permissions.length > 0).length).toBeGreaterThan(50);
  });

  it('is openable by at least one role', () => {
    /**
     * A route that no role can open is a dead screen. The member is shown
     * the link, clicks it, and is refused — and the refusal says nothing
     * about why.
     */
    const unreachable: string[] = [];

    for (const route of allRoutes) {
      if (route.permissions.length === 0) continue;

      const openable = roleSets.some(({ permissions }) =>
        route.mode === 'some'
          ? route.permissions.some((p) => permissions.has(p))
          : route.permissions.every((p) => permissions.has(p))
      );

      if (!openable) {
        unreachable.push(
          `${route.method} /${route.controller}${route.routePath} → ${route.permissions.join(' + ')}`
        );
      }
    }

    expect(unreachable).toEqual([]);
  });

  it('names its permissions as alternatives when more than one role uses it', () => {
    /**
     * The mechanical half of the rule: a route whose permissions are held by
     * *different* roles but by *no single* role together needs
     * `@AnyPermission`. Under `every` it opens for nobody.
     */
    const suspicious: string[] = [];

    for (const route of allRoutes) {
      if (route.permissions.length < 2 || route.mode === 'some') continue;

      const heldBySomeRole = route.permissions.some((p) =>
        roleSets.some(({ permissions }) => permissions.has(p))
      );
      const heldByOneRole = roleSets.some(({ permissions }) =>
        route.permissions.every((p) => permissions.has(p))
      );

      if (heldBySomeRole && !heldByOneRole) {
        suspicious.push(
          `${route.method} /${route.controller}${route.routePath} → ${route.permissions.join(' + ')}`
        );
      }
    }

    expect(suspicious).toEqual([]);
  });

  it('opens a route to every role that holds one of its permissions', () => {
    /**
     * The rule that catches the bug this file was written for.
     *
     * Under the `every` rule, a route that names two permissions needs a
     * member who holds **both**. A role that holds only one is refused —
     * even though the route is meant for them, and even though the screen
     * that links to it is in their navigation.
     *
     * That is how `GET /marks` came to be closed to the HOD and the
     * Principal: the route named `marks:read` and `marks:enter_own_subject`,
     * and neither of those roles may enter marks. They hold the first, they
     * were refused for not holding the second, and the member saw a screen
     * they could not open.
     *
     * So: a route that names several permissions and is meant to be used by
     * roles with **different** permissions must say "any of". A route whose
     * permissions are meant to be held **together** must keep `every`.
     *
     * The distinction is made by the route's own declaration, so the check
     * is the same one the guard applies.
     */
    const lockedOut: string[] = [];

    for (const route of allRoutes) {
      if (route.permissions.length < 2) continue;

      /**
       * The rule the guard applies for this route.
       */
      const mayOpen = (permissions: Set<string>): boolean =>
        route.mode === 'some'
          ? route.permissions.some((p) => permissions.has(p))
          : route.permissions.every((p) => permissions.has(p));

      /**
       * The roles that hold at least one of the permissions — the roles
       * the route is for. A role that holds none is not expected to open
       * it, and is not a failure.
       */
      const intended = roleSets.filter(({ permissions }) =>
        route.permissions.some((p) => permissions.has(p))
      );

      for (const { role, permissions } of intended) {
        if (!mayOpen(permissions)) {
          lockedOut.push(
            `${route.method} /${route.controller}${route.routePath} → ${role} holds ` +
              `${route.permissions.filter((p) => permissions.has(p)).join(', ')} but not all of them`
          );
        }
      }
    }

    expect(lockedOut).toEqual([]);
  });
});
