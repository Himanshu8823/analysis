/**
 * Jest configuration for the shared constants package.
 *
 * The package is a small library of rules that both the backend and the
 * frontend import. Its rules are the ones that must never disagree between
 * the two — the semester → year derivation, the running-year rule, the
 * screen catalogue — so they are tested here, on their own, rather than
 * only through whichever side happens to use them.
 *
 * The setup mirrors the backend's: `ts-jest` transforms the TypeScript
 * sources, and the tests run in the `node` environment, because a rule
 * about dates and permissions has no DOM in it.
 *
 * The tests import the modules under test by their **relative** path
 * (`./running-year`) rather than through the package's own name. A test
 * that imported `@result-analysis/shared-constants` would be testing the
 * built `dist/` folder rather than the source, and would quietly keep
 * passing against a stale build.
 */

/** @type {import('jest').Config} */
module.exports = {
  rootDir: '.',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/**/*.spec.ts'],
  transform: {
    '^.+\\.(t|j)s$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
      },
    ],
  },
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/*.spec.ts'],
  coverageDirectory: 'coverage',
  clearMocks: true,
  restoreMocks: true,
};
