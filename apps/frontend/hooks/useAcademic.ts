'use client';

import { useQuery } from '@tanstack/react-query';
import { academicService, type AcademicYear, type Batch } from '@/lib/services/academic.service';
import { queryKeys } from '@/lib/query/queryKeys';

export function useAcademicYears() {
  return useQuery<AcademicYear[]>({
    queryKey: queryKeys.academic.years(),
    queryFn: () => academicService.years(),
    staleTime: 30 * 60 * 1000,
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
