'use client';

import { useQuery } from '@tanstack/react-query';
import {
  toppersService,
  type SubjectTopper,
  type ClassTopper,
  type SubjectTopperFilters,
  type ClassTopperFilters,
} from '@/lib/services/toppers.service';
import { queryKeys } from '@/lib/query/queryKeys';

export function useSubjectToppers(filters?: SubjectTopperFilters, enabled = true) {
  return useQuery<{ data: SubjectTopper[] }>({
    queryKey: queryKeys.toppers.subjectWise(filters),
    queryFn: () => toppersService.subjectToppers(filters ?? {}),
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}

export function useClassToppers(filters?: ClassTopperFilters, enabled = true) {
  return useQuery<{ data: ClassTopper[] }>({
    queryKey: queryKeys.toppers.class(filters),
    queryFn: () => toppersService.classToppers(filters ?? {}),
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}