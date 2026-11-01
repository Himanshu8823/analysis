/**
 * The academic calendar helpers shared by the student forms.
 *
 * A student's year is not chosen independently — it follows from the
 * semester they are in, because the syllabus is laid out so that the first
 * year of the course covers semesters 1 and 2, the second year covers 3
 * and 4, and so on.
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
 * The semesters a year covers — the two that make up it.
 *
 * Used to keep the semester dropdown in step with the year, so the two can
 * never disagree.
 */
export function semestersForYear(year: number): number[] {
  const first = (year - 1) * SEMESTERS_PER_YEAR + 1;
  return [first, first + 1];
}

/** The semesters offered in the dropdown, in order. */
export const ALL_SEMESTERS = Array.from({ length: MAX_SEMESTER }, (_, i) => i + 1);
