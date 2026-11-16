/**
 * The academic calendar helpers.
 *
 * A year is not chosen independently of a semester — it follows from it,
 * because the syllabus is laid out so that the first year of the course
 * covers semesters 1 and 2, the second year covers 3 and 4, and so on.
 *
 * ## Why this file exists in the backend
 *
 * The same derivation lives in `packages/shared-constants/src/academic.ts`.
 * The backend could import it — the package is built to `dist/` and the
 * backend's `tsconfig.json` maps to its declarations — but the *production*
 * code deliberately keeps its own copy.
 *
 * The reason is the build output. A runtime import of a workspace package
 * moves TypeScript's common root directory to the monorepo root, and the
 * build output moves from `dist/main.js` to
 * `dist/apps/backend/src/main.js`, which breaks the start script. The
 * backend's own copy keeps the output where the deployment expects it.
 *
 * The cost is that two copies of the rule exist, and the risk that they
 * drift. That risk is closed by a test rather than by care: see
 * `academic.spec.ts` for the behaviour and `academic-parity.spec.ts` for
 * the proof that the two copies agree.
 *
 * The copy is deliberately written to read like the shared one — same
 * names, same clamping, same refusal — so a reader comparing the two sees
 * a match rather than a difference.
 */

/** The semesters each year of the course covers. */
const SEMESTERS_PER_YEAR = 2;

/** The longest course the app models — four years, eight semesters. */
export const MAX_YEAR = 4;
export const MAX_SEMESTER = MAX_YEAR * SEMESTERS_PER_YEAR;

/**
 * The year a semester belongs to.
 *
 * Semester 1 and 2 are year 1, semester 3 and 4 are year 2, and so on. A
 * semester outside the course is clamped to the nearest year rather than
 * producing an invalid one.
 */
export function yearForSemester(semester: number): number {
  if (!Number.isFinite(semester) || semester < 1) return 1;
  const year = Math.ceil(semester / SEMESTERS_PER_YEAR);
  return Math.min(Math.max(year, 1), MAX_YEAR);
}

/**
 * The year a semester belongs to, or `undefined` when the college does not
 * run that semester.
 *
 * This is the *rejecting* form: a caller validating an input uses it to
 * refuse a semester the college does not run, rather than filing it under
 * year 1.
 */
export function semesterToYear(semester: number): number | undefined {
  if (!Number.isInteger(semester) || semester < 1 || semester > MAX_SEMESTER) {
    return undefined;
  }
  return yearForSemester(semester);
}

/**
 * The semesters a year covers — the two that make it up.
 *
 * Used to keep a semester dropdown in step with the year, so the two can
 * never disagree.
 */
export function semestersForYear(year: number): number[] {
  const first = (year - 1) * SEMESTERS_PER_YEAR + 1;
  return [first, first + 1];
}

/** The semesters offered in the dropdown, in order. */
export const ALL_SEMESTERS: number[] = Array.from(
  { length: MAX_SEMESTER },
  (_, index) => index + 1
);
