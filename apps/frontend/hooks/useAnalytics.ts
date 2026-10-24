'use client';

import { useQuery } from '@tanstack/react-query';
import {
  analyticsService,
  type AnalyticsFilters,
  type OverviewStats,
  type PassFailStats,
  type SubjectDifficulty,
  type PerformanceTrendPoint,
} from '@/lib/services/analytics.service';
import { queryKeys } from '@/lib/query/queryKeys';

export function useOverview(filters?: AnalyticsFilters) {
  return useQuery<OverviewStats>({
    queryKey: queryKeys.analytics.overview(filters),
    queryFn: () => analyticsService.overview(filters),
    staleTime: 60 * 1000,
  });
}

export function usePassFail(filters?: AnalyticsFilters) {
  return useQuery<PassFailStats>({
    queryKey: queryKeys.analytics.passFail(filters),
    queryFn: () => analyticsService.passFail(filters),
    staleTime: 60 * 1000,
  });
}

export function useSubjectDifficulty(filters?: AnalyticsFilters) {
  return useQuery<SubjectDifficulty[]>({
    queryKey: queryKeys.analytics.subjectDifficulty(filters),
    queryFn: () => analyticsService.subjectDifficulty(filters),
    staleTime: 5 * 60 * 1000,
  });
}

export function usePerformanceTrends(filters?: AnalyticsFilters) {
  return useQuery<PerformanceTrendPoint[]>({
    queryKey: queryKeys.analytics.performanceTrends(filters),
    queryFn: () => analyticsService.performanceTrends(filters),
    staleTime: 5 * 60 * 1000,
  });
}
