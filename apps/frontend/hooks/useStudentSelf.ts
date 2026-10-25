'use client';

import { useQuery } from '@tanstack/react-query';
import {
  studentSelfService,
  type MyResult,
  type MyToppers,
} from '@/lib/services/student-self.service';
import { queryKeys } from '@/lib/query/queryKeys';

/**
 * The signed-in student's own result.
 *
 * The query is retry-free: the server refuses a result that has not been
 * published yet, and that refusal is an answer rather than a transient
 * failure. Retrying it would only delay the explanation the student needs.
 */
export function useMyResult(enabled = true) {
  return useQuery<MyResult>({
    queryKey: queryKeys.students.myResult(),
    queryFn: () => studentSelfService.getMyResult(),
    enabled,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

/** The leaderboard of the signed-in student's own class. */
export function useMyToppers(limit?: number, enabled = true) {
  return useQuery<MyToppers>({
    queryKey: queryKeys.students.myToppers(limit),
    queryFn: () => studentSelfService.getMyToppers(limit),
    enabled,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}
