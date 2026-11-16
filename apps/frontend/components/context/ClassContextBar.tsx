'use client';

import { useEffect, useMemo } from 'react';
import { GraduationCap, RotateCcw } from 'lucide-react';

import { Select } from '@/components/forms/Select';
import { Button } from '@/components/ui/button';
import { useBranches } from '@/hooks/useBranches';
import { useSchemes } from '@/hooks/useSchemes';
import { useAcademicYears, useRunningYear } from '@/hooks/useAcademic';
import { SEMESTERS, useClassContext } from '@/lib/context/class-context';

/**
 * ClassContextBar — the class every screen below it is working on.
 *
 * The bar sits at the top of the class-scoped screens, so the person always
 * knows which class they are looking at. It is the *same* class everywhere:
 * pick Computer Science, semester 5 on the marks screen, and the report
 * screen opens on that same class.
 *
 * It is a bar rather than a page of its own because it is a control, not a
 * destination. It collapses to a single row on a phone and opens into a
 * grid on a wider screen — the four fields never overflow, and the choice is
 * always reachable without scrolling the page it sits on.
 */
export function ClassContextBar({ className }: { className?: string }) {
  const { context, isChosen, setPart, clear } = useClassContext();

  const branchesQuery = useBranches();
  const schemesQuery = useSchemes();
  const yearsQuery = useAcademicYears();
  const runningYear = useRunningYear();

  const branches = branchesQuery.data ?? [];
  const schemes = schemesQuery.data ?? [];
  const years = yearsQuery.data ?? [];

  /**
   * The **running** academic year is the default.
   *
   * A college runs one academic year at a time, so choosing a year by hand
   * is the exception rather than the rule — and the year the system
   * chooses is the one the calendar's dates say is running today, not the
   * one with a flag set. The backend defaults its reports the same way, so
   * the screen and the report agree.
   *
   * The year is still chosen explicitly — a member reviewing last year's
   * results needs it — so the dropdown below offers every year and says
   * which one is current.
   */
  useEffect(() => {
    if (context.academicYearId) return;
    const defaultYear = runningYear.year;
    if (defaultYear) {
      setPart('academicYearId', defaultYear.id);
    }
  }, [runningYear.year, context.academicYearId, setPart]);

  /**
   * A branch that is no longer listed must not stay selected.
   *
   * The branch list is scoped to the member, so a branch they can no longer
   * reach leaves a stale id in the context. Keeping it would send a request
   * the server will refuse, and the screen would show an error with no way
   * to fix it.
   */
  useEffect(() => {
    if (branches.length === 0) return;
    if (context.branchId && !branches.some((branch) => branch.id === context.branchId)) {
      setPart('branchId', '');
    }
  }, [branches, context.branchId, setPart]);

  const summary = useMemo(() => {
    const branch = branches.find((b) => b.id === context.branchId);
    const year = years.find((y) => y.id === context.academicYearId);
    if (!isChosen) return null;
    return [
      branch ? `${branch.code} · ${branch.name}` : null,
      `Semester ${context.semester}`,
      year?.year ?? null,
    ]
      .filter(Boolean)
      .join('  ·  ');
  }, [branches, years, context, isChosen]);

  const loading = branchesQuery.isLoading || schemesQuery.isLoading || yearsQuery.isLoading;

  return (
    <section
      className={className}
      aria-labelledby="class-context-heading"
      data-testid="class-context-bar"
    >
      <h2 id="class-context-heading" className="sr-only">
        The class you are working on
      </h2>

      <div className="rounded-xl border border-hairline bg-card p-4 md:p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-2">
            <GraduationCap className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
            <div className="flex flex-col gap-0.5">
              <span className="text-caption uppercase tracking-wide text-muted">
                Working on
              </span>
              <span className="text-body-sm font-semibold text-ink">
                {loading
                  ? 'Loading…'
                  : (summary ?? 'Choose a class to begin')}
              </span>
            </div>
          </div>

          {isChosen ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clear}
              className="w-full shrink-0 md:w-auto"
            >
              <RotateCcw aria-hidden /> Change class
            </Button>
          ) : null}
        </div>

        {/**
         * The calendar notice.
         *
         * When the college is between two academic years — the summer
         * break, or before the next year has been opened — the bar says
         * so. Without this, the screen would quietly show the year that
         * has just finished, and a member would read its results as
         * current. The dropdown still lets them switch to any year.
         */}
        {runningYear.message ? (
          <p
            className="mt-4 rounded-lg border border-hairline bg-surface-soft px-3 py-2 text-body-sm text-body"
            role="status"
          >
            {runningYear.message}
          </p>
        ) : null}

        {/**
         * The four fields are always visible.
         *
         * Hiding them behind a button would mean two clicks before the
         * person can change the class, and the class is the thing they
         * change most. On a phone they stack; on a wider screen they sit in
         * a row.
         */}
        <div className="mt-4 grid grid-cols-1 gap-base sm:grid-cols-2 lg:grid-cols-4">
          <Select
            label="Branch"
            value={context.branchId}
            onChange={(e) => setPart('branchId', e.target.value)}
            placeholder="Select branch"
          >
            <option value="">Select branch</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.code} · {branch.name}
              </option>
            ))}
          </Select>

          <Select
            label="Scheme"
            value={context.schemeId}
            onChange={(e) => setPart('schemeId', e.target.value)}
            placeholder="Select scheme"
          >
            <option value="">Select scheme</option>
            {schemes.map((scheme) => (
              <option key={scheme.id} value={scheme.id}>
                {scheme.name}
              </option>
            ))}
          </Select>

          <Select
            label="Semester"
            value={String(context.semester)}
            onChange={(e) => setPart('semester', Number(e.target.value))}
          >
            {SEMESTERS.map((n) => (
              <option key={n} value={n}>
                Semester {n}
              </option>
            ))}
          </Select>

          <Select
            label="Academic year"
            value={context.academicYearId}
            onChange={(e) => setPart('academicYearId', e.target.value)}
            placeholder="Select academic year"
          >
            <option value="">Select academic year</option>
            {years.map((year) => (
              <option key={year.id} value={year.id}>
                {year.year}
                {runningYear.year?.id === year.id ? ' (running now)' : ''}
              </option>
            ))}
          </Select>
        </div>
      </div>
    </section>
  );
}
