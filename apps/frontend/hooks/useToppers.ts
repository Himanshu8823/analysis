'use client';

import { useQuery } from '@tanstack/react-query';
import {
  toppersService,
  type SubjectTopper,
  type ClassTopperByRule,
  type ClassTopper,
  type TopperFilters,
  type ClassTopperFilters,
} from '@/lib/services/toppers.service';
import { queryKeys } from '@/lib/query/queryKeys';

export function useSubjectToppers(filters?: TopperFilters, enabled = true) {
  return useQuery<SubjectTopper[]>({
    queryKey: queryKeys.toppers.subjectWise(filters),
    queryFn: () => toppersService.subjectWise(filters ?? {}),
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}

export function useClassToppers(filters?: ClassTopperFilters, enabled = true) {
  return useQuery<ClassTopperByRule | ClassTopper>({
    queryKey: queryKeys.toppers.class(filters),
    queryFn: () => toppersService.classToppers(filters ?? {}),
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}
