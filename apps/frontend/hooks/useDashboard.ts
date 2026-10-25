'use client';

import { useQuery } from '@tanstack/react-query';
import {
  dashboardService,
  type DashboardHeader,
  type DashboardMetricsResponse,
  type DashboardSectionsResponse,
  type DashboardUploadsResponse,
} from '@/lib/services/dashboard.service';
import { queryKeys } from '@/lib/query/queryKeys';

/**
 * The dashboard is loaded in four independent queries.
 *
 * A dashboard used to be one request, which meant the whole page sat behind a
 * single skeleton until the slowest block (the chart sections) finished. Each
 * block now owns its query, so the header, the KPI row, the charts and the
 * upload feed each paint as soon as *their* data is ready.
 *
 * The cache policy is per block: the header and uploads change rarely, while
 * the metrics and sections are the volatile figures.
 */
export function useDashboardHeader() {
  return useQuery<DashboardHeader>({
    queryKey: queryKeys.dashboard.header(),
    queryFn: () => dashboardService.getHeader(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useDashboardMetrics() {
  return useQuery<DashboardMetricsResponse>({
    queryKey: queryKeys.dashboard.metrics(),
    queryFn: () => dashboardService.getMetrics(),
    staleTime: 60 * 1000,
  });
}

export function useDashboardSections() {
  return useQuery<DashboardSectionsResponse>({
    queryKey: queryKeys.dashboard.sections(),
    queryFn: () => dashboardService.getSections(),
    staleTime: 60 * 1000,
  });
}

export function useDashboardRecentUploads() {
  return useQuery<DashboardUploadsResponse>({
    queryKey: queryKeys.dashboard.recentUploads(),
    queryFn: () => dashboardService.getRecentUploads(),
    staleTime: 60 * 1000,
  });
}
