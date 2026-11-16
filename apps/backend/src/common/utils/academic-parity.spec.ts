/**
 * The test that keeps the two copies of the semester → year rule in step.
 *
 * The rule lives in two places on purpose:
 *
 *  - in the **shared package** (`packages/shared-constants/src/academic.ts`),
 *    because the frontend needs it to show the right year on a form;
 *  - in the **backend** (`common/utils/academic.ts`), because the backend
 *    may not import a runtime value from a workspace package without
 *    changing the build output layout (see the note at the top of that
 *    file).
 *
 * Two copies of a rule can drift. If they do, the screen shows a student as
 * being in Year 2 while the server files them under Year 3 — and the two
 * records then disagree about the same student, which is the exact state
 * the removal of the redundant year columns was meant to end.
 *
 * The comparison below covers **every** semester, including the ones the
 * college does not run, because a drift in the clamping behaviour is just as
 * damaging as a drift in the middle of the range.
 */

import {
  ALL_SEMESTERS as sharedAllSemesters,
  MAX_SEMESTER as sharedMaxSemester,
  MAX_YEAR as sharedMaxYear,
  semesterToYear as sharedSemesterToYear,
  yearForSemester as sharedYearForSemester,
  yearToSemesters as sharedYearToSemesters,
} from '@result-analysis/shared-constants';

import {
  ALL_SEMESTERS,
  MAX_SEMESTER,
  MAX_YEAR,
  semesterToYear,
  semestersForYear,
  yearForSemester,
} from './academic';

/**
 * Every semester the comparison covers.
 *
 * The eight the college runs, plus the values just outside them — the
 * boundaries are where a clamping rule is most likely to differ — plus the
 * nonsense values that a form could send if it were not validated.
 */
const SEMESTERS_TO_CHECK: readonly number[] = [
  ...sharedAllSemesters,
  0,
  -1,
  -3,
  9,
  10,
  99,
  1000,
  Number.NaN,
  Number.POSITIVE_INFINITY,
  Number.NEGATIVE_INFINITY,
  1.5,
  2.5,
  3.75,
];

describe('the two copies of the semester → year rule', () => {
  it.each(SEMESTERS_TO_CHECK)('agrees on the year for semester %p', (semester) => {
    expect(yearForSemester(semester)).toBe(sharedYearForSemester(semester));
  });

  it.each(SEMESTERS_TO_CHECK)(
    'agrees on whether semester %p is one the college runs',
    (semester) => {
      expect(semesterToYear(semester)).toBe(sharedSemesterToYear(semester));
    }
  );

  it('agrees on the longest course', () => {
    expect(MAX_YEAR).toBe(sharedMaxYear);
    expect(MAX_SEMESTER).toBe(sharedMaxSemester);
  });

  it('agrees on the semesters offered in a dropdown', () => {
    expect(ALL_SEMESTERS).toEqual([...sharedAllSemesters]);
  });

  /**
   * The two ways of asking "which semesters are in this year" must agree.
   *
   * The backend's `semestersForYear` returns a fresh array; the shared
   * `yearToSemesters` returns a read-only one. The *contents* are what
   * matter.
   */
  it.each([1, 2, 3, 4])('agrees on the semesters of year %p', (year) => {
    expect(semestersForYear(year)).toEqual([...sharedYearToSemesters(year)]);
  });

  /**
   * The round trip: a semester's year, and that year's semesters, must
   * contain the semester again. If the two copies disagreed about where a
   * year begins, this would fail for one of them.
   */
  it.each([...sharedAllSemesters])('round-trips semester %p through its year', (semester) => {
    const backendYear = yearForSemester(semester);
    const sharedYear = sharedYearForSemester(semester);

    expect(semestersForYear(backendYear)).toContain(semester);
    expect([...sharedYearToSemesters(sharedYear)]).toContain(semester);
  });
});
