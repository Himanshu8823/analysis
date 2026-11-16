/**
 * The academic calendar helpers shared by the student forms.
 *
 * A student's year is not chosen independently — it follows from the
 * semester they are in, because the syllabus is laid out so that the first
 * year of the course covers semesters 1 and 2, the second year covers 3
 * and 4, and so on.
 *
 * The rule itself lives in `packages/shared-constants`, because the backend
 * must derive the year the same way — the two used to store the year
 * independently, which allowed a student to be recorded as "Year 3,
 * Semester 1", a state that describes nobody.
 *
 * This module re-exports the shared rules so the frontend's own imports
 * stay short, and so there is one obvious place to look for "how is a year
 * derived" on this side of the codebase.
 *
 * The **running academic year** is exported from the same place, for the
 * same reason: the frontend must default its dropdowns to the year the
 * backend defaults its reports to. If the two worked it out separately,
 * the frontend would offer "2024-25" while the dashboard reported on
 * "2023-24" — and the member would be looking at the wrong year while
 * believing they had chosen the right one.
 */

export {
  ALL_SEMESTERS,
  MAX_SEMESTER,
  MAX_YEAR,
  SUPPORTED_SEMESTERS,
  YEAR_SEMESTERS,
  describeRunningYear,
  isDateWithinYear,
  resolveRunningYear,
  semesterToYear,
  validateYearSemester,
  yearForSemester,
  yearToSemesters,
} from '@result-analysis/shared-constants';

export type {
  AcademicYearWindow,
  RunningYearResolution,
} from '@result-analysis/shared-constants';

import { resolveRunningYear } from '@result-analysis/shared-constants';
import type { AcademicYearWindow } from '@result-analysis/shared-constants';

/**
 * The year a form should default to, given the years the college has.
 *
 * A pure function, so it can be used by a form that was handed its years
 * as a prop as well as by a hook that fetched them.
 *
 * The rule is the shared one: the year whose **dates** contain today. A
 * year that has finished is offered only when the college is between two
 * years — and even then it is a fallback, because the year that is about to
 * begin has not started and must not be presented as though it had.
 *
 * The `isActive` flag is deliberately not consulted. It is the college's
 * own label and it can contradict the dates; the dates are the authority.
 *
 * Returns `undefined` when the college has no calendar at all, so the
 * caller shows an empty dropdown and says why, rather than inventing a
 * year.
 */
export function defaultAcademicYear<T extends AcademicYearWindow>(
  years: readonly T[],
  today: Date = new Date()
): T | undefined {
  const resolution = resolveRunningYear(years, today);

  if (resolution.status === 'running') return resolution.year;
  if (resolution.status === 'gap') return resolution.previous;

  return undefined;
}
