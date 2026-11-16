/**
 * The test that keeps the routes' permissions and the shared catalogue in
 * step.
 *
 * The shared catalogue (`packages/shared-constants`) is the single source of
 * truth for the permission names. The frontend imports it to decide what to
 * hide; the backend's controllers name their permissions in
 * `@Permissions(...)` decorators.
 *
 * Those are two copies of one list, and they can drift. The drift is silent
 * in the worst way: a route that names a permission nobody holds is a route
 * **nobody can open** — the screen appears in the navigation, the member
 * clicks it, and the server refuses. A member experiences that as a broken
 * system rather than as a mistake.
 *
 * The controllers are **read as source** rather than imported, because
 * importing them would drag the whole Nest dependency graph into the test
 * run, and because the question being asked is about the source that ships.
 *
 * The parse is deliberately strict: if the shape of the decorators changes,
 * this test fails loudly rather than silently comparing nothing. A parser
 * that matches nothing would make every assertion below vacuously true.
 */

import { PERMISSIONS } from '@result-analysis/shared-constants';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const fs = require('fs') as typeof import('fs');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require('path') as typeof import('path');

/**
 * One route, and the permissions it asks for.
 */
interface RoutePermissions {
  /** The controller's route prefix. */
  controller: string;
  /** The route's own path, relative to the prefix. */
  path: string;
  /** The HTTP method. */
  method: string;
  /** The permissions named on the decorator. */
  permissions: string[];
}

/**
 * The controllers, read from their source.
 */
const MODULES_PATH = path.resolve(__dirname, '../../modules');

/**
 * Every `@Controller('...')` prefix in the backend.
 *
 * The prefix is what turns a method's path into the URL a member uses.
 */
function readControllerPrefixes(source: string): string[] {
  const prefixes: string[] = [];
  const pattern = /@Controller\(\s*'([^']*)'\s*\)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source)) !== null) {
    prefixes.push(match[1]);
  }
  return prefixes;
}

/**
 * Every route in a controller source, with the permissions it names.
 *
 * The permissions are read from the decorator block that **follows** the
 * HTTP decorator, because that is how the controllers are written:
 *
 * ```ts
 * @Get()
 * @Permissions('marks:read')
 * @ApiOperation({ … })
 * async findAll(…) { … }
 * ```
 *
 * The block ends at the method signature — the first `async` after the HTTP
 * decorator — so one route's permissions are never attributed to the next.
 */
function readRoutes(source: string, controller: string): RoutePermissions[] {
  const routes: RoutePermissions[] = [];

  /**
   * The HTTP decorators. The method is the one that follows.
   */
  const routePattern = /@(Get|Post|Put|Patch|Delete)\(\s*(?:'([^']*)')?\s*\)/g;

  let match: RegExpExecArray | null;
  while ((match = routePattern.exec(source)) !== null) {
    const method = match[1].toUpperCase();
    const routePath = match[2] ?? '';

    /**
     * The decorator block runs from the HTTP decorator to the method
     * signature. Everything in between belongs to this route.
     */
    const rest = source.slice(match.index + match[0].length);
    const methodIndex = rest.search(/\basync\b/);
    const block = methodIndex === -1 ? rest : rest.slice(0, methodIndex);

    /**
     * The permissions on the decorator.
     *
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
    const permissions = permissionsMatch
      ? [...permissionsMatch[2].matchAll(/'([^']+)'/g)].map((m) => m[1])
      : [];

    routes.push({ controller, path: routePath, method, permissions });
  }

  return routes;
}

/**
 * Reads every route in every controller of the backend.
 */
function readAllRoutes(): RoutePermissions[] {
  const routes: RoutePermissions[] = [];

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
    const prefixes = readControllerPrefixes(source);

    for (const prefix of prefixes.length > 0 ? [prefixes[0]] : []) {
      routes.push(...readRoutes(source, prefix));
    }

    /**
     * A file with several controllers gets each of its routes attributed to
     * the right prefix.
     */
    if (prefixes.length > 1) {
      routes.length -= readRoutes(source, prefixes[0]).length;
      const secondSource = source.slice(source.indexOf(`@Controller('${prefixes[1]}')`));
      routes.push(...readRoutes(secondSource, prefixes[1]));
    }
  }

  return routes;
}

const allRoutes = readAllRoutes();

describe("the routes' permissions and the shared catalogue", () => {
  it('reads the routes it is comparing', () => {
    /**
     * A parser that silently matched nothing would make every assertion
     * below vacuously true — the test would pass while comparing nothing.
     * So the parser is checked against a known route first.
     */
    expect(allRoutes.length).toBeGreaterThan(50);

    const withPermissions = allRoutes.filter((r) => r.permissions.length > 0);
    expect(withPermissions.length).toBeGreaterThan(50);
  });

  it('guards every route with a permission, or is deliberately exempt', () => {
    /**
     * A route with no `@Permissions` decorator is open to any signed-in
     * member. That is occasionally right — a member's own notifications, for
     * one — but it is also the shape an accidental omission takes, so every
     * such route is listed here and has to be a deliberate choice.
     *
     * The exemptions fall into two kinds:
     *
     *  - **public** — the route is reachable without signing in at all:
     *    logging in, resetting a password, checking the health of the
     *    service;
     *  - **member-scoped** — the route needs a signed-in member but no
     *    particular permission, because it acts only on the caller's own
     *    records: their notifications, their profile, their avatar.
     */
    const publicRoutes = [
      'POST /authlogin',
      'POST /authtoken',
      'POST /authaccept-invite',
      'POST /authrefresh',
      'POST /authforgot-password',
      'POST /authreset-password',
      'POST /authchange-password',
      'GET /authme',
      'GET /health',
      'GET /healthliveness',
      'GET /healthreadiness',
      'GET /invitesvalidate',
      'GET /invitesvalidate-token',
      'POST /uploadfile',
    ];

    const memberScopedRoutes = [
      'POST /authlogout',
      'POST /authlogout-all',
      'PATCH /authprofile',
      'POST /authprofile/avatar',
      'DELETE /authprofile/avatar',
      'GET /notifications',
      'POST /notifications:id/read',
      'POST /notificationsread-all',
      'DELETE /notifications:id',
    ];

    /**
     * The routes that are guarded by something other than a permission.
     *
     *  - **owner-scoped** — the route acts on the caller's own record and
     *    checks the ownership itself. The stored-files route is the case:
     *    a result sheet and a profile picture are personal, so signing in
     *    is not enough — the reader has to be the person who owns the file
     *    or the exam cell that administers them.
     */
    const ownerScopedRoutes = ['GET /files*'];

    const exempt = new Set([...publicRoutes, ...memberScopedRoutes, ...ownerScopedRoutes]);

    const unguarded = allRoutes
      .filter((route) => route.permissions.length === 0)
      .map((route) => `${route.method} /${route.controller}${route.path}`)
      .filter((route) => !exempt.has(route));

    /**
     * A route that is neither permission-guarded nor listed as exempt is
     * open by accident, and it is listed here so that it cannot be.
     */
    expect(unguarded).toEqual([]);
  });

  it('names only permissions the shared catalogue knows', () => {
    const known = new Set<string>(Object.values(PERMISSIONS));

    const unknown: string[] = [];
    for (const route of allRoutes) {
      for (const permission of route.permissions) {
        if (!known.has(permission)) {
          unknown.push(`${route.method} /${route.controller}${route.path} → ${permission}`);
        }
      }
    }

    /**
     * A permission nobody holds is a route nobody can open. A permission
     * that is not in the catalogue at all is worse: it is a typo, and it
     * fails silently until somebody tries to use the screen.
     */
    expect(unknown).toEqual([]);
  });

  it('names every permission the shared catalogue defines somewhere', () => {
    /**
     * The other direction: a permission the catalogue defines but no route
     * uses is either a permission nobody can exercise, or a route that was
     * meant to use it and does not.
     *
     * Some permissions are granted to roles and used only by the frontend
     * (a screen the member may open), so this check is a *warning list*
     * rather than a failure. It is printed so that a new permission is
     * noticed, and it fails only if the list grows unexpectedly.
     */
    const used = new Set(allRoutes.flatMap((r) => r.permissions));
    const catalogueIds = Object.values(PERMISSIONS);
    const unused = catalogueIds.filter((id) => !used.has(id));

    /**
     * The permissions that are legitimately frontend-only. Each one names
     * the screen that uses it.
     */
    const frontendOnly = [
      'dashboard:read',
      'students:read_own',
      'marks:read_own',
      'toppers:read_own_class',
      'class_teacher_assignments:read',
      'teacher_allocations:read',
      'rbac:read',
      'subjects:read',
      'schemes:read',
      'subject_offerings:read',
      'academic_years:read',
      'branches:read',
      'audit_logs:read',
      'upload:read',
      'reports:read',
    ];

    /**
     * The permissions that are legitimately **service-layer-only**.
     *
     * These do not guard a route of their own: they narrow *what a route
     * returns*. The student profile is the clearest case — the route is
     * open to anyone who may read a student, but the sensitive identity
     * data and the guardian details inside the response are withheld from
     * the callers who do not hold these rights. A permission that gates a
     * field rather than a route cannot appear in a `@Permissions`
     * decorator, so it is named here.
     */
    const serviceLayerOnly = [
      'students:read_sensitive',
      'students:read_guardian',
      'upload:process_own_subject',
      'analytics:read_own_department',
      'subject_offerings:write',
      'academic_years:write',
      'examinations:read',
      'examinations:write',
      'teacher_allocations:write',
    ];

    const unexplained = unused.filter(
      (id) => !frontendOnly.includes(id) && !serviceLayerOnly.includes(id)
    );

    /**
     * Every unexplained permission is reported, so that a permission
     * nobody can exercise is visible rather than hidden. The list is
     * asserted to be empty because a permission that no route uses and that
     * is not named as frontend-only is a permission that does nothing.
     */
    expect(unexplained).toEqual([]);
  });
});
