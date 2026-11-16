/**
 * The test that keeps the two copies of the running-year rule in step.
 *
 * The rule lives in two places on purpose:
 *
 *  - in the **shared package** (`packages/shared-constants/src/running-year.ts`),
 *    because the frontend must default its dropdowns to the same year the
 *    backend defaults its reports to;
 *  - in the **backend** (`common/utils/running-year.ts`), because the
 *    backend may not import a runtime value from a workspace package
 *    without changing the build output layout (see the note at the top of
 *    that file).
 *
 * Two copies of a rule can drift. If they do, the frontend offers
 * "2024-25" while the dashboard reports on "2023-24" — the member is
 * looking at the wrong year while believing they chose the right one.
 *
 * The comparison below runs the *same* fixtures through both copies and
 * compares the outcomes, so a drift in any branch — the running case, the
 * gap cases, the overlap tie-break — fails here.
 */

import {
  describeRunningYear as sharedDescribe,
  isDateWithinYear as sharedIsDateWithinYear,
  resolveRunningYear as sharedResolve,
  type AcademicYearWindow,
  type RunningYearResolution,
} from '@result-analysis/shared-constants';

import {
  describeRunningYear,
  isDateWithinYear,
  resolveRunningYear,
  type RunningYearResolution as BackendRunningYearResolution,
} from './running-year';

/** A window of the kind the college records. */
interface Fixture extends AcademicYearWindow {
  id: string;
  year: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

/**
 * The college's real calendar, plus the awkward cases.
 *
 * The three ordinary years are the ones the seed writes. The fourth is a
 * deliberately *overlapping* window — a misconfiguration — and the fifth
 * has an unreadable end date, which must never be treated as matching
 * everything.
 */
const FIXTURES: Fixture[] = [
  {
    id: 'ay-2019',
    year: '2019-20',
    startDate: '2019-06-01T00:00:00.000Z',
    endDate: '2020-05-31T00:00:00.000Z',
    isActive: false,
  },
  {
    id: 'ay-2022',
    year: '2022-23',
    startDate: '2022-06-01T00:00:00.000Z',
    endDate: '2023-05-31T00:00:00.000Z',
    isActive: false,
  },
  {
    id: 'ay-2024',
    year: '2024-25',
    startDate: '2024-06-01T00:00:00.000Z',
    endDate: '2025-05-31T00:00:00.000Z',
    isActive: true,
  },
  {
    id: 'ay-overlap',
    year: '2025-26',
    startDate: '2025-04-01T00:00:00.000Z',
    endDate: '2026-03-31T00:00:00.000Z',
    isActive: false,
  },
  {
    id: 'ay-broken',
    year: '2026-27',
    startDate: '2026-06-01T00:00:00.000Z',
    endDate: 'not-a-date',
    isActive: false,
  },
];

/**
 * The days the comparison covers.
 *
 * Every boundary that matters is in here: the first day of a year, the
 * last day of a year, the day after the last year, the days in the gap
 * between two years, and the days before the very first year.
 */
const DAYS: readonly string[] = [
  '2019-05-31T12:00:00.000Z',
  '2019-06-01T00:00:00.000Z',
  '2019-06-01T23:59:59.999Z',
  '2020-05-31T23:59:59.999Z',
  '2020-06-01T00:00:00.000Z',
  '2022-05-31T12:00:00.000Z',
  '2022-06-01T00:00:00.000Z',
  '2023-05-31T12:00:00.000Z',
  '2023-06-01T00:00:00.000Z',
  '2024-05-31T12:00:00.000Z',
  '2024-06-01T00:00:00.000Z',
  '2025-03-31T12:00:00.000Z',
  '2025-04-01T00:00:00.000Z',
  '2025-05-31T12:00:00.000Z',
  '2025-06-01T00:00:00.000Z',
  '2026-03-31T23:59:59.999Z',
  '2026-04-01T00:00:00.000Z',
  '2026-06-01T00:00:00.000Z',
  '2027-01-01T00:00:00.000Z',
];

/**
 * Compares two resolutions by value, ignoring the object identity.
 *
 * The two copies return their own objects, so the comparison is on the
 * shape of the answer: which status, and which year is named.
 */
function sameAnswer(
  a: RunningYearResolution<Fixture>,
  b: BackendRunningYearResolution<Fixture>
): boolean {
  if (a.status !== b.status) return false;
  if (a.status === 'running' && b.status === 'running') {
    return a.year.id === b.year.id;
  }
  if (a.status === 'gap' && b.status === 'gap') {
    return a.previous?.id === b.previous?.id && a.next?.id === b.next?.id;
  }
  return true;
}

describe('the two copies of the running-year rule', () => {
  it.each(DAYS)('agrees on the year for %p', (day) => {
    const today = new Date(day);
    const shared = sharedResolve(FIXTURES, today);
    const backend = resolveRunningYear(FIXTURES, today);

    expect(sameAnswer(shared, backend)).toBe(true);
  });

  it.each(DAYS)('agrees on the sentence for %p', (day) => {
    const today = new Date(day);
    expect(sharedDescribe(sharedResolve(FIXTURES, today))).toBe(
      describeRunningYear(resolveRunningYear(FIXTURES, today))
    );
  });

  it.each(FIXTURES)('agrees on whether %p contains a given day', (year) => {
    for (const day of DAYS) {
      expect(isDateWithinYear(year, new Date(day))).toBe(
        sharedIsDateWithinYear(year, new Date(day))
      );
    }
  });

  it('agrees when there are no years at all', () => {
    const today = new Date('2025-01-01T00:00:00.000Z');
    const shared = sharedResolve([], today);
    const backend = resolveRunningYear([], today);

    expect(shared.status).toBe('none');
    expect(backend.status).toBe('none');
    expect(sameAnswer(shared, backend)).toBe(true);
  });
});
