'use client';

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query/queryKeys';
import {
  classOverviewService,
  type ClassOverview,
  type MyClass,
} from '@/lib/services/class-overview.service';

/**
 * The classes the signed-in member is the class teacher of.
 *
 * The query is always enabled — the endpoint resolves the classes from the
 * session, so there is nothing to wait for and nothing to narrow. An empty
 * result is a meaningful answer ("you are not a class teacher"), not a
 * missing value.
 */
export function useMyClasses() {
  return useQuery<MyClass[]>({
    queryKey: queryKeys.classOverview.myClasses(),
    queryFn: () => classOverviewService.listMyClasses(),
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * The overview of one of the signed-in member's classes.
 *
 * The query waits for a class id: until one is chosen there is no class to
 * read, and asking the server for one would be a request for a class the
 * member may not teach.
 */
export function useClassOverview(assignmentId?: string) {
  return useQuery<ClassOverview>({
    queryKey: queryKeys.classOverview.detail(assignmentId ?? ''),
    queryFn: () => classOverviewService.getClassOverview(assignmentId as string),
    enabled: !!assignmentId,
    staleTime: 60 * 1000,
  });
}
