/**
 * The derivation of the curriculum year from the semester.
 *
 * The year is not an independent fact about a class — it follows from the
 * semester, because the syllabus is laid out so that the first year of the
 * course covers semesters 1 and 2, the second year covers 3 and 4, and so on.
 *
 * These tests pin that derivation, because the year column was removed from
 * the database in its favour: if the helper were wrong, every screen that
 * shows a year would be wrong, and nothing in the database would contradict
 * it.
 */

import {
  ALL_SEMESTERS,
  MAX_SEMESTER,
  MAX_YEAR,
  semestersForYear,
  yearForSemester,
} from './academic';

describe('the year a semester belongs to', () => {
  it('puts the first two semesters in the first year', () => {
    expect(yearForSemester(1)).toBe(1);
    expect(yearForSemester(2)).toBe(1);
  });

  it('puts the next two semesters in the second year', () => {
    expect(yearForSemester(3)).toBe(2);
    expect(yearForSemester(4)).toBe(2);
  });

  it('puts the last two semesters in the fourth year', () => {
    expect(yearForSemester(7)).toBe(4);
    expect(yearForSemester(8)).toBe(4);
  });

  it('covers every semester in the course', () => {
    for (const semester of ALL_SEMESTERS) {
      const year = yearForSemester(semester);
      expect(year).toBeGreaterThanOrEqual(1);
      expect(year).toBeLessThanOrEqual(MAX_YEAR);
    }
  });

  describe('a semester outside the course', () => {
    it('is clamped to the first year rather than producing year zero', () => {
      expect(yearForSemester(0)).toBe(1);
      expect(yearForSemester(-3)).toBe(1);
    });

    it('is clamped to the last year rather than producing year five', () => {
      expect(yearForSemester(9)).toBe(MAX_YEAR);
      expect(yearForSemester(99)).toBe(MAX_YEAR);
    });

    it('is clamped rather than producing a year for a number that is not a semester', () => {
      expect(yearForSemester(Number.NaN)).toBe(1);
      expect(yearForSemester(Number.POSITIVE_INFINITY)).toBe(1);
    });
  });
});

describe('the semesters a year covers', () => {
  it('gives the two semesters that make up the year', () => {
    expect(semestersForYear(1)).toEqual([1, 2]);
    expect(semestersForYear(2)).toEqual([3, 4]);
    expect(semestersForYear(3)).toEqual([5, 6]);
    expect(semestersForYear(4)).toEqual([7, 8]);
  });

  it('round-trips with the year derivation', () => {
    for (const year of [1, 2, 3, 4]) {
      for (const semester of semestersForYear(year)) {
        expect(yearForSemester(semester)).toBe(year);
      }
    }
  });
});

describe('the semester list', () => {
  it('runs from the first semester to the last', () => {
    expect(ALL_SEMESTERS[0]).toBe(1);
    expect(ALL_SEMESTERS[ALL_SEMESTERS.length - 1]).toBe(MAX_SEMESTER);
  });

  it('has one entry for every semester, with no gaps', () => {
    expect(ALL_SEMESTERS.length).toBe(MAX_SEMESTER);
    for (let index = 0; index < ALL_SEMESTERS.length; index += 1) {
      expect(ALL_SEMESTERS[index]).toBe(index + 1);
    }
  });
});
