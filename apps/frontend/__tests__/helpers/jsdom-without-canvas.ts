/**
 * A jsdom environment that does not need the native `canvas` package.
 *
 * `jest-environment-jsdom` loads jsdom in the **host** Node context, before
 * Jest's module registry exists — so `moduleNameMapper` cannot redirect
 * jsdom's own `require("canvas")`. On a machine where the `canvas` package
 * is installed but its native binding was never built, that require throws
 * `Cannot find module '../build/Release/canvas.node'` and the whole
 * environment fails to start, before a single test runs.
 *
 * jsdom treats `canvas` as optional: it probes for it with
 * `require.resolve`, and falls back to "no canvas" when it is absent. This
 * environment makes that probe fail the way it would on a machine without
 * the package — by making `require.resolve('canvas')` throw — so jsdom takes
 * the fallback branch and starts cleanly.
 *
 * The application draws its charts as SVG and never needs a raster canvas,
 * so nothing the tests do is affected.
 */

const Module = require('module');
const originalResolve = Module._resolveFilename;

/**
 * The canvas package's entry point, matched exactly.
 *
 * The match is exact rather than a prefix so that only the optional
 * dependency is intercepted — a nested require inside some other package
 * named `canvas-something` must still resolve normally.
 */
const CANVAS_ENTRY = 'canvas';

Module._resolveFilename = function resolveFilename(
  request: string,
  ...rest: unknown[]
): string {
  if (request === CANVAS_ENTRY) {
    const error = new Error(
      `Cannot find module '${CANVAS_ENTRY}' — the native canvas binding is not built on this machine, and the frontend tests do not need it.`,
    );
    (error as NodeJS.ErrnoException).code = 'MODULE_NOT_FOUND';
    throw error;
  }
  return originalResolve.call(this, request, ...rest);
};

const JSDOMEnvironment = require('jest-environment-jsdom').default;

module.exports = JSDOMEnvironment;
