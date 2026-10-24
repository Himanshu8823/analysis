import type { PrismaClient } from '@prisma/client';

export interface ResolvedAcademicYear {
  id: string;
  year: string;
}

/**
 * Resolves the academic year to report on.
 *
 * The active year wins; if none is marked active the most recent one (by start
 * date) is used. `null` means there is no academic year at all — callers then
 * have to decide whether to report zeroes or fail.
 *
 * Shared by the dashboard, analytics and toppers services so every screen
 * defaults to the same year instead of each one inventing its own rule.
 */
export async function resolveAcademicYear(
  prisma: PrismaClient,
): Promise<ResolvedAcademicYear | null> {
  const active = await prisma.academicYear.findFirst({
    where: { isActive: true },
    orderBy: { startDate: 'desc' },
    select: { id: true, year: true },
  });
  if (active) return active;

  const latest = await prisma.academicYear.findFirst({
    orderBy: { startDate: 'desc' },
    select: { id: true, year: true },
  });
  return latest;
}

/**
 * Same as {@link resolveAcademicYear} but throws when no academic year exists,
 * for endpoints where a year is mandatory and a zero-result response would be
 * misleading.
 */
export async function requireAcademicYear(
  prisma: PrismaClient,
): Promise<ResolvedAcademicYear> {
  const year = await resolveAcademicYear(prisma);
  if (!year) {
    throw new Error('No academic year has been configured yet.');
  }
  return year;
}
