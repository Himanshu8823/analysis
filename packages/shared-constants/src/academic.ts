/**
 * The semester → year derivation.
 *
 * The college's curriculum runs on semesters; the "year of study" is a
 * grouping *above* them (Sem 1–2 → Year 1, Sem 3–4 → Year 2, …). The
 * derivation lives here — once — and both the backend and the frontend import
 * it, so the two can never disagree about which year a student in Semester 5
 * belongs to.
 *
 * This matters because the two used to be stored independently, which allowed
 * a student to be recorded as "Year 3, Semester 1" — a state that describes
 * nobody.
 *
 * ## Why there are two functions
 *
 * `semesterToYear` **rejects** a semester the college does not run: it
 * returns `undefined`, so a caller that is validating input can refuse it.
 * `yearForSemester` **clamps** one: it returns the nearest year, so a
 * caller that is *displaying* a value never shows a blank.
 *
 * The distinction is deliberate. Silently filing an unknown semester under
 * year 1 would record a student in a year they are not in; silently showing
 * a blank on a list would make the screen look broken. Two callers, two
 * needs, two named functions — rather than one function with a flag that
 * each caller has to remember to set correctly.
 */

/** The semesters that make up each year of study. */
export const YEAR_SEMESTERS: Readonly<Record<number, readonly number[]>> = {
  1: [1, 2],
  2: [3, 4],
  3: [5, 6],
  4: [7, 8],
} as const;

/** The semesters the college runs. */
export const SUPPORTED_SEMESTERS: readonly number[] = [1, 2, 3, 4, 5, 6, 7, 8];

/** The longest course the app models — four years, eight semesters. */
export const MAX_YEAR = 4;

/** The longest course's last semester. */
export const MAX_SEMESTER = MAX_YEAR * 2;

/**
 * The year of study a semester belongs to.
 *
 * `undefined` for a semester the college does not run, so a caller can reject
 * it rather than silently filing it under year 1.
 */
export function semesterToYear(semester: number): number | undefined {
  for (const [year, semesters] of Object.entries(YEAR_SEMESTERS)) {
    if (semesters.includes(semester)) return Number(year);
  }
  return undefined;
}

/**
 * The year a semester belongs to, clamped to the course.
 *
 * Semester 1 and 2 are year 1, semester 3 and 4 are year 2, and so on. A
 * semester outside the course is clamped to the nearest year rather than
 * producing an invalid one — this is the function for *display*, where a
 * blank would be worse than an approximation.
 *
 * To *reject* an out-of-range semester instead, use `semesterToYear`, which
 * returns `undefined`.
 */
export function yearForSemester(semester: number): number {
  if (!Number.isFinite(semester) || semester < 1) return 1;
  const year = Math.ceil(semester / 2);
  return Math.min(Math.max(year, 1), MAX_YEAR);
}

/**
 * The semesters that make up a year of study.
 */
export function yearToSemesters(year: number): readonly number[] {
  return YEAR_SEMESTERS[year] ?? [];
}

/**
 * The semesters offered in a dropdown, in order.
 */
export const ALL_SEMESTERS: readonly number[] = SUPPORTED_SEMESTERS;

/**
 * Checks that a year and a semester agree.
 *
 * Returns `null` when they agree, and a sentence explaining the mismatch when
 * they do not — the message is written for the person filling in the form,
 * not for a developer.
 */
export function validateYearSemester(
  year: number | undefined,
  semester: number
): string | null {
  if (!SUPPORTED_SEMESTERS.includes(semester)) {
    return `Semester ${semester} is not one this college runs. Choose a semester between 1 and ${SUPPORTED_SEMESTERS.length}.`;
  }
  const derived = semesterToYear(semester);
  if (derived === undefined) {
    return `Semester ${semester} does not belong to any year of study.`;
  }
  if (year !== undefined && year !== derived) {
    return `Semester ${semester} belongs to Year ${derived}, not Year ${year}.`;
  }
  return null;
}
