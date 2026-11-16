'use client';

import {
  SCREEN_CAPABILITIES,
  canAccessScreen,
  type ScreenCapability,
} from '@result-analysis/shared-constants';

/**
 * The frontend's view of which screen needs which permission.
 *
 * The catalogue lives in `packages/shared-constants` because both sides must
 * agree on it: the backend refuses a request the server says the member may
 * not make, and the frontend must not *show* a screen the server will refuse
 * (§1.6). Two copies of that list would drift, and the drift would show up
 * as a screen the member can open and cannot use.
 *
 * The backend's Jest configuration maps this package to its TypeScript
 * source, so a test there can compare the two sides directly — that test is
 * `capabilities-parity.spec.ts` in the backend.
 *
 * What this module adds is the *routing* half: turning a pathname into the
 * screen it names. The catalogue gives a path per screen; a page like
 * `/students/abc/edit` has to be recognised as `/students/:id/edit`.
 */

/**
 * A screen, resolved from a pathname.
 *
 * `capability` is `undefined` for a path the catalogue does not name — a
 * screen that exists but has no declared access rule. Those are handled by
 * `isKnownScreen` rather than being silently treated as open.
 */
export interface ResolvedScreen {
  /** The pathname that was looked up. */
  path: string;
  /** The catalogue entry, when the path names a screen. */
  capability?: ScreenCapability;
  /** The label to show the member. */
  label: string;
  /** True when the catalogue names this path. */
  known: boolean;
}

/**
 * Matches a pathname against a catalogue path pattern.
 *
 * The pattern uses `:name` for a parameter, so `/students/:id/edit` matches
 * `/students/9f2c.../edit`. Segments are compared one by one, so
 * `/students/new` never matches `/students/:id` — a static segment must
 * equal, a parameter matches any single segment.
 *
 * A pattern that ends in `/*` matches the path and everything under it.
 */
function matchesPattern(pattern: string, path: string): boolean {
  if (pattern.endsWith('/*')) {
    const prefix = pattern.slice(0, -2);
    return path === prefix || path.startsWith(`${prefix}/`);
  }

  const patternParts = pattern.split('/').filter(Boolean);
  const pathParts = path.split('/').filter(Boolean);

  if (patternParts.length !== pathParts.length) return false;

  return patternParts.every((part, index) => {
    if (part.startsWith(':')) return pathParts[index].length > 0;
    return part === pathParts[index];
  });
}

/**
 * Finds the screen a pathname names.
 *
 * The catalogue is scanned in order and the *first* match wins. The order
 * matters: `/students/:id/edit` and `/students/new` are different screens,
 * and a path such as `/students/new` must not be swallowed by a looser
 * pattern that happens to appear earlier.
 */
export function resolveScreen(pathname: string): ResolvedScreen {
  const path = normalise(pathname);

  for (const capability of SCREEN_CAPABILITIES) {
    if (matchesPattern(capability.path, path)) {
      return {
        path,
        capability,
        label: capability.label,
        known: true,
      };
    }
  }

  return {
    path,
    label: 'this screen',
    known: false,
  };
}

/**
 * Answers "may this member open this screen?".
 *
 * A path the catalogue does not name is **not** automatically open. It is
 * also not automatically closed — the screen may be one the backend guards
 * but the catalogue has not caught up with. The two are told apart by
 * `known`, so the caller can decide: a known screen that the member may not
 * open gets the `NoAccess` page, and an unknown one falls back to whatever
 * the screen itself does.
 */
export function canOpenScreen(
  pathname: string,
  heldPermissions: readonly string[],
): { allowed: boolean; screen: ResolvedScreen } {
  const screen = resolveScreen(pathname);
  if (!screen.capability) {
    return { allowed: true, screen };
  }
  return { allowed: canAccessScreen(heldPermissions, screen.capability), screen };
}

/**
 * Removes the trailing slash and the query string.
 *
 * A trailing slash must not make `/students/` a different screen from
 * `/students`, and a query string is not part of a route.
 */
function normalise(pathname: string): string {
  const withoutQuery = pathname.split('?')[0].split('#')[0];
  if (withoutQuery.length > 1 && withoutQuery.endsWith('/')) {
    return withoutQuery.slice(0, -1);
  }
  return withoutQuery;
}
