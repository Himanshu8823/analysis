/**
 * Jest configuration for the frontend.
 *
 * The frontend had no test runner at all until now. This config mirrors the
 * backend's so the two halves of the monorepo are run the same way:
 *
 *  - `next/jest` transforms TypeScript through the same SWC pipeline the
 *    application is built with, so a test sees the same module resolution
 *    and the same compiler options the app does.
 *  - `jsdom` is the environment, because the frontend is a browser
 *    application and the tests are about what a person sees.
 *  - The `@/` alias matches `tsconfig.json`, so a test imports the module
 *    under test by the same path the application does.
 *
 * The `shared-constants` and `shared-types` packages are mapped to their
 * TypeScript sources, exactly as the backend's Jest config does. Both are
 * `private` packages whose `main` points at source, so there is nothing to
 * build before the tests can run.
 */

/**
 * `next/jest` returns an **async** function — Jest awaits it — so the
 * export here is async too. It reads `next.config.js` and the application's
 * `tsconfig.json` on its own, which is why the `@/` alias and the shared
 * packages still have to be named: `next/jest` handles the application's own
 * paths but knows nothing about the workspace packages.
 */
const createJestConfig = require('next/jest')({
  // Next.js reads this to know the project root.
  dir: __dirname,
});

/** @type {import('jest').Config} */
const config = {
  /**
   * The custom environment.
   *
   * `jest-environment-jsdom` would load jsdom with the native `canvas`
   * package present but unbuilt, and jsdom would then throw while starting
   * — before a single test runs. The custom environment makes jsdom take its
   * "canvas is not installed" branch, which is the branch a machine without
   * the package would take.
   */
  testEnvironment: '<rootDir>/__tests__/helpers/jsdom-without-canvas.ts',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    // The application's own alias, matching `tsconfig.json`.
    '^@/(.*)$': '<rootDir>/$1',
    /**
     * jsdom loads `canvas` when it can resolve it. On this machine the
     * package is present but its native binding was never built, so the
     * require throws and takes the whole environment down. The stub
     * satisfies the optional-dependency check; the application draws its
     * charts as SVG and never needs the real thing.
     */
    '^canvas$': '<rootDir>/__tests__/helpers/canvas-mock.ts',
    // The shared packages, mapped to their TypeScript sources.
    '^@result-analysis/shared-types$':
      '<rootDir>/../../packages/shared-types/src/index.ts',
    '^@result-analysis/shared-types/(.*)$':
      '<rootDir>/../../packages/shared-types/src/$1',
    '^@result-analysis/shared-constants$':
      '<rootDir>/../../packages/shared-constants/src/index.ts',
  },
  testMatch: ['<rootDir>/**/*.spec.ts', '<rootDir>/**/*.spec.tsx'],
  testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/.next/'],
  collectCoverageFrom: [
    'components/**/*.{ts,tsx}',
    'lib/**/*.{ts,tsx}',
    'hooks/**/*.{ts,tsx}',
  ],
  coverageDirectory: '../coverage/frontend',
  clearMocks: true,
  restoreMocks: true,
};

module.exports = async () => {
  const resolved = await createJestConfig(config)();
  return resolved;
};
