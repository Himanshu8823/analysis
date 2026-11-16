import type { PrismaClient } from '@prisma/client';

import {
  describeRunningYear,
  resolveRunningYear,
  type AcademicYearWindow,
  type RunningYearResolution,
} from './running-year';

export interface ResolvedAcademicYear {
  id: string;
  year: string;
}

/**
 * The shape the resolver needs from a Prisma row.
 *
 * The query selects only these fields, so the resolver never loads the
 * rest of the row it does not need.
 */
interface AcademicYearRow extends AcademicYearWindow {
  id: string;
  year: string;
  startDate: Date;
  endDate: Date;
  isActive: boolean;
}

/**
 * Resolves the academic year to report on.
 *
 * ## The rule
 *
 * **Today's date decides.** The running year is the one whose
 * `startDate <= today <= endDate`. The `isActive` flag is *not* consulted
 * — it survives as the college's own label and is shown in the UI, but a
 * flag that contradicts the dates is a data-entry mistake and the dates
 * win. (This is the same class of bug as the redundant `year` column that
 * was removed from `SubjectOffering`: two sources of truth for one fact,
 * free to disagree.)
 *
 * ## When no year matches
 *
 * The answer is not a silent fallback.
 *
 * - **Between two years** (the college's summer break) — the year that
 *   has finished is reported, and the caller is told so it can say why.
 * - **Before the first year** — there is nothing to report on yet.
 * - **After the last year** — the college's calendar has not been extended
 *   and the last year's results are what exists.
 *
 * A screen that quietly fell back to "the most recent year" would show a
 * member a *finished* year's results and label it as current. Saying
 * "the calendar has a gap here" is more useful than a plausible-looking
 * wrong answer.
 *
 * Shared by the dashboard, analytics and toppers services so every screen
 * defaults to the same year instead of each one inventing its own rule.
 */
export async function resolveAcademicYear(
  prisma: PrismaClient,
  today: Date = new Date()
): Promise<ResolvedAcademicYear | null> {
  const years = await prisma.academicYear.findMany({
    select: { id: true, year: true, startDate: true, endDate: true, isActive: true },
    orderBy: { startDate: 'asc' },
  });

  return pickRunningYear(years, today);
}

/**
 * The same decision, applied to an already-loaded list of years.
 *
 * Split out from {@link resolveAcademicYear} so the choice of year can be
 * tested — and reasoned about — without a database.
 */
export function pickRunningYear(
  years: readonly AcademicYearRow[],
  today: Date = new Date()
): ResolvedAcademicYear | null {
  const resolution = resolveRunningYear(years, today);
  return toResolvedYear(resolution);
}

/**
 * The full resolution, for callers that need to *explain* the choice.
 *
 * The dashboard uses this: when the college is in the gap between two
 * years, the dashboard says so rather than quietly reporting on the year
 * that has just finished.
 */
export async function resolveAcademicYearWithReason(
  prisma: PrismaClient,
  today: Date = new Date()
): Promise<RunningYearResolution<AcademicYearRow>> {
  const years = await prisma.academicYear.findMany({
    select: { id: true, year: true, startDate: true, endDate: true, isActive: true },
    orderBy: { startDate: 'asc' },
  });
  return resolveRunningYear(years, today);
}

/**
 * The year the resolution names, or `null` when there is none.
 *
 * In the gap case the *finished* year is named — it is the year whose
 * results exist and can be reviewed — and the caller is expected to use
 * {@link describeRunningYear} to say that it has finished.
 *
 * A year that has **not started yet** is never named. Before the college's
 * first year opens there is nothing to report on, and naming the year that
 * is about to begin would present a future year as the current one.
 */
function toResolvedYear(
  resolution: RunningYearResolution<AcademicYearRow>
): ResolvedAcademicYear | null {
  if (resolution.status === 'running') {
    return { id: resolution.year.id, year: resolution.year.year };
  }
  if (resolution.status === 'gap' && resolution.previous) {
    return { id: resolution.previous.id, year: resolution.previous.year };
  }
  return null;
}

/**
 * Same as {@link resolveAcademicYear} but throws when no academic year can
 * be named, for endpoints where a year is mandatory and a zero-result
 * response would be misleading.
 */
export async function requireAcademicYear(
  prisma: PrismaClient,
  today: Date = new Date()
): Promise<ResolvedAcademicYear> {
  const year = await resolveAcademicYear(prisma, today);
  if (!year) {
    throw new Error('No academic year has been configured yet.');
  }
  return year;
}

export { describeRunningYear };
