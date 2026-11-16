/**
 * The running-year rule, tested on its own.
 *
 * This is the rule both sides of the app depend on: the backend defaults
 * its reports with it, the frontend defaults its dropdowns with it. If the
 * two ever disagree about which year is running, the member is looking at
 * the wrong year while believing they chose the right one — which is why
 * the rule is small, explicit and pinned by these tests.
 *
 * The cases covered are the ones a real college hits:
 *
 *  - a day inside a year;
 *  - the first and last day of a year (both inclusive);
 *  - a day before the first year;
 *  - a day in the gap between two years;
 *  - a day after the last year;
 *  - a day inside a year whose end date cannot be read;
 *  - and the `isActive` flag disagreeing with the dates.
 */

import {
  describeRunningYear,
  isDateWithinYear,
  resolveRunningYear,
  type AcademicYearWindow,
} from './running-year';

interface Fixture extends AcademicYearWindow {
  id: string;
  year: string;
  startDate: string;
  endDate: string;
  isActive?: boolean;
}

const CALENDAR: Fixture[] = [
  {
    id: 'ay-2022',
    year: '2022-23',
    startDate: '2022-06-01T00:00:00.000Z',
    endDate: '2023-05-31T00:00:00.000Z',
    isActive: false,
  },
  {
    id: 'ay-2023',
    year: '2023-24',
    startDate: '2023-06-01T00:00:00.000Z',
    endDate: '2024-05-31T00:00:00.000Z',
    isActive: false,
  },
  {
    id: 'ay-2024',
    year: '2024-25',
    startDate: '2024-06-01T00:00:00.000Z',
    endDate: '2025-05-31T00:00:00.000Z',
    isActive: true,
  },
];

describe('isDateWithinYear', () => {
  it('accepts a day inside the year', () => {
    expect(
      isDateWithinYear(CALENDAR[2], new Date('2024-09-15T00:00:00.000Z'))
    ).toBe(true);
  });

  it('accepts the first day of the year', () => {
    expect(
      isDateWithinYear(CALENDAR[2], new Date('2024-06-01T00:00:00.000Z'))
    ).toBe(true);
  });

  it('accepts the last day of the year', () => {
    expect(
      isDateWithinYear(CALENDAR[2], new Date('2025-05-31T00:00:00.000Z'))
    ).toBe(true);
  });

  it('rejects the day after the year ends', () => {
    expect(
      isDateWithinYear(CALENDAR[2], new Date('2025-06-01T00:00:00.000Z'))
    ).toBe(false);
  });

  it('rejects the day before the year starts', () => {
    expect(
      isDateWithinYear(CALENDAR[2], new Date('2024-05-31T00:00:00.000Z'))
    ).toBe(false);
  });

  /**
   * A year whose end date cannot be read must not match every day — that
   * would make a broken row the running year for ever.
   */
  it('rejects a year whose dates cannot be read', () => {
    const broken: Fixture = {
      id: 'ay-broken',
      year: '2024-25',
      startDate: '2024-06-01T00:00:00.000Z',
      endDate: 'not-a-date',
    };

    expect(isDateWithinYear(broken, new Date('2024-09-15T00:00:00.000Z'))).toBe(false);
  });

  it('rejects a year whose end comes before its start', () => {
    const inverted: Fixture = {
      id: 'ay-inverted',
      year: '2024-25',
      startDate: '2025-06-01T00:00:00.000Z',
      endDate: '2024-06-01T00:00:00.000Z',
    };

    expect(isDateWithinYear(inverted, new Date('2024-09-15T00:00:00.000Z'))).toBe(false);
  });
});

describe('resolveRunningYear', () => {
  it('names the year a day falls inside', () => {
    const resolution = resolveRunningYear(CALENDAR, new Date('2024-09-15T00:00:00.000Z'));

    expect(resolution.status).toBe('running');
    if (resolution.status === 'running') {
      expect(resolution.year.year).toBe('2024-25');
    }
  });

  it('names nothing before the first year', () => {
    const resolution = resolveRunningYear(CALENDAR, new Date('2022-01-01T00:00:00.000Z'));

    expect(resolution.status).toBe('gap');
    if (resolution.status === 'gap') {
      expect(resolution.previous).toBeUndefined();
      expect(resolution.next?.year).toBe('2022-23');
    }
  });

  it('names nothing after the last year', () => {
    const resolution = resolveRunningYear(CALENDAR, new Date('2027-01-01T00:00:00.000Z'));

    expect(resolution.status).toBe('gap');
    if (resolution.status === 'gap') {
      expect(resolution.previous?.year).toBe('2024-25');
      expect(resolution.next).toBeUndefined();
    }
  });

  it('reports the gap between two years', () => {
    /**
     * A calendar with a real gap in it — the years run June to May, so
     * the next year starts on 1 June and the old one ends on 31 May.
     * A college that has not opened its next year yet leaves a wider gap:
     * the old year ended on 31 May 2025 and the next one does not begin
     * until 1 August 2025.
     */
    const withGap: Fixture[] = [
      ...CALENDAR,
      {
        id: 'ay-2025',
        year: '2025-26',
        startDate: '2025-08-01T00:00:00.000Z',
        endDate: '2026-07-31T00:00:00.000Z',
        isActive: false,
      },
    ];

    const resolution = resolveRunningYear(withGap, new Date('2025-06-15T00:00:00.000Z'));

    expect(resolution.status).toBe('gap');
    if (resolution.status === 'gap') {
      expect(resolution.previous?.year).toBe('2024-25');
      expect(resolution.next?.year).toBe('2025-26');
    }
  });

  it('reports no year at all when the college has no calendar', () => {
    const resolution = resolveRunningYear([], new Date('2024-09-15T00:00:00.000Z'));

    expect(resolution.status).toBe('none');
  });

  /**
   * The contradiction.
   *
   * The flag says 2024-25; the dates say 2023-24. The dates win.
   */
  it('follows the dates, not the active flag', () => {
    const contradicted: Fixture[] = [
      {
        id: 'ay-2023',
        year: '2023-24',
        startDate: '2023-06-01T00:00:00.000Z',
        endDate: '2024-05-31T00:00:00.000Z',
        isActive: false,
      },
      {
        id: 'ay-2024',
        year: '2024-25',
        startDate: '2024-06-01T00:00:00.000Z',
        endDate: '2025-05-31T00:00:00.000Z',
        isActive: true,
      },
    ];

    const resolution = resolveRunningYear(contradicted, new Date('2024-01-15T00:00:00.000Z'));

    expect(resolution.status).toBe('running');
    if (resolution.status === 'running') {
      expect(resolution.year.year).toBe('2023-24');
    }
  });

  /**
   * Two years whose windows overlap is a misconfiguration, but the answer
   * still has to be deterministic — the more recent one wins.
   */
  it('picks the more recent of two overlapping years', () => {
    const overlapping: Fixture[] = [
      {
        id: 'ay-early',
        year: '2024-25',
        startDate: '2024-06-01T00:00:00.000Z',
        endDate: '2025-05-31T00:00:00.000Z',
      },
      {
        id: 'ay-late',
        year: '2025-26',
        startDate: '2025-04-01T00:00:00.000Z',
        endDate: '2026-03-31T00:00:00.000Z',
      },
    ];

    const resolution = resolveRunningYear(overlapping, new Date('2025-05-01T00:00:00.000Z'));

    expect(resolution.status).toBe('running');
    if (resolution.status === 'running') {
      expect(resolution.year.id).toBe('ay-late');
    }
  });

  it('does not depend on the order the years arrive in', () => {
    const today = new Date('2024-09-15T00:00:00.000Z');
    const ordered = resolveRunningYear(CALENDAR, today);
    const reversed = resolveRunningYear([...CALENDAR].reverse(), today);

    expect(reversed).toEqual(ordered);
  });

  it('ignores a year whose dates cannot be read', () => {
    const withBroken: Fixture[] = [
      ...CALENDAR,
      {
        id: 'ay-broken',
        year: '2025-26',
        startDate: '2025-06-01T00:00:00.000Z',
        endDate: 'not-a-date',
        isActive: true,
      },
    ];

    const resolution = resolveRunningYear(withBroken, new Date('2025-09-15T00:00:00.000Z'));

    expect(resolution.status).toBe('gap');
  });
});

describe('describeRunningYear', () => {
  it('names the running year in a sentence', () => {
    const resolution = resolveRunningYear(CALENDAR, new Date('2024-09-15T00:00:00.000Z'));

    expect(describeRunningYear(resolution)).toBe('The 2024-25 academic year is running.');
  });

  it('says plainly when no year has been set up', () => {
    const resolution = resolveRunningYear([], new Date('2024-09-15T00:00:00.000Z'));

    expect(describeRunningYear(resolution)).toBe('No academic year has been set up yet.');
  });

  it('names both years when the college is between two', () => {
    const resolution = {
      status: 'gap' as const,
      previous: CALENDAR[2],
      next: {
        ...CALENDAR[2],
        id: 'ay-2025',
        year: '2025-26',
        startDate: '2025-06-01T00:00:00.000Z',
        endDate: '2026-05-31T00:00:00.000Z',
      },
    };

    const sentence = describeRunningYear(resolution);

    expect(sentence).toContain('2024-25');
    expect(sentence).toContain('2025-26');
    expect(sentence).toContain('1 June 2025');
  });

  it('never shows a developer-facing word', () => {
    const sentence = describeRunningYear(
      resolveRunningYear(CALENDAR, new Date('2024-09-15T00:00:00.000Z'))
    );

    expect(sentence).not.toMatch(/status|undefined|null|NaN|\bid\b/i);
  });
});
