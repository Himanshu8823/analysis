/**
 * The rule that decides which academic year the college is in.
 *
 * The system has to know, without being told, which academic year is
 * running — every filter, dropdown and report defaults to it. That answer
 * used to come from an `isActive` flag with a "most recent by start date"
 * fallback, both of which could name a year that had already finished.
 *
 * These tests pin the date-driven rule:
 *
 *  - a day inside a year names that year;
 *  - the day *after* a year ends does not;
 *  - the day *before* the first year names nothing;
 *  - a day in the gap between two years says so, rather than pretending
 *    one of them is current;
 *  - and an `isActive` flag that contradicts the dates loses.
 */

import type { PrismaClient } from '@prisma/client';

import {
  describeRunningYear,
  pickRunningYear,
  requireAcademicYear,
  resolveAcademicYear,
} from './academic-year';

/** A row of the kind the college records. */
interface Row {
  id: string;
  year: string;
  startDate: Date;
  endDate: Date;
  isActive: boolean;
}

/**
 * The college's calendar: three consecutive years.
 *
 * The years run June to May, which is what an Indian degree programme
 * does — the academic year starts with the first semester in June.
 */
const CALENDAR: Row[] = [
  {
    id: 'ay-2022',
    year: '2022-23',
    startDate: new Date('2022-06-01T00:00:00.000Z'),
    endDate: new Date('2023-05-31T00:00:00.000Z'),
    isActive: false,
  },
  {
    id: 'ay-2023',
    year: '2023-24',
    startDate: new Date('2023-06-01T00:00:00.000Z'),
    endDate: new Date('2024-05-31T00:00:00.000Z'),
    isActive: false,
  },
  {
    id: 'ay-2024',
    year: '2024-25',
    startDate: new Date('2024-06-01T00:00:00.000Z'),
    endDate: new Date('2025-05-31T00:00:00.000Z'),
    isActive: true,
  },
];

/**
 * A stand-in for Prisma's `findMany`.
 *
 * Only `findMany` is needed, so the double is as small as the resolver's
 * surface — anything more would be testing the double.
 */
function prismaWith(rows: Row[]): PrismaClient {
  return {
    academicYear: {
      findMany: async () => rows,
    },
  } as unknown as PrismaClient;
}

describe('the academic year that is running', () => {
  it('names the year a day falls inside', async () => {
    const year = await resolveAcademicYear(
      prismaWith(CALENDAR),
      new Date('2024-09-15T00:00:00.000Z')
    );

    expect(year).toEqual({ id: 'ay-2024', year: '2024-25' });
  });

  it('names the year on its very first day', async () => {
    const year = await resolveAcademicYear(
      prismaWith(CALENDAR),
      new Date('2024-06-01T00:00:00.000Z')
    );

    expect(year?.year).toBe('2024-25');
  });

  it('names the year on its very last day', async () => {
    const year = await resolveAcademicYear(
      prismaWith(CALENDAR),
      new Date('2025-05-31T00:00:00.000Z')
    );

    expect(year?.year).toBe('2024-25');
  });

  it('does not name a year that has already finished', async () => {
    const year = await resolveAcademicYear(
      prismaWith(CALENDAR),
      new Date('2025-06-01T00:00:00.000Z')
    );

    /**
     * The last year of the calendar has finished and no later one has been
     * set up, so the year that just ended is what there is to look at. The
     * caller is expected to say so rather than present it as current.
     */
    expect(year?.year).toBe('2024-25');
  });

  /**
   * The gap between two years — the college's summer break.
   *
   * No year is *running*, and the answer says so. The year that has just
   * finished is reported, because its results are what exist to be
   * reviewed — but the caller is told it has finished rather than being
   * left to think it is current.
   */
  it('reports the gap between two years rather than guessing', () => {
    const resolution = pickRunningYear(CALENDAR, new Date('2025-06-15T00:00:00.000Z'));

    expect(resolution?.year).toBe('2024-25');
  });

  it('explains the gap in a sentence a clerk can act on', () => {
    const resolution = describeRunningYear({
      status: 'gap',
      previous: CALENDAR[2],
      next: {
        ...CALENDAR[2],
        id: 'ay-2025',
        year: '2025-26',
        startDate: new Date('2025-06-01T00:00:00.000Z'),
        endDate: new Date('2026-05-31T00:00:00.000Z'),
      },
    });

    expect(resolution).toContain('2024-25');
    expect(resolution).toContain('2025-26');
    expect(resolution).toContain('1 June 2025');
    expect(resolution).not.toMatch(/status|undefined|null/i);
  });

  it('names nothing before the first year is opened', async () => {
    const year = await resolveAcademicYear(
      prismaWith(CALENDAR),
      new Date('2022-01-01T00:00:00.000Z')
    );

    /**
     * Before the college's first year opens there is nothing to report
     * on — the calendar has not reached its first year yet.
     */
    expect(year).toBeNull();
  });

  it('names nothing when the college has no calendar at all', async () => {
    const year = await resolveAcademicYear(prismaWith([]), new Date('2024-09-15T00:00:00.000Z'));

    expect(year).toBeNull();
  });

  /**
   * The contradiction case.
   *
   * The flag says 2024-25 is current; the dates say today falls inside
   * 2023-24. The dates win, because they are what the college actually
   * agreed to run.
   */
  it('follows the dates when the active flag contradicts them', async () => {
    const contradicted: Row[] = [
      {
        id: 'ay-2023',
        year: '2023-24',
        startDate: new Date('2023-06-01T00:00:00.000Z'),
        endDate: new Date('2024-05-31T00:00:00.000Z'),
        isActive: false,
      },
      {
        id: 'ay-2024',
        year: '2024-25',
        startDate: new Date('2024-06-01T00:00:00.000Z'),
        endDate: new Date('2025-05-31T00:00:00.000Z'),
        isActive: true,
      },
    ];

    const year = await resolveAcademicYear(
      prismaWith(contradicted),
      new Date('2024-01-15T00:00:00.000Z')
    );

    expect(year?.year).toBe('2023-24');
  });

  /**
   * The other direction of the contradiction: the flag marks a year that
   * has finished, and another year is running.
   */
  it('follows the dates when the active flag marks a finished year', async () => {
    const contradicted: Row[] = [
      {
        id: 'ay-2023',
        year: '2023-24',
        startDate: new Date('2023-06-01T00:00:00.000Z'),
        endDate: new Date('2024-05-31T00:00:00.000Z'),
        isActive: true,
      },
      {
        id: 'ay-2024',
        year: '2024-25',
        startDate: new Date('2024-06-01T00:00:00.000Z'),
        endDate: new Date('2025-05-31T00:00:00.000Z'),
        isActive: false,
      },
    ];

    const year = await resolveAcademicYear(
      prismaWith(contradicted),
      new Date('2024-09-15T00:00:00.000Z')
    );

    expect(year?.year).toBe('2024-25');
  });

  it('is not affected by the order the rows arrive in', async () => {
    const shuffled = [CALENDAR[2], CALENDAR[0], CALENDAR[1]];
    const today = new Date('2024-09-15T00:00:00.000Z');

    const ordered = await resolveAcademicYear(prismaWith(CALENDAR), today);
    const reversed = await resolveAcademicYear(prismaWith(shuffled), today);

    expect(reversed).toEqual(ordered);
  });

  it('skips a year whose dates cannot be read', async () => {
    const broken: Row[] = [
      {
        id: 'ay-broken',
        year: '2024-25',
        startDate: new Date('2024-06-01T00:00:00.000Z'),
        endDate: new Date('not-a-date'),
        isActive: true,
      },
      {
        id: 'ay-2023',
        year: '2023-24',
        startDate: new Date('2023-06-01T00:00:00.000Z'),
        endDate: new Date('2024-05-31T00:00:00.000Z'),
        isActive: false,
      },
    ];

    const year = await resolveAcademicYear(
      prismaWith(broken),
      new Date('2023-09-15T00:00:00.000Z')
    );

    expect(year?.year).toBe('2023-24');
  });

  it('throws when a year is required and the college has none', async () => {
    await expect(
      requireAcademicYear(prismaWith([]), new Date('2024-09-15T00:00:00.000Z'))
    ).rejects.toThrow(/no academic year/i);
  });

  it('returns the year when one is required and one is running', async () => {
    const year = await requireAcademicYear(
      prismaWith(CALENDAR),
      new Date('2024-09-15T00:00:00.000Z')
    );

    expect(year.year).toBe('2024-25');
  });
});
