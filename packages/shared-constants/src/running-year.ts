/**
 * Which academic year is running *right now*.
 *
 * ## The problem this solves
 *
 * The college knows when each academic year runs: every `AcademicYear` row
 * carries a `startDate` and an `endDate`. Until now the system did not use
 * them — it looked at an `isActive` flag instead, and fell back to "the most
 * recent one by start date" when no row was flagged.
 *
 * Both of those are guesses. A flag can be left on from last year; the
 * "most recent" fallback silently picks a *finished* year when the college
 * is between two of them. The result is that the dashboard, the analytics
 * and the toppers screen can all disagree about which year they are
 * reporting on, and none of them is necessarily the year the college is
 * actually in.
 *
 * The dates are the authority. An academic year is running on a given day
 * when that day falls between its start and its end.
 *
 * ## The rule
 *
 * 1. **The date decides.** A year whose `startDate <= today <= endDate` is
 *    running. Nothing else is consulted — not a flag, not a count.
 * 2. **The `isActive` flag is a label, not a decision.** It is kept for
 *    display ("current") and for the seeded data, but it never overrides
 *    the dates. A flag that contradicts the dates is a data-entry mistake,
 *    and the dates win.
 * 3. **One year at a time.** If two years' date ranges overlap — which is
 *    a misconfiguration — the one that started *later* wins, because it is
 *    the more recent of the two and the more likely to be the intended one.
 *    The overlap is a mistake worth surfacing, but the answer must still be
 *    deterministic.
 * 4. **No match has a defined answer, not a silent one.** See
 *    {@link resolveRunningYear}.
 *
 * ## Why this file exists in the shared package
 *
 * The frontend has to default its dropdowns and forms to the same year the
 * backend defaults its reports to. If the two worked it out separately,
 * the frontend would offer "2024-25" while the dashboard reported on
 * "2023-24", and the member would be looking at the wrong year while
 * believing they had chosen the right one.
 *
 * The backend keeps its own copy of the rule in
 * `apps/backend/src/common/utils/running-year.ts` — a runtime import of a
 * workspace package moves the build output from `dist/main.js` to
 * `dist/apps/backend/src/main.js` and breaks the start script. The two
 * copies are proved to agree by
 * `apps/backend/src/common/utils/running-year-parity.spec.ts`.
 */

/**
 * An academic year, reduced to the fields the running-year rule needs.
 *
 * The shape is deliberately narrow so the rule can be used with anything
 * that looks like an academic year — a Prisma row, a REST payload, or a
 * hand-written test fixture.
 */
export interface AcademicYearWindow {
  /** The row's id. */
  id: string;
  /** The label the college uses, e.g. `2024-25`. */
  year: string;
  /** The first day of the academic year (inclusive). */
  startDate: Date | string;
  /** The last day of the academic year (inclusive). */
  endDate: Date | string;
  /**
   * The college's own "this is the current year" marker.
   *
   * Carried for display and for the seed. It is **not** consulted when
   * deciding which year is running — see the file header.
   */
  isActive?: boolean;
}

/**
 * What the running-year rule concluded.
 *
 * The three states are distinct on purpose. A caller that cannot tell
 * "no year matches today" from "the year that matches today" cannot make
 * an honest decision about what to show.
 */
export type RunningYearResolution<T> =
  | {
      /** The year that is running today. */
      status: 'running';
      /** The year. */
      year: T;
    }
  | {
      /**
       * Today falls in a gap between two academic years — the summer
       * break, or the days before a new year is opened.
       */
      status: 'gap';
      /**
       * The year that has already started and not yet ended — the closest
       * year *before* today, or `undefined` if today is before every year.
       */
      previous?: T;
      /**
       * The next year to begin — the closest year *after* today, or
       * `undefined` if today is after every year.
       */
      next?: T;
    }
  | {
      /**
       * There are no academic years at all. The college has not set its
       * calendar up yet.
       */
      status: 'none';
    };

/**
 * Parses a date into a `Date`, or returns `undefined` when it is not one.
 *
 * A date that cannot be read is a data-entry mistake, and a year with an
 * unreadable boundary cannot be shown as running — so it is skipped rather
 * than allowed to match everything.
 */
function toDate(value: Date | string): Date | undefined {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

/**
 * Normalises a date to the **start of its UTC day**.
 *
 * An academic year runs from a date to a date, and both are inclusive. If
 * the boundary dates carried a time of day, `2024-06-01T00:00:00Z` would
 * not contain `2024-06-01T09:30:00Z` — but the college means the whole
 * of 1 June to be *inside* the year that ends on 1 June.
 *
 * Normalising both ends to midnight makes the comparison say what the
 * college means. It also makes the rule independent of the server's
 * timezone, which matters because the backend and the frontend run in
 * different places.
 */
function startOfUtcDay(value: Date): number {
  return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
}

/**
 * Whether a given day falls inside an academic year's window.
 *
 * Both boundaries are inclusive: the year starts on its `startDate` and
 * ends on its `endDate`.
 */
export function isDateWithinYear(
  year: AcademicYearWindow,
  today: Date
): boolean {
  const start = toDate(year.startDate);
  const end = toDate(year.endDate);
  if (!start || !end) return false;

  const day = startOfUtcDay(today);
  const startDay = startOfUtcDay(start);
  const endDay = startOfUtcDay(end);

  if (endDay < startDay) return false;

  return day >= startDay && day <= endDay;
}

/**
 * Finds the academic year that is running on a given day.
 *
 * ## The decision, in full
 *
 * - A year whose window contains today is **running**.
 * - If no window contains today:
 *   - **Before every year** — the college has not opened its first year
 *     yet. The nearest year to come is reported, so the caller can say
 *     "the 2025-26 year begins on 1 June" rather than showing nothing.
 *   - **Between two years** — the college is in its break. The year that
 *     has just ended and the year that is about to begin are both
 *     reported, so the caller can say "2024-25 has finished; 2025-26
 *     begins on 1 June" instead of silently showing one of them.
 *   - **After every year** — the college's calendar has not been extended.
 *     The year that just finished is reported.
 * - If there are no years at all, the answer is `none`.
 *
 * The gap cases are deliberate. A screen that silently fell back to "the
 * most recent year" would show a member a *finished* year's results and
 * label it as current — which is exactly the kind of quiet wrongness this
 * whole change exists to remove. Saying "the calendar has a gap here" is
 * more useful than a plausible-looking wrong answer.
 */
export function resolveRunningYear<T extends AcademicYearWindow>(
  years: readonly T[],
  today: Date
): RunningYearResolution<T> {
  const usable = years.filter((year) => {
    const start = toDate(year.startDate);
    const end = toDate(year.endDate);
    return start !== undefined && end !== undefined && startOfUtcDay(end) >= startOfUtcDay(start);
  });

  if (usable.length === 0) return { status: 'none' };

  const running = usable.filter((year) => isDateWithinYear(year, today));

  if (running.length > 0) {
    /**
     * Two overlapping windows is a misconfiguration. The later start wins,
     * because it is the more recent of the two. Ties are broken by the
     * later end date, and then by the id, so the answer never depends on
     * the order the rows came back from the database.
     */
    const sorted = [...running].sort((a, b) => {
      const startDiff = startOfUtcDay(toDate(b.startDate)!) - startOfUtcDay(toDate(a.startDate)!);
      if (startDiff !== 0) return startDiff;
      const endDiff = startOfUtcDay(toDate(b.endDate)!) - startOfUtcDay(toDate(a.endDate)!);
      if (endDiff !== 0) return endDiff;
      return a.id.localeCompare(b.id);
    });
    return { status: 'running', year: sorted[0] };
  }

  const byStart = [...usable].sort(
    (a, b) => startOfUtcDay(toDate(a.startDate)!) - startOfUtcDay(toDate(b.startDate)!)
  );

  const day = startOfUtcDay(today);
  const previous = [...byStart].reverse().find((year) => startOfUtcDay(toDate(year.startDate)!) <= day);
  const next = byStart.find((year) => startOfUtcDay(toDate(year.startDate)!) > day);

  if (!previous && !next) return { status: 'none' };

  return {
    status: 'gap',
    ...(previous ? { previous } : {}),
    ...(next ? { next } : {}),
  };
}

/**
 * The label a college clerk should read for a resolution.
 *
 * The sentences are written for a person, not a developer: they say what
 * the calendar is doing and when it changes, and they never mention a
 * status code.
 */
export function describeRunningYear<T extends AcademicYearWindow>(
  resolution: RunningYearResolution<T>
): string {
  switch (resolution.status) {
    case 'running':
      return `The ${resolution.year.year} academic year is running.`;
    case 'none':
      return 'No academic year has been set up yet.';
    case 'gap': {
      const { previous, next } = resolution;
      if (previous && next) {
        return `The ${previous.year} academic year has finished. The ${next.year} academic year begins on ${formatDay(next.startDate)}.`;
      }
      if (next) {
        return `The ${next.year} academic year begins on ${formatDay(next.startDate)}.`;
      }
      if (previous) {
        return `The ${previous.year} academic year has finished, and no later academic year has been set up yet.`;
      }
      return 'No academic year has been set up yet.';
    }
  }
}

/**
 * Formats a date as a plain day, e.g. `1 June 2025`.
 *
 * Written in British English because that is what the college's own
 * documents use. The month is spelled out, because a clerk reading
 * "06/01/2025" has to work out whether it is June or January.
 */
function formatDay(value: Date | string): string {
  const date = toDate(value);
  if (!date) return 'an unknown date';
  const months = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  return `${date.getUTCDate()} ${months[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}
