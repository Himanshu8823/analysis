/**
 * The test for the semester → year derivation on the frontend.
 *
 * The frontend shows the year next to the semester on the student list and
 * on the forms. If that year is wrong, a member reads "Year 3" next to a
 * student who is in their first year — and the whole point of removing the
 * stored year column was that the two could not disagree.
 *
 * The backend's copy of the same rule is proved against the shared one in
 * `apps/backend/src/common/utils/academic-parity.spec.ts`. This file checks
 * the behaviour the frontend depends on.
 */

import {
  ALL_SEMESTERS,
  MAX_SEMESTER,
  MAX_YEAR,
  semesterToYear,
  validateYearSemester,
  yearForSemester,
  yearToSemesters,
} from '@/lib/academic';

describe('yearForSemester', () => {
  it.each([
    [1, 1],
    [2, 1],
    [3, 2],
    [4, 2],
    [5, 3],
    [6, 3],
    [7, 4],
    [8, 4],
  ])('places semester %p in year %p', (semester, year) => {
    expect(yearForSemester(semester)).toBe(year);
  });

  it('clamps a semester below the course to year 1', () => {
    expect(yearForSemester(0)).toBe(1);
    expect(yearForSemester(-3)).toBe(1);
  });

  it('clamps a semester above the course to the last year', () => {
    expect(yearForSemester(9)).toBe(MAX_YEAR);
    expect(yearForSemester(99)).toBe(MAX_YEAR);
  });

  it('treats a value that is not a number as year 1', () => {
    expect(yearForSemester(Number.NaN)).toBe(1);
    expect(yearForSemester(Number.POSITIVE_INFINITY)).toBe(1);
  });
});

describe('semesterToYear', () => {
  it('names the year for a semester the college runs', () => {
    expect(semesterToYear(5)).toBe(3);
    expect(semesterToYear(8)).toBe(4);
  });

  /**
   * The rejecting form. A form that is validating an input needs to know
   * that the semester is one the college does not run — the clamped form
   * would answer "year 1" and let it through.
   */
  it('refuses a semester the college does not run', () => {
    expect(semesterToYear(0)).toBeUndefined();
    expect(semesterToYear(9)).toBeUndefined();
    expect(semesterToYear(-1)).toBeUndefined();
    expect(semesterToYear(1.5)).toBeUndefined();
  });
});

describe('yearToSemesters', () => {
  it('names the two semesters of each year', () => {
    expect(yearToSemesters(1)).toEqual([1, 2]);
    expect(yearToSemesters(2)).toEqual([3, 4]);
    expect(yearToSemesters(3)).toEqual([5, 6]);
    expect(yearToSemesters(4)).toEqual([7, 8]);
  });

  it('has no semesters for a year the college does not run', () => {
    expect(yearToSemesters(5)).toEqual([]);
    expect(yearToSemesters(0)).toEqual([]);
  });
});

describe('validateYearSemester', () => {
  it('accepts a year that agrees with the semester', () => {
    expect(validateYearSemester(3, 5)).toBeNull();
  });

  it('accepts an absent year', () => {
    expect(validateYearSemester(undefined, 5)).toBeNull();
  });

  /**
   * The message is written for the person filling in the form, not for a
   * developer. It has to name the year the semester actually belongs to,
   * or the person cannot tell what to change.
   */
  it('explains a mismatch in plain words', () => {
    const message = validateYearSemester(2, 5);

    expect(message).toContain('Semester 5');
    expect(message).toContain('Year 3');
    expect(message).not.toMatch(/undefined|null|NaN/);
  });

  it('explains a semester the college does not run', () => {
    const message = validateYearSemester(1, 12);

    expect(message).toContain('Semester 12');
    expect(message).toContain('1 and 8');
  });
});

describe('the constants', () => {
  it('offers the eight semesters the college runs', () => {
    expect(ALL_SEMESTERS).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(MAX_SEMESTER).toBe(8);
    expect(MAX_YEAR).toBe(4);
  });

  it('has no gaps in the semesters it offers', () => {
    const sorted = [...ALL_SEMESTERS].sort((a, b) => a - b);

    for (let index = 0; index < sorted.length; index += 1) {
      expect(sorted[index]).toBe(index + 1);
    }
  });
});
