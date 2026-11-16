/**
 * Generates the route inventory that `docs/AUDIT.md` records.
 *
 * The audit has to list every route with its permission and scope. Writing
 * that list by hand is how it goes stale — a route is added, the document is
 * not, and the document claims a coverage it does not have.
 *
 * So the list is **generated from the source**. The same parse the
 * route-permissions parity test uses reads every controller, and this
 * script prints the result. The output goes into the document; the test
 * next door keeps it honest by failing when a route names a permission the
 * catalogue does not define.
 *
 * Run it with:
 *
 * ```
 * pnpm --filter @result-analysis/backend exec jest --testPathPattern "route-inventory" --silent=false
 * ```
 */

import { PERMISSIONS } from '@result-analysis/shared-constants';

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
  summary: string | null;
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

    /**
     * The controller prefix in force at each point of the file.
     */
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

      const permissionsMatch = [...block.matchAll(/@(\w+)\(([^)]*)\)/g)]
        .filter((m) => m[1] === 'Permissions' || m[1] === 'Perms' || m[1] === 'AnyPermission')
        .pop();
      const permissions = permissionsMatch
        ? [...permissionsMatch[2].matchAll(/'([^']+)'/g)].map((m) => m[1])
        : [];

      const summaryMatch = /@ApiOperation\(\s*\{[^}]*summary:\s*'([^']*)'/s.exec(block);

      routes.push({
        controller: prefix,
        routePath: match[2] ?? '',
        method: match[1].toUpperCase(),
        permissions,
        summary: summaryMatch ? summaryMatch[1] : null,
      });
    }
  }

  return routes.sort(
    (a, b) =>
      a.controller.localeCompare(b.controller) ||
      a.routePath.localeCompare(b.routePath) ||
      a.method.localeCompare(b.method)
  );
}

describe('the route inventory', () => {
  it('lists every route', () => {
    const routes = readRoutes();
    const catalogue = new Set<string>(Object.values(PERMISSIONS));

    const lines: string[] = [];
    lines.push('| Method | Path | Permission |');
    lines.push('|---|---|---|');

    let currentController = '';
    for (const route of routes) {
      if (route.controller !== currentController) {
        currentController = route.controller;
        lines.push('');
        lines.push(`**\`${currentController || '(root)'}\`**`);
        lines.push('');
        lines.push('| Method | Path | Permission |');
        lines.push('|---|---|---|');
      }
      const permission = route.permissions.length
        ? route.permissions.map((p) => (catalogue.has(p) ? `\`${p}\`` : `**${p}**`)).join(', ')
        : '_public or member-scoped_';
      lines.push(
        `| ${route.method} | \`/${route.controller}${route.routePath}\` | ${permission} |`
      );
    }

    // eslint-disable-next-line no-console
    console.log('\n' + lines.join('\n'));

    expect(routes.length).toBeGreaterThan(50);
  });
});
