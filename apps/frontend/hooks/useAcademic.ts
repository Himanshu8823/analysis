'use client';

import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { academicService, type AcademicYear, type Batch } from '@/lib/services/academic.service';
import { queryKeys } from '@/lib/query/queryKeys';
import { describeRunningYear, resolveRunningYear } from '@/lib/academic';
import { useToast } from '@/lib/utils/notifications';
import { extractErrorMessage } from './useAuth';

export function useAcademicYears() {
  return useQuery<AcademicYear[]>({
    queryKey: queryKeys.academic.years(),
    queryFn: () => academicService.years(),
    staleTime: 30 * 60 * 1000,
  });
}

/**
 * Creates an academic year.
 *
 * The dates are what the system uses to work out which year is running, so
 * they are part of the form rather than something the system guesses.
 */
export function useCreateAcademicYear() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (payload: {
      year: string;
      startDate: string;
      endDate: string;
      isActive?: boolean;
    }) => academicService.createYear(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.academic.years() });
      toast.success('The academic year has been added.');
    },
    onError: (error: unknown) => toast.error(extractErrorMessage(error)),
  });
}

/**
 * Makes an academic year the running one.
 *
 * Exactly one year runs at a time — making a year the running one retires
 * the previous one.
 */
export function useActivateAcademicYear() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (id: string) => academicService.activateYear(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.academic.years() });
      toast.success('The running academic year has been changed.');
    },
    onError: (error: unknown) => toast.error(extractErrorMessage(error)),
  });
}

/**
 * The batches for an admission year.
 *
 * Passing no id returns every batch. Passing an empty string used to mean
 * "not chosen yet" and suppressed the request entirely, which left the batch
 * dropdown empty and made the form impossible to submit — so an empty string
 * is treated as "no filter" and the list is still fetched.
 */
export function useBatches(admissionYearId?: string) {
  const filter = admissionYearId && admissionYearId.length > 0 ? admissionYearId : undefined;
  return useQuery<Batch[]>({
    queryKey: queryKeys.academic.batches(filter),
    queryFn: () => academicService.batches(filter),
    staleTime: 30 * 60 * 1000,
  });
}

/**
 * What the college's calendar says about today.
 *
 * The running year is the one whose dates contain today — the same rule the
 * backend uses to decide what to report on, imported from the same shared
 * package so the two cannot drift.
 *
 * ## The three states
 *
 * - **running** — the year the college is in. Every dropdown defaults to it.
 * - **gap** — today falls between two years. The year that has just
 *   finished is offered as the default, because its results are what
 *   exist to be reviewed, and `message` says plainly that it has finished
 *   so nobody mistakes it for the current year.
 * - **none** — the college has not set its calendar up. Nothing is
 *   defaulted and the message says why.
 */
export interface RunningYear {
  /** The year to default to, when there is one. */
  year?: AcademicYear;
  /** The whole set of years, so a dropdown can offer them all. */
  years: AcademicYear[];
  /**
   * Whether a year is running right now — as opposed to the college being
   * between two years or having no calendar at all.
   */
  isRunning: boolean;
  /**
   * A sentence explaining the state, written for a college clerk. It is
   * `undefined` when a year is running, because then there is nothing to
   * explain.
   */
  message?: string;
}

/**
 * Resolves which academic year is running.
 *
 * The `today` argument exists so the rule can be tested with a fixed date
 * rather than with whatever day the test happens to run on.
 */
export function useRunningYear(today: Date = new Date()): RunningYear {
  const { data } = useAcademicYears();
  const years = useMemo(() => data ?? [], [data]);

  return useMemo(() => {
    const resolution = resolveRunningYear(years, today);

    if (resolution.status === 'running') {
      return {
        year: resolution.year as AcademicYear,
        years,
        isRunning: true,
      };
    }

    if (resolution.status === 'gap') {
      /**
       * In the gap, the year that has just finished is what there is to
       * look at. The year that has not started yet is never the default —
       * offering a year that has not begun would present the future as
       * the present.
       */
      const fallback = resolution.previous as AcademicYear | undefined;
      return {
        year: fallback,
        years,
        isRunning: false,
        message: describeRunningYear(resolution),
      };
    }

    return {
      years,
      isRunning: false,
      message: describeRunningYear(resolution),
    };
  }, [years, today]);
}
